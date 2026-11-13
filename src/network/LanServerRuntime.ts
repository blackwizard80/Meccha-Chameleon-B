import { Capacitor } from '@capacitor/core';
import { Nodejs } from '@capawesome/capacitor-nodejs';

let startPromise: Promise<void> | null = null;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ensureLanServer(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();

  if (!startPromise) {
    startPromise = (async () => {
      const current = await Nodejs.isReady();
      if (current.ready) return;

      await Nodejs.start();

      for (let attempt = 0; attempt < 60; attempt += 1) {
        const state = await Nodejs.isReady();
        if (state.ready) return;
        await delay(250);
      }

      throw new Error('The offline LAN service did not start. Please close and reopen the game.');
    })();
  }

  return startPromise;
}
