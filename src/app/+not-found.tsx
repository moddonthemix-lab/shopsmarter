import { Link, Stack } from 'expo-router';

import { Label, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <Label variant="heading">This screen doesn&apos;t exist.</Label>
        <Link href="/">
          <Label style={{ textDecorationLine: 'underline' }}>Back to your lists</Label>
        </Link>
      </Screen>
    </>
  );
}
