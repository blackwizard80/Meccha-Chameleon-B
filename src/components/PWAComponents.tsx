import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, RefreshCw, Share, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWA';

export const SplashScreen: React.FC = () => {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'gone'>('visible');

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setPhase('fading'), 950);
    const hideTimer = window.setTimeout(() => setPhase('gone'), 1350);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      onClick={() => setPhase('gone')}
      className={`fixed inset-0 z-[120] bg-slate-950 flex flex-col items-center justify-center transition-opacity duration-400 cursor-pointer ${
        phase === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <img
        src="/splash-landscape.jpg"
        alt="Meccha Chameleon Splash"
        className="absolute inset-0 w-full h-full object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/75" />

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <img
          src="/pwa-192x192.png"
          alt="Meccha Chameleon Icon"
          className="w-20 h-20 rounded-2xl border-2 border-cyan-400/50 shadow-2xl mb-3"
        />
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Meccha Chameleon
        </h1>
        <p className="text-xs sm:text-sm text-emerald-300 font-semibold mt-1">
          3D Paint Camouflage · Offline LAN Hide &amp; Seek
        </p>
        <div className="mt-4 w-44 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-emerald-400 to-cyan-400 origin-left transition-transform duration-700" />
        </div>
      </div>
    </div>
  );
};

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, needRefresh, install, applyUpdate } =
    usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (needRefresh) {
    return (
      <button
        onClick={applyUpdate}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Update Game</span>
      </button>
    );
  }

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-emerald-300"
        >
          <Share className="w-3.5 h-3.5" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-base font-bold text-white">
                  Install Meccha Chameleon
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                1. Tap the <strong>Share</strong> button in your Safari toolbar.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong> to launch offline in
                landscape mode.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-emerald-500 py-2 text-xs font-bold text-slate-950"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { offlineReady } = usePWAInstall();
  const [showReadyToast, setShowReadyToast] = useState(false);

  useEffect(() => {
    if (!offlineReady) return;
    setShowReadyToast(true);
    const t = window.setTimeout(() => setShowReadyToast(false), 3800);
    return () => clearTimeout(t);
  }, [offlineReady]);

  if (!isOnline) {
    return (
      <div className="fixed bottom-3 left-3 z-50 flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-lg pointer-events-none">
        <WifiOff className="w-3.5 h-3.5" />
        <span>Offline Mode · Practice &amp; LAN Ready</span>
      </div>
    );
  }

  if (showReadyToast) {
    return (
      <div className="fixed bottom-3 left-3 z-50 flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-lg pointer-events-none">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Cached for Offline Play</span>
      </div>
    );
  }

  return null;
};
