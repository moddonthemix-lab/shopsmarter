import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/components/theme';

function TabIcon({ name, color }: { name: SymbolViewProps['name']; color: ColorValue }) {
  return <SymbolView name={name} tintColor={color} size={26} />;
}

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: t.primary }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Lists',
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'list.bullet.clipboard', android: 'list_alt', web: 'list_alt' }} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="deals"
        options={{
          title: 'Weekly Deals',
          tabBarIcon: ({ color }) => <TabIcon name={{ ios: 'tag', android: 'sell', web: 'sell' }} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
