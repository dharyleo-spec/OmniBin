import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  BIN_HEIGHT_CM,
  FULL_PERCENT,
  fetchMonitorState,
  type MonitorState,
} from '../lib/binMonitor';
import { supabase } from '../lib/supabase';

type BinMonitorProps = {
  reloadKey?: number;
};

function clock(iso: string | undefined) {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function percentOrDash(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '—';
  }

  return `${value}%`;
}

export default function BinMonitor({ reloadKey = 0 }: BinMonitorProps) {
  const [state, setState] = useState<MonitorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const notifiedSensor = useRef(false);
  const notifiedCamera = useRef(false);

  const notify = useCallback(async (title: string, body: string) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'omnibin_alert.wav',
        },
        trigger: null,
      });
    } catch (notifyError) {
      console.error('MONITOR NOTIFICATION ERROR:', notifyError);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await fetchMonitorState();
      setState(next);
      setError('');

      const sensorFull = Boolean(next.sensor?.is_full);
      const cameraFull = next.camera?.is_full === true;

      if (sensorFull && !notifiedSensor.current) {
        notifiedSensor.current = true;
        notify(
          'OmniBin Alert',
          next.sensor?.distance_cm != null
            ? `HC-SR04 measured ${next.sensor.distance_cm} cm. The trashcan is full at ${next.sensor.fill_percent}%.`
            : next.sensor
              ? `The trashcan is full at ${next.sensor.fill_percent}%.`
              : 'The HC-SR04 reported the trashcan is full.',
        );
      }

      if (!sensorFull) {
        notifiedSensor.current = false;
      }

      if (cameraFull && !notifiedCamera.current) {
        notifiedCamera.current = true;
        notify(
          'OmniBin Alert',
          next.confirmed_full
            ? 'Camera confirmed the trashcan is full.'
            : 'Camera shows a full trashcan. The distance sensor has not reported full.',
        );
      }

      if (!cameraFull) {
        notifiedCamera.current = false;
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : 'Could not load the trashcan monitor.';

      console.error('MONITOR FETCH ERROR:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  useEffect(() => {
    let cancelled = false;

    const setupRealtime = async () => {
      const channelName = 'omnibin-monitor';
      const existing = supabase
        .getChannels()
        .find((channel) => channel.topic === `realtime:${channelName}`);

      if (existing) {
        await supabase.removeChannel(existing);
      }

      if (cancelled) {
        return null;
      }

      const channel = supabase.channel(channelName);

      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'readings' },
        () => {
          load();
        },
      );

      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'camera_checks' },
        () => {
          load();
        },
      );

      channel.subscribe();
      return channel;
    };

    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    setupRealtime().then((channel) => {
      if (channel && !cancelled) {
        realtimeChannel = channel;
      } else if (channel) {
        supabase.removeChannel(channel);
      }
    });

    return () => {
      cancelled = true;

      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [load]);

  const sensor = state?.sensor ?? null;
  const camera = state?.camera ?? null;
  const analytics = state?.analytics;
  const history = state?.history ?? [];
  const chartPoints = history.slice(-16);
  const recent = [...history].reverse().slice(0, 6);

  let statusLabel = 'No sensor data';
  let statusColor = '#777777';
  let statusBackground = '#F3F3F3';

  if (state?.confirmed_full) {
    statusLabel = 'Full, camera confirmed';
    statusColor = '#C62828';
    statusBackground = '#FFEBEE';
  } else if (sensor?.is_full) {
    statusLabel = 'Sensor says full';
    statusColor = '#E65100';
    statusBackground = '#FFF3E0';
  } else if (sensor) {
    statusLabel = 'Not full';
    statusColor = '#2E7D32';
    statusBackground = '#E8F5E9';
  }

  const fill = sensor ? Math.max(0, Math.min(100, sensor.fill_percent)) : 0;

  if (loading && !state) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sectionTitle}>Live trashcan</Text>
        <ActivityIndicator color="#1B5E20" style={styles.loading} />
      </View>
    );
  }

  if (error && !state) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sectionTitle}>Live trashcan</Text>
        <Text style={styles.sectionText}>
          The HC-SR04 sends the distance to the trash. The ESP32 camera checks that reading.
        </Text>
        <View style={styles.bannerCheck}>
          <Ionicons name="alert-circle-outline" size={18} color="#E65100" />
          <Text style={styles.bannerText}>
            Sensor and camera data could not be loaded. Run
            supabase/migrations/20261003120000_bin_monitor.sql in the Supabase
            SQL Editor, then pull to refresh. {error}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Live trashcan</Text>
      <Text style={styles.sectionText}>
        The HC-SR04 sends the distance to the trash. Fill is calculated from that
        measurement. Full starts at {FULL_PERCENT}% of a {BIN_HEIGHT_CM} cm bin.
      </Text>

      {error ? (
        <View style={styles.bannerCheck}>
          <Ionicons name="alert-circle-outline" size={18} color="#E65100" />
          <Text style={styles.bannerText}>
            Sensor and camera data could not be loaded. If this is the first
            setup, run supabase/migrations/20261003120000_bin_monitor.sql in
            the Supabase SQL Editor, then pull to refresh. {error}
          </Text>
        </View>
      ) : null}

      {state?.banner ? (
        <View
          style={
            state.banner.level === 'full'
              ? styles.bannerFull
              : styles.bannerCheck
          }
        >
          <Ionicons
            name={
              state.banner.level === 'full'
                ? 'warning-outline'
                : 'eye-outline'
            }
            size={18}
            color={state.banner.level === 'full' ? '#B71C1C' : '#E65100'}
          />
          <Text style={styles.bannerText}>{state.banner.text}</Text>
        </View>
      ) : null}

      <View style={styles.measureCard}>
        <View style={styles.binVisual}>
          <View style={styles.binLid} />
          <View style={styles.binBody}>
            <View
              style={[
                styles.binFill,
                {
                  height: `${fill}%`,
                  backgroundColor: sensor?.is_full ? '#C62828' : '#2E7D32',
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.measureCopy}>
          <Text style={styles.label}>HC-SR04 measurement</Text>
          <Text style={[styles.fillValue, { color: statusColor }]}>
            {sensor?.distance_cm === null || sensor?.distance_cm === undefined
              ? '—'
              : `${sensor.distance_cm}`}
            {sensor?.distance_cm === null || sensor?.distance_cm === undefined ? null : (
              <Text style={styles.unit}> cm</Text>
            )}
          </Text>
          <Text style={styles.distance}>
            {sensor
              ? `${sensor.fill_percent}% full, measured to the trash`
              : 'Waiting for the HC-SR04'}
          </Text>
          <View style={[styles.pill, { backgroundColor: statusBackground }]}>
            <Text style={[styles.pillText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
          <Text style={styles.updated}>
            {sensor ? `Updated ${clock(sensor.updated_at)}` : 'Waiting for a reading'}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="Readings today" value={String(analytics?.readings_today ?? 0)} />
        <Stat label="Average fill" value={percentOrDash(analytics?.average_fill)} />
        <Stat label="Peak fill" value={percentOrDash(analytics?.peak_fill)} />
        <Stat
          label="Full alerts today"
          value={String(analytics?.full_alerts_today ?? 0)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fill over time</Text>
        <Text style={styles.cardHint}>Each bar comes from one HC-SR04 measurement.</Text>
        {chartPoints.length === 0 ? (
          <Text style={styles.empty}>
            The chart appears after the first sensor reading.
          </Text>
        ) : (
          <View style={styles.chart}>
            {chartPoints.map((point, index) => (
              <View key={`${point.at}-${index}`} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(4, Math.min(100, point.fill_percent))}%`,
                      backgroundColor: point.is_full ? '#C62828' : '#2E7D32',
                    },
                  ]}
                />
              </View>
            ))}
            <View
              style={[
                styles.threshold,
                { bottom: `${FULL_PERCENT}%` },
              ]}
            />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Camera check</Text>
        <Text style={styles.cardHint}>
          The ESP32-CAM confirms whether the bin looks full.
        </Text>
        <View style={styles.cameraFrame}>
          {camera?.image ? (
            <Image
              source={{
                uri: `${camera.image}${camera.image.includes('?') ? '&' : '?'}t=${encodeURIComponent(camera.updated_at)}`,
              }}
              style={styles.cameraImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.cameraEmpty}>
              <Ionicons name="camera-outline" size={28} color="#8A8A8A" />
              <Text style={styles.empty}>No photo yet</Text>
            </View>
          )}
        </View>
        <Text style={styles.cameraResult}>
          {!camera || camera.is_full === null
            ? camera?.image
              ? 'Photo received. The camera has not sent a full or not-full result.'
              : 'Waiting for the camera.'
            : camera.is_full
              ? `Camera result: the trashcan looks full. ${clock(camera.updated_at)}`
              : `Camera result: the trashcan does not look full. ${clock(camera.updated_at)}`}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>HC-SR04 measurements</Text>
        <Text style={styles.cardHint}>Newest distance from the ultrasonic sensor.</Text>
        {recent.length === 0 ? (
          <Text style={styles.empty}>No HC-SR04 measurements yet.</Text>
        ) : (
          recent.map((point, index) => (
            <View key={`${point.at}-${index}`} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowValue}>
                  {point.distance_cm === null ? '—' : `${point.distance_cm} cm`}
                </Text>
                <Text style={styles.rowMeta}>
                  {point.fill_percent}% full
                  {' · '}
                  {clock(point.at)}
                </Text>
              </View>
              <Text
                style={[
                  styles.rowStatus,
                  { color: point.is_full ? '#C62828' : '#2E7D32' },
                ]}
              >
                {point.is_full ? 'Full' : 'Not full'}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Full notifications</Text>
        <Text style={styles.cardHint}>Logged when the bin changes to full.</Text>
        {(state?.alerts.length ?? 0) === 0 ? (
          <Text style={styles.empty}>No full alerts yet.</Text>
        ) : (
          state?.alerts.map((alert, index) => (
            <View key={`${alert.at}-${alert.source}-${index}`} style={styles.alertRow}>
              <Ionicons
                name={alert.source === 'camera' ? 'camera-outline' : 'pulse-outline'}
                size={16}
                color="#1B5E20"
              />
              <View style={styles.alertCopy}>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                <Text style={styles.rowMeta}>{clock(alert.at)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222222',
  },

  sectionText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 12,
  },

  loading: {
    marginTop: 16,
    marginBottom: 16,
  },

  bannerFull: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },

  bannerCheck: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },

  bannerText: {
    flex: 1,
    color: '#333333',
    fontSize: 13,
    lineHeight: 18,
  },

  measureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  binVisual: {
    width: 72,
    alignItems: 'center',
    marginRight: 16,
  },

  binLid: {
    width: 64,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#1B5E20',
    marginBottom: 4,
  },

  binBody: {
    width: 52,
    height: 88,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#1B5E20',
    backgroundColor: '#F5F7F5',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },

  binFill: {
    width: '100%',
  },

  measureCopy: {
    flex: 1,
  },

  label: {
    fontSize: 12,
    color: '#888888',
  },

  fillValue: {
    fontSize: 34,
    fontWeight: 'bold',
    marginTop: 2,
  },

  unit: {
    fontSize: 16,
    fontWeight: '600',
  },

  distance: {
    color: '#555555',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },

  pill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },

  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  updated: {
    color: '#999999',
    fontSize: 11,
    marginTop: 8,
  },

  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },

  stat: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
  },

  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginTop: 4,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
  },

  cardHint: {
    color: '#888888',
    fontSize: 12,
    marginTop: 3,
    marginBottom: 12,
  },

  empty: {
    color: '#888888',
    fontSize: 13,
    marginTop: 8,
  },

  chart: {
    height: 140,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    position: 'relative',
    marginTop: 8,
  },

  threshold: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E2D5BC',
    zIndex: 1,
  },

  barSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },

  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },

  cameraFrame: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F5F3',
  },

  cameraImage: {
    width: '100%',
    height: '100%',
  },

  cameraEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraResult: {
    color: '#444444',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },

  rowMain: {
    flex: 1,
  },

  rowValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
  },

  rowMeta: {
    color: '#888888',
    fontSize: 12,
    marginTop: 2,
  },

  rowStatus: {
    fontSize: 12,
    fontWeight: '700',
  },

  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },

  alertCopy: {
    flex: 1,
  },

  alertMessage: {
    color: '#333333',
    fontSize: 13,
    lineHeight: 18,
  },
});
