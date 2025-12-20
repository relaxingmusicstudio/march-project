import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type UsePWAResult = {
  isInstallable: boolean;
  isInstalled: boolean;
  isDev: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  // Optional helpers some UIs expect
  swRegistered: boolean;
};

export function usePWA(): UsePWAResult {
  const isDev = import.meta.env.DEV;

  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  // Detect installed (works for many browsers)
  useEffect(() => {
    const checkInstalled = () => {
      const standalone =
        // iOS Safari
        (window.navigator as any).standalone === true ||
        // Chromium
        window.matchMedia?.("(display-mode: standalone)")?.matches === true;

      setIsInstalled(!!standalone);
    };

    checkInstalled();
    window.addEventListener("focus", checkInstalled);
    return () => window.removeEventListener("focus", checkInstalled);
  }, []);

  // DEV MODE: disable SW + never allow install prompt (but return stable object)
  useEffect(() => {
    if (!isDev) return;

    setIsInstallable(false);
    deferredPromptRef.current = null;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    }

    setSwRegistered(false);
  }, [isDev]);

  // PROD MODE: register SW and listen for install prompt event
  useEffect(() => {
    if (isDev) return;

    const onBeforeInstallPrompt = (e: Event) => {
      // Prevent mini-infobar
      e.preventDefault?.();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then(() => {
            setSwRegistered(true);
            console.log("[PWA] Service worker registered");
          })
          .catch((err) => {
            setSwRegistered(false);
            console.warn("[PWA] Service worker registration failed:", err);
          });
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, [isDev]);

  const promptInstall = useCallback(async () => {
    if (isDev) return "unavailable";
    const evt = deferredPromptRef.current;
    if (!evt) return "unavailable";

    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice?.outcome === "accepted") {
        setIsInstallable(false);
        deferredPromptRef.current = null;
        return "accepted";
      }
      return "dismissed";
    } catch {
      return "unavailable";
    }
  }, [isDev]);

  return useMemo(
    () => ({
      isInstallable,
      isInstalled,
      isDev,
      promptInstall,
      swRegistered,
    }),
    [isInstallable, isInstalled, isDev, promptInstall, swRegistered]
  );
}
