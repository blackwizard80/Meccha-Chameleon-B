import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let swRegistered = false;
let swOfflineReady = false;
let swNeedRefresh = false;
let swUpdateFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
const swListeners = new Set<() => void>();

function ensureServiceWorkerRegistered() {
  if (swRegistered || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  swRegistered = true;
  swUpdateFn = registerSW({
    immediate: true,
    onOfflineReady() {
      swOfflineReady = true;
      swListeners.forEach((cb) => cb());
    },
    onNeedRefresh() {
      swNeedRefresh = true;
      swListeners.forEach((cb) => cb());
    },
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [offlineReady, setOfflineReady] = useState(swOfflineReady);
  const [needRefresh, setNeedRefresh] = useState(swNeedRefresh);

  useEffect(() => {
    ensureServiceWorkerRegistered();
    const sync = () => {
      setOfflineReady(swOfflineReady);
      setNeedRefresh(swNeedRefresh);
    };
    swListeners.add(sync);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      swListeners.delete(sync);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  const applyUpdate = async () => {
    if (swUpdateFn) {
      await swUpdateFn(true);
    }
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    offlineReady,
    needRefresh,
    install,
    applyUpdate,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
