import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User settings table
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tankSize: real("tank_size").notNull().default(14),
  consumptionRate: real("consumption_rate").notNull().default(4.5),
  stopDurationForRefuelAlert: integer("stop_duration_for_refuel_alert").notNull().default(2),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  tankSize: true,
  consumptionRate: true,
  stopDurationForRefuelAlert: true,
});
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

export const updateUserSettingsSchema = z.object({
  tankSize: z.number().min(5).max(30).optional(),
  consumptionRate: z.number().min(2).max(15).optional(),
  stopDurationForRefuelAlert: z.number().int().min(1).max(15).optional(),
});
export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;

// Trips table
export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at").notNull(),
  distanceKm: real("distance_km").notNull().default(0),
  avgSpeedKmh: real("avg_speed_kmh").notNull().default(0),
  maxSpeedKmh: real("max_speed_kmh").notNull().default(0),
  consumedFuelL: real("consumed_fuel_l").notNull().default(0),
  consumptionRateL100: real("consumption_rate_l100").notNull().default(0),
  durationMinutes: integer("duration_minutes").notNull().default(0),
});

export const insertTripSchema = createInsertSchema(trips).omit({ id: true });
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;
