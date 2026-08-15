import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alfares.adhubpro',
  appName: 'الفارس الذهبي',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true, // Allows HTTP connection to local PC Supabase over Wi-Fi
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0f172a',
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
    Camera: {
      // Automatic high quality photos for billboard installations
    },
  },
};

export default config;
