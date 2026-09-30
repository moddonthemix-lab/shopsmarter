import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { AppStateProvider } from '@/state/AppState';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <AppStateProvider>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="list/[id]" options={{ title: 'Grocery List' }} />
          <Stack.Screen name="compare/[id]" options={{ title: 'Price Comparison' }} />
          <Stack.Screen name="shop/[id]" options={{ title: 'Shopping' }} />
          <Stack.Screen name="price" options={{ title: 'Price', presentation: 'modal' }} />
          <Stack.Screen name="account" options={{ title: 'Account', presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </AppStateProvider>
  );
}
