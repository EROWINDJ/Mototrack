import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertUserSchema, updateUserSettingsSchema, insertTripSchema } from "@shared/schema";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  next();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "mototrack-secret-change-in-prod",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
    })
  );

  // ─── Auth Routes ────────────────────────────────────────────────────────────

  // Register
  app.post("/api/auth/register", async (req, res) => {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Données invalides", errors: result.error.flatten() });
    }

    const existing = await storage.getUserByUsername(result.data.username);
    if (existing) {
      return res.status(409).json({ message: "Cet email est déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(result.data.password, 10);
    const user = await storage.createUser({ username: result.data.username, password: hashedPassword });

    // Create default settings for new user
    await storage.createSettings({
      userId: user.id,
      tankSize: 14,
      consumptionRate: 4.5,
      stopDurationForRefuelAlert: 2,
    });

    req.session.userId = user.id;
    res.status(201).json({ id: user.id, username: user.username });
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Identifiants incorrects" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Identifiants incorrects" });
    }

    req.session.userId = user.id;
    res.json({ id: user.id, username: user.username });
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Déconnecté" });
    });
  });

  // Demo login
  app.post("/api/auth/demo-login", async (req, res) => {
    const demoEmail = process.env.DEMO_EMAIL;
    const demoPassword = process.env.DEMO_PASSWORD;
    if (!demoEmail || !demoPassword) {
      return res.status(503).json({ message: "Demo non disponible" });
    }
    let user = await storage.getUserByUsername(demoEmail);
    if (!user) {
      const hashedPassword = await bcrypt.hash(demoPassword, 10);
      user = await storage.createUser({ username: demoEmail, password: hashedPassword });
      await storage.createSettings({
        userId: user.id,
        tankSize: 14,
        consumptionRate: 4.5,
        stopDurationForRefuelAlert: 2,
      });
    } else {
      const valid = await bcrypt.compare(demoPassword, user.password);
      if (!valid) {
        return res.status(503).json({ message: "Demo non disponible" });
      }
    }
    req.session.userId = user.id;
    res.json({ id: user.id, username: user.username });
  });

  // Current user
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json({ id: user.id, username: user.username });
  });

  // ─── Settings Routes ────────────────────────────────────────────────────────

  app.get("/api/settings", requireAuth, async (req, res) => {
    let settings = await storage.getSettings(req.session.userId!);
    if (!settings) {
      settings = await storage.createSettings({
        userId: req.session.userId!,
        tankSize: 14,
        consumptionRate: 4.5,
        stopDurationForRefuelAlert: 2,
      });
    }
    res.json(settings);
  });

  app.patch("/api/settings", requireAuth, async (req, res) => {
    const result = updateUserSettingsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Données invalides", errors: result.error.flatten() });
    }

    let settings = await storage.getSettings(req.session.userId!);
    if (!settings) {
      settings = await storage.createSettings({
        userId: req.session.userId!,
        tankSize: result.data.tankSize ?? 14,
        consumptionRate: result.data.consumptionRate ?? 4.5,
        stopDurationForRefuelAlert: result.data.stopDurationForRefuelAlert ?? 2,
      });
    } else {
      settings = await storage.updateSettings(req.session.userId!, result.data) ?? settings;
    }

    res.json(settings);
  });

  // ─── Trips Routes ────────────────────────────────────────────────────────────

  app.get("/api/trips", requireAuth, async (req, res) => {
    const userTrips = await storage.getTrips(req.session.userId!);
    res.json(userTrips);
  });

  app.post("/api/trips", requireAuth, async (req, res) => {
    const tripData = {
      ...req.body,
      userId: req.session.userId!,
      startedAt: new Date(req.body.startedAt),
      endedAt: new Date(req.body.endedAt),
    };

    const result = insertTripSchema.safeParse(tripData);
    if (!result.success) {
      return res.status(400).json({ message: "Données de trajet invalides", errors: result.error.flatten() });
    }

    const trip = await storage.createTrip(result.data);
    res.status(201).json(trip);
  });

  return httpServer;
}
