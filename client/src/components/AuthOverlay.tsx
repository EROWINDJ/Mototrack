import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Mail, 
  Lock, 
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export default function AuthOverlay() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { login, register, demoLogin, isLoginPending, isRegisterPending, isDemoLoginPending } = useAuth();
  const isLoading = isLoginPending || isRegisterPending || isDemoLoginPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      if (isLogin) {
        await login({ username: email, password });
      } else {
        await register({ username: email, password });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("401") || msg.includes("incorrect") || msg.includes("Identifiant")) {
        setErrorMsg("Email ou mot de passe incorrect.");
      } else if (msg.includes("409") || msg.includes("déjà")) {
        setErrorMsg("Cet email est déjà utilisé.");
      } else {
        setErrorMsg("Une erreur est survenue. Réessayez.");
      }
    }
  };

  const handleGoogleClick = async () => {
    setErrorMsg("");
    try {
      await demoLogin();
    } catch {
      setErrorMsg("Connexion Google non disponible. Utilisez email/mot de passe.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6">
      
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -right-[20%] w-[70vw] h-[70vw] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -bottom-[20%] -left-[20%] w-[60vw] h-[60vw] rounded-full bg-primary/5 blur-[80px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 border border-primary/20">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-wider mb-2">MotoTrack</h1>
          <p className="text-muted-foreground text-sm">
            Vos trajets, vos statistiques, synchronisés partout.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Google Login Button */}
          <Button 
            type="button" 
            variant="outline" 
            className="w-full h-14 rounded-xl border-border bg-card hover:bg-card/80 flex items-center justify-center gap-3 relative overflow-hidden"
            onClick={handleGoogleClick}
            disabled={isLoading}
            data-testid="button-google-login"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="font-semibold text-sm">Continuer avec Google</span>
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-medium">Ou via Email</span>
            </div>
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="sr-only">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="adresse@email.com" 
                  className="pl-10 h-14 bg-card/50 border-border rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="sr-only">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Mot de passe" 
                  className="pl-10 h-14 bg-card/50 border-border rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-black font-bold text-lg mt-6 shadow-[0_0_20px_rgba(0,255,102,0.2)]"
            disabled={isLoading}
            data-testid="button-submit-auth"
          >
            {isLoading ? (
              <span className="animate-pulse">Connexion...</span>
            ) : (
              <span className="flex items-center gap-2">
                {isLogin ? 'Se connecter' : 'Créer un compte'} <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setErrorMsg(""); }}
            className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
            data-testid="button-toggle-auth-mode"
          >
            {isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
          </button>
        </div>

      </motion.div>
    </div>
  );
}
