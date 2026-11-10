import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tahershawki.atlastools',
  appName: 'Atlas Tools',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: { androidScheme: 'https' },
};

export default config;
