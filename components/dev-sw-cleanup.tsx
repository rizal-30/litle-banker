"use client";

/**
 * Hapus service worker lama saat development.
 * SW dari `npm run build` bisa intercept /login dan memicu reload berulang.
 */
import { useEffect } from "react";

export function DevSwCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => void reg.unregister());
    });

    if ("caches" in window) {
      void caches.keys().then((keys) => {
        keys.forEach((key) => void caches.delete(key));
      });
    }
  }, []);

  return null;
}
