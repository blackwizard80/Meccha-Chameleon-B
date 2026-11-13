import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blackwizard.mecchachameleon',
  appName: 'Meccha Chameleon',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: { allowMixedContent: true }
};

export default config;
