import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWA() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Detect iOS (Safari doesn't support beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;

    if (isStandalone) return; // Already installed, don't show

    if (ios) {
      // Show iOS guide after 3 seconds
      const timer = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* Install banner */}
      <div
        className="fixed bottom-20 left-3 right-3 z-50 rounded-2xl border border-primary/30 bg-black/90 backdrop-blur-md p-4 flex items-center gap-3 shadow-lg shadow-primary/10"
        data-testid="banner-install-pwa"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">Installer MotoTrack</p>
          <p className="text-muted-foreground text-xs">
            {isIOS ? 'Ajouter à votre écran d\'accueil' : 'App hors-ligne, plein écran'}
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 bg-primary text-black text-xs font-bold px-3 py-2 rounded-xl"
          data-testid="button-install-pwa"
        >
          Installer
        </button>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 p-1 text-muted-foreground"
          data-testid="button-dismiss-install"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* iOS guide modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 border border-primary/30">
            <h3 className="text-white font-bold text-lg mb-4 text-center">Installer sur iPhone</h3>
            <ol className="space-y-3 text-sm text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                <span>Appuyez sur le bouton <strong className="text-white">Partager</strong> en bas de Safari (icône carré avec flèche)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                <span>Faites défiler et choisissez <strong className="text-white">"Sur l'écran d'accueil"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                <span>Appuyez sur <strong className="text-white">"Ajouter"</strong> en haut à droite</span>
              </li>
            </ol>
            <button
              onClick={() => { setShowIOSGuide(false); setVisible(false); }}
              className="mt-6 w-full bg-primary text-black font-bold py-3 rounded-xl"
              data-testid="button-close-ios-guide"
            >
              Compris !
            </button>
          </div>
        </div>
      )}
    </>
  );
}
