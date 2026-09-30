import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the config; this only lets the web build be served from a
// sub-path, e.g. EXPO_BASE_URL=/shopsmarter for GitHub Pages.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_BASE_URL ?? '',
  },
});
