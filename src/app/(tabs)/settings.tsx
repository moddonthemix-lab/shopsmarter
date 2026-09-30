import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  DEFAULT_HOME,
  nearestLocations,
  roadMiles,
  STORE_IDS,
  STORE_LOCATIONS,
  STORES,
  type DrivingSettings,
  type StoreId,
} from '@/core';
import { useStoreTextColor, useTheme } from '@/components/theme';
import { Button, Card, Field, Label, Row, Screen } from '@/components/ui';
import { isBackendConfigured } from '@/lib/supabase';
import { useAppState } from '@/state/AppState';

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
  const storeColor = useStoreTextColor();
  const { settings, updateSettings, session, exportData, importData } = useAppState();
  const [backupText, setBackupText] = useState('');
  const [backupMsg, setBackupMsg] = useState<{ text: string; error?: boolean } | null>(null);
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

  const toggleStore = (id: StoreId) => {
    const on = settings.enabledStores.includes(id);
    if (on && settings.enabledStores.length === 1) return; // keep at least one store
    const next = on ? settings.enabledStores.filter((s) => s !== id) : STORE_IDS.filter((s) => s === id || settings.enabledStores.includes(s));
    updateSettings({ enabledStores: next });
  };

  const copyBackup = async () => {
    const json = exportData();
    try {
      await Clipboard.setStringAsync(json);
      setBackupMsg({ text: 'Backup copied – paste it into a note or email to yourself.' });
    } catch {
      setBackupText(json);
      setBackupMsg({ text: 'Couldn’t reach the clipboard – copy the text below instead.' });
    }
  };

  const restoreBackup = () => {
    try {
      importData(backupText.trim());
      setBackupText('');
      setBackupMsg({ text: 'Backup restored.' });
    } catch (e) {
      setBackupMsg({ text: e instanceof Error ? e.message : 'Invalid backup.', error: true });
    }
  };

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
        {Object.values(nearest)
          .filter((loc) => settings.enabledStores.includes(loc.storeId))
          .map((loc) => (
          <Row key={loc.storeId} style={{ justifyContent: 'space-between' }}>
            <Label variant="small" style={{ flex: 1 }}>
              {loc.label}
            </Label>
            <Label variant="small" style={{ color: storeColor(loc.storeId), fontWeight: '600' }}>
              {roadMiles(settings.home, loc).toFixed(1)} mi
            </Label>
          </Row>
        ))}
      </Card>

      <Card>
        <Label variant="heading">Stores I shop at</Label>
        <Label variant="small">Turned-off stores are left out of comparisons, prices and deals.</Label>
        <Row style={{ flexWrap: 'wrap' }}>
          {STORE_IDS.map((id) => {
            const on = settings.enabledStores.includes(id);
            return (
              <Pressable
                key={id}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                onPress={() => toggleStore(id)}
                style={[styles.chip, { borderColor: STORES[id].color }, on && { backgroundColor: STORES[id].color }]}>
                <Label style={on ? { color: '#fff', fontWeight: '700' } : { color: t.muted }}>
                  {on ? '✓ ' : ''}
                  {STORES[id].name}
                </Label>
              </Pressable>
            );
          })}
        </Row>
      </Card>

      <Card>
        <Label variant="heading">Backup</Label>
        <Label variant="small">
          Everything is saved on this device{Platform.OS === 'web' ? ' in this browser' : ''}. Copy a backup now and then
          so you never lose your lists and prices, or to move them to another device.
        </Label>
        <Button title="Copy backup" kind="secondary" onPress={copyBackup} />
        <Field
          placeholder="Paste a backup here to restore it"
          value={backupText}
          onChangeText={setBackupText}
          multiline
          style={{ maxHeight: 120 }}
        />
        {backupText.trim() ? <Button title="Restore from backup" kind="danger" onPress={restoreBackup} /> : null}
        {backupMsg ? (
          <Label variant="small" style={{ color: backupMsg.error ? t.danger : t.primary }}>
            {backupMsg.text}
          </Label>
        ) : null}
      </Card>

      {isBackendConfigured ? (
        <Card>
          <Label variant="heading">Account</Label>
          <Label variant="muted">
            {session
              ? `Signed in as ${session.user.email ?? 'your account'}. Lists sync across devices.`
              : 'Sign in to sync lists across devices.'}
          </Label>
          <Button title={session ? 'Manage account' : 'Sign in'} kind="secondary" onPress={() => router.push('/account')} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});
