import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sydions.scheduler',
  appName: 'Sydions Scheduler',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '540302821731-ermnhis4l5n7ktghcosnku261otb1597.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
