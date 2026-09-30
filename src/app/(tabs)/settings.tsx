import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DEFAULT_HOME, STORE_LOCATIONS, STORES, nearestLocations, roadMiles, type DrivingSettings } from '@/core';
import { formatMoney, useTheme } from '@/components/theme';
import { Button, Card, Field, Label, Row, Screen } from '@/components/ui';
import { isBackendConfigured } from '@/lib/supabase';
import { FREE_COMPARISONS_PER_MONTH, useAppState, type Plan } from '@/state/AppState';

function NumberField({
  label,
  value,
  onCommit,
  min = 0,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  min?: number;
}) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const n = Number(text.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n >= min) onCommit(n);
    else setText(String(value));
  };
  return (
    <View style={{ flex: 1 }}>
      <Field label={label} value={text} onChangeText={setText} onBlur={commit} onSubmitEditing={commit} keyboardType="decimal-pad" />
    </View>
  );
}

export default function SettingsScreen() {
  const t = useTheme();
  const { settings, updateSettings, comparisonsLeft, session } = useAppState();
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const setDriving = (patch: Partial<DrivingSettings>) => updateSettings({ driving: { ...settings.driving, ...patch } });

  const useMyLocation = async () => {
    setLocating(true);
    setLocError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Location permission denied – using the default location.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      updateSettings({ home: { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'your location' } });
    } catch {
      setLocError('Could not get your location.');
    } finally {
      setLocating(false);
    }
  };

  const nearest = nearestLocations(settings.home, STORE_LOCATIONS);
  const left = comparisonsLeft();

  return (
    <Screen>
      <Card>
        <Label variant="heading">Driving costs</Label>
        <Label variant="small">Used to decide whether a multi-store trip is worth the gas.</Label>
        <Row style={{ alignItems: 'flex-start' }}>
          <NumberField label="Vehicle MPG" value={settings.driving.mpg} min={1} onCommit={(mpg) => setDriving({ mpg })} />
          <NumberField
            label="Gas price ($/gal)"
            value={settings.driving.fuelPricePerGallon}
            onCommit={(fuelPricePerGallon) => setDriving({ fuelPricePerGallon })}
          />
        </Row>
        <Row style={{ alignItems: 'flex-start' }}>
          <NumberField
            label="Value of your time ($/hr, 0 = ignore)"
            value={settings.driving.hourlyTimeValue}
            onCommit={(hourlyTimeValue) => setDriving({ hourlyTimeValue })}
          />
          <NumberField
            label="Minimum savings to split ($)"
            value={settings.splitThreshold}
            onCommit={(splitThreshold) => updateSettings({ splitThreshold })}
          />
        </Row>
      </Card>

      <Card>
        <Label variant="heading">Home location</Label>
        <Label variant="muted">Distances are measured from {settings.home.label}.</Label>
        <Row>
          <Button title="Use my location" onPress={useMyLocation} loading={locating} style={{ flex: 1 }} />
          <Button title="Reset" kind="secondary" onPress={() => updateSettings({ home: DEFAULT_HOME })} />
        </Row>
        {locError ? <Label variant="small" style={{ color: t.danger }}>{locError}</Label> : null}
        {Object.values(nearest).map((loc) => (
          <Row key={loc.storeId} style={{ justifyContent: 'space-between' }}>
            <Label variant="small" style={{ flex: 1 }}>
              {loc.label}
            </Label>
            <Label variant="small" style={{ color: STORES[loc.storeId].color, fontWeight: '600' }}>
              {roadMiles(settings.home, loc).toFixed(1)} mi
            </Label>
          </Row>
        ))}
      </Card>

      <Card>
        <Label variant="heading">Plan</Label>
        <Row>
          {(['free', 'pro'] as Plan[]).map((plan) => (
            <Pressable
              key={plan}
              onPress={() => updateSettings({ plan })}
              style={[styles.plan, { borderColor: settings.plan === plan ? t.primary : t.border }]}>
              <Label variant="heading">{plan === 'free' ? 'Free' : 'Pro'}</Label>
              <Label variant="small">{plan === 'free' ? `${FREE_COMPARISONS_PER_MONTH} comparisons / month` : `${formatMoney(4.99)} / month`}</Label>
              <Label variant="small">
                {plan === 'free'
                  ? 'Basic price comparison'
                  : 'Unlimited comparisons, price alerts, price history, family budgeting, receipt scanning'}
              </Label>
            </Pressable>
          ))}
        </Row>
        <Label variant="small">
          {Number.isFinite(left) ? `${left} comparisons left this month.` : 'Unlimited comparisons.'} Billing isn&apos;t
          wired up yet – selecting Pro here is a preview.
        </Label>
      </Card>

      <Card>
        <Label variant="heading">Account</Label>
        <Label variant="muted">
          {!isBackendConfigured
            ? 'Cloud sync is off – lists are saved on this device.'
            : session
              ? `Signed in as ${session.user.email ?? 'your account'}. Lists sync across devices.`
              : 'Sign in to sync lists across devices.'}
        </Label>
        {isBackendConfigured ? (
          <Button title={session ? 'Manage account' : 'Sign in'} kind="secondary" onPress={() => router.push('/account')} />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plan: { flex: 1, borderWidth: 2, borderRadius: 12, padding: 10, gap: 4 },
});
