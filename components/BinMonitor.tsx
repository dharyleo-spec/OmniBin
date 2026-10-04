import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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

type IoniconName =
  keyof typeof Ionicons.glyphMap;

/*
 * =====================================================
 * CLOCK
 * =====================================================
 */

function clock(
  iso: string | undefined
) {
  if (!iso) {
    return '—';
  }

  const date =
    new Date(iso);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return iso;
  }

  return date.toLocaleString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  );
}

/*
 * =====================================================
 * PERCENT
 * =====================================================
 */

function percentOrDash(
  value:
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  return `${value}%`;
}

/*
 * =====================================================
 * WASTE ICON
 * =====================================================
 */

function getWasteIcon(
  wasteType:
    | string
    | undefined
): IoniconName {
  const type =
    wasteType
      ?.toLowerCase()
      .trim();

  if (
    type ===
    'biodegradable'
  ) {
    return 'leaf-outline';
  }

  if (
    type ===
    'non-biodegradable'
  ) {
    return 'trash-bin-outline';
  }

  if (
    type ===
    'recyclable'
  ) {
    return 'refresh-circle-outline';
  }

  return 'trash-bin-outline';
}

/*
 * =====================================================
 * COMPONENT
 * =====================================================
 */

export default function BinMonitor({
  reloadKey = 0,
}: BinMonitorProps) {
  const [state, setState] =
    useState<MonitorState | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const notifiedSensor =
    useRef(false);

  const notifiedCamera =
    useRef(false);

  /*
   * ===================================================
   * PUSH NOTIFICATION
   * ===================================================
   */

  const notify =
    useCallback(
      async (
        title: string,
        body: string
      ) => {
        try {
          await Notifications.scheduleNotificationAsync(
            {
              content: {
                title,
                body,
                sound:
                  'omnibin_alert.wav',
              },

              trigger: null,
            }
          );
        } catch (
          notifyError
        ) {
          console.error(
            'MONITOR NOTIFICATION ERROR:',
            notifyError
          );
        }
      },
      []
    );

  /*
   * ===================================================
   * LOAD
   * ===================================================
   */

  const load =
    useCallback(
      async () => {
        try {
          const next =
            await fetchMonitorState();

          setState(next);

          setError('');

          /*
           * HC-SR04 IS THE MAIN
           * LIVE SOURCE
           */

          const sensorFull =
            Boolean(
              next.sensor?.is_full
            );

          const cameraFull =
            next.camera
              ?.is_full === true;

          /*
           * SENSOR NOTIFICATION
           */

          if (
            sensorFull &&
            !notifiedSensor.current
          ) {
            notifiedSensor.current =
              true;

            notify(
              'OmniBin Alert',

              next.sensor
                ?.distance_cm != null
                ? `HC-SR04 measured ${next.sensor.distance_cm} cm. The trashcan is full at ${next.sensor.fill_percent}%.`
                : next.sensor
                  ? `The trashcan is full at ${next.sensor.fill_percent}%.`
                  : 'The HC-SR04 reported the trashcan is full.'
            );
          }

          if (!sensorFull) {
            notifiedSensor.current =
              false;
          }

          /*
           * CAMERA NOTIFICATION
           */

          if (
            cameraFull &&
            !notifiedCamera.current
          ) {
            notifiedCamera.current =
              true;

            notify(
              'OmniBin Alert',

              next.confirmed_full
                ? 'Camera confirmed the trashcan is full.'
                : 'Camera shows a full trashcan. The distance sensor has not reported full.'
            );
          }

          if (!cameraFull) {
            notifiedCamera.current =
              false;
          }
        } catch (
          loadError
        ) {
          const message =
            loadError instanceof
            Error
              ? loadError.message
              : 'Could not load the trashcan monitor.';

          console.error(
            'MONITOR FETCH ERROR:',
            message
          );

          setError(message);
        } finally {
          setLoading(false);
        }
      },
      [notify]
    );

  /*
   * ===================================================
   * INITIAL LOAD
   * ===================================================
   */

  useEffect(() => {
    load();
  }, [
    load,
    reloadKey,
  ]);

  /*
   * ===================================================
   * REALTIME
   * ===================================================
   */

  useEffect(() => {
    let cancelled =
      false;

    const setupRealtime =
      async () => {
        const channelName =
          'omnibin-monitor';

        const existing =
          supabase
            .getChannels()
            .find(
              (
                channel
              ) =>
                channel.topic ===
                `realtime:${channelName}`
            );

        if (existing) {
          await supabase.removeChannel(
            existing
          );
        }

        if (cancelled) {
          return null;
        }

        const channel =
          supabase.channel(
            channelName
          );

        /*
         * HC-SR04
         */

        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'readings',
          },
          () => {
            load();
          }
        );

        /*
         * CAMERA
         */

        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'camera_checks',
          },
          () => {
            load();
          }
        );

        /*
         * BIN DETAILS
         */

        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bins',
          },
          () => {
            load();
          }
        );

        channel.subscribe();

        return channel;
      };

    let realtimeChannel:
      ReturnType<
        typeof supabase.channel
      > | null = null;

    setupRealtime().then(
      (
        channel
      ) => {
        if (
          channel &&
          !cancelled
        ) {
          realtimeChannel =
            channel;
        } else if (
          channel
        ) {
          supabase.removeChannel(
            channel
          );
        }
      }
    );

    return () => {
      cancelled = true;

      if (
        realtimeChannel
      ) {
        supabase.removeChannel(
          realtimeChannel
        );
      }
    };
  }, [load]);

  /*
   * ===================================================
   * DATA
   * ===================================================
   */

  const bin =
    state?.bin ?? null;

  const sensor =
    state?.sensor ?? null;

  const camera =
    state?.camera ?? null;

  const analytics =
    state?.analytics;

  const history =
    state?.history ?? [];

  const chartPoints =
    history.slice(-16);

  const recent =
    [
      ...history,
    ]
      .reverse()
      .slice(0, 6);

  /*
   * ===================================================
   * STATUS
   * ===================================================
   */

  let statusLabel =
  'WAITING FOR SENSOR';

  let statusColor =
    '#777777';

  let statusBackground =
    '#F3F3F3';

  if (sensor) {
    const currentFill = Math.max(
      0,
      Math.min(
        100,
        sensor.fill_percent
      )
    );

    /*
    * LEVEL COLORS
    *
    * 0–49   = Green
    * 50–84  = Yellow
    * 85–100 = Red
    */

    if (currentFill >= 85) {
      statusColor = '#C62828';
      statusBackground = '#FFEBEE';
    } else if (currentFill >= 50) {
      statusColor = '#F9A825';
      statusBackground = '#FFF8E1';
    } else {
      statusColor = '#2E7D32';
      statusBackground = '#E8F5E9';
    }

  /*
   * STATUS LABEL
   */

  if (currentFill >= 85) {
    statusLabel = state?.confirmed_full
      ? 'FULL - CAMERA CONFIRMED'
      : 'FULL';
  } else {
    statusLabel = 'AVAILABLE';
  }
}

  const fill =
    sensor
      ? Math.max(
          0,
          Math.min(
            100,
            sensor.fill_percent
          )
        )
      : 0;

  /*
   * ===================================================
   * LOADING
   * ===================================================
   */

  if (
    loading &&
    !state
  ) {
    return (
      <View
        style={
          styles.wrap
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Live trashcan
        </Text>

        <ActivityIndicator
          color="#1B5E20"
          style={
            styles.loading
          }
        />
      </View>
    );
  }

  /*
   * ===================================================
   * ERROR
   * ===================================================
   */

  if (
    error &&
    !state
  ) {
    return (
      <View
        style={
          styles.wrap
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Live trashcan
        </Text>

        <Text
          style={
            styles.sectionText
          }
        >
          The HC-SR04 sends the
          distance to the trash.
          Fill is calculated from
          that measurement.
        </Text>

        <View
          style={
            styles.bannerCheck
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color="#E65100"
          />

          <Text
            style={
              styles.bannerText
            }
          >
            Sensor and camera data
            could not be loaded.
            {` ${error}`}
          </Text>
        </View>
      </View>
    );
  }

  /*
   * ===================================================
   * MAIN UI
   * ===================================================
   */

  return (
    <View
      style={
        styles.wrap
      }
    >
      <Text
        style={
          styles.sectionTitle
        }
      >
        Live trashcan
      </Text>

      <Text
        style={
          styles.sectionText
        }
      >
        The HC-SR04 sends the
        distance to the trash.
        Fill is calculated from
        that measurement. Full
        starts at {FULL_PERCENT}%
        of a {BIN_HEIGHT_CM} cm
        bin.
      </Text>

      {error ? (
        <View
          style={
            styles.bannerCheck
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color="#E65100"
          />

          <Text
            style={
              styles.bannerText
            }
          >
            Sensor and camera data
            could not be loaded.
            {` ${error}`}
          </Text>
        </View>
      ) : null}

      {state?.banner ? (
        <View
          style={
            state.banner.level ===
            'full'
              ? styles.bannerFull
              : styles.bannerCheck
          }
        >
          <Ionicons
            name={
              state.banner.level ===
              'full'
                ? 'warning-outline'
                : 'eye-outline'
            }
            size={20}
            color={
              state.banner.level ===
              'full'
                ? '#B71C1C'
                : '#E65100'
            }
          />

          <Text
            style={
              styles.bannerText
            }
          >
            {state.banner.text}
          </Text>
        </View>
      ) : null}

      {/* =================================================
          ONE LIVE TRASHCAN
          ================================================= */}

      <View
        style={
          styles.liveCard
        }
      >
        {/* HEADER */}

        <View
          style={
            styles.liveHeader
          }
        >
          <View
            style={[
              styles.liveIconContainer,
              {
                backgroundColor:
                  sensor?.is_full
                    ? '#FCEAEA'
                    : '#E8F5E9',
              },
            ]}
          >
            <Ionicons
              name={getWasteIcon(
                bin?.waste_type
              )}
              size={30}
              color={statusColor}
            />
          </View>

          <View
            style={
              styles.liveTitleArea
            }
          >
            <Text
              style={
                styles.liveTitle
              }
            >
              {bin?.name ??
                'Live Trashcan 01'}
            </Text>

            <Text
              style={
                styles.liveSubtitle
              }
            >
              {bin?.waste_type ??
                'Recyclable'}
            </Text>
          </View>

          <Text
            style={[
              styles.liveStatus,
              {
                color:
                  statusColor,
              },
            ]}
          >
            {sensor
              ? sensor.is_full
                ? 'FULL'
                : 'AVAILABLE'
              : 'WAITING'}
          </Text>
        </View>

        {/* CAPACITY */}

        <View
          style={
            styles.capacityRow
          }
        >
          <Text
            style={[
              styles.capacityValue,
              {
                color:
                  statusColor,
              },
            ]}
          >
            {sensor
              ? `${sensor.fill_percent}%`
              : '—'}
          </Text>

          <Text
            style={
              styles.capacityLabel
            }
          >
            Capacity
          </Text>
        </View>

        {/* PROGRESS */}

        <View
          style={
            styles.progressBackground
          }
        >
          <View
            style={[
              styles.progressFill,
              {
                width:
                  `${fill}%`,
                backgroundColor:
                  statusColor,
              },
            ]}
          />
        </View>

        {/* SENSOR */}

        <View
          style={
            styles.sensorInfoRow
          }
        >
          <View
            style={
              styles.sensorInfo
            }
          >
            <Ionicons
              name="radio-outline"
              size={19}
              color="#777777"
            />

            <Text
              style={
                styles.sensorInfoText
              }
            >
              HC-SR04:{' '}
              {sensor?.distance_cm !=
              null
                ? `${sensor.distance_cm} cm`
                : '—'}
            </Text>
          </View>

          <View
            style={
              styles.sensorInfo
            }
          >
            <Ionicons
              name="pulse-outline"
              size={19}
              color="#777777"
            />

            <Text
              style={
                styles.sensorInfoText
              }
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* LOCATION + LAST UPDATED */}

        <View
          style={
            styles.detailsRow
          }
        >
          {/* LOCATION */}

          <View
            style={
              styles.detailItem
            }
          >
            <Ionicons
              name="location-outline"
              size={21}
              color="#777777"
            />

            <View
              style={
                styles.detailTextContainer
              }
            >
              <Text
                style={
                  styles.detailLabel
                }
              >
                Location
              </Text>

              <Text
                style={
                  styles.detailValue
                }
                numberOfLines={2}
              >
                {bin?.location ??
                  '—'}
              </Text>
            </View>
          </View>

          {/* LAST UPDATED */}

          <View
            style={
              styles.detailItem
            }
          >
            <Ionicons
              name="time-outline"
              size={21}
              color="#777777"
            />

            <View
              style={
                styles.detailTextContainer
              }
            >
              <Text
                style={
                  styles.detailLabel
                }
              >
                Last updated
              </Text>

              <Text
                style={
                  styles.detailValue
                }
                numberOfLines={2}
              >
                {sensor
                  ? clock(
                      sensor.updated_at
                    )
                  : 'Waiting for a reading'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* =================================================
          STATISTICS
          ================================================= */}

      <View
        style={
          styles.stats
        }
      >
        <Stat
          label="Readings today"
          value={String(
            analytics
              ?.readings_today ??
              0
          )}
        />

        <Stat
          label="Average fill"
          value={percentOrDash(
            analytics
              ?.average_fill
          )}
        />

        <Stat
          label="Peak fill"
          value={percentOrDash(
            analytics
              ?.peak_fill
          )}
        />

        <Stat
          label="Full alerts today"
          value={String(
            analytics
              ?.full_alerts_today ??
              0
          )}
        />
      </View>

      {/* =================================================
          FILL OVER TIME
          ================================================= */}

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.cardTitle
          }
        >
          Fill over time
        </Text>

        <Text
          style={
            styles.cardHint
          }
        >
          Each bar comes from
          one HC-SR04 measurement.
        </Text>

        {chartPoints.length ===
        0 ? (
          <Text
            style={
              styles.empty
            }
          >
            The chart appears after
            the first sensor reading.
          </Text>
        ) : (
          <View
            style={
              styles.chart
            }
          >
            {chartPoints.map(
              (
                point,
                index
              ) => (
                <View
                  key={`${point.at}-${index}`}
                  style={
                    styles.barSlot
                  }
                >
                  <View
                    style={[
                      styles.bar,
                      {
                        height:
                          `${Math.max(
                            4,
                            Math.min(
                              100,
                              point.fill_percent
                            )
                          )}%`,

                        backgroundColor:
                          point.is_full
                            ? '#C62828'
                            : '#2E7D32',
                      },
                    ]}
                  />
                </View>
              )
            )}

            <View
              style={[
                styles.threshold,
                {
                  bottom:
                    `${FULL_PERCENT}%`,
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* =================================================
          CAMERA CHECK
          ================================================= */}

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.cardTitle
          }
        >
          Camera check
        </Text>

        <Text
          style={
            styles.cardHint
          }
        >
          The ESP32-CAM confirms
          whether the same trashcan
          looks full.
        </Text>

        <View
          style={
            styles.cameraFrame
          }
        >
          {camera?.image ? (
            <Image
              source={{
                uri: `${camera.image}${
                  camera.image.includes(
                    '?'
                  )
                    ? '&'
                    : '?'
                }t=${encodeURIComponent(
                  camera.updated_at
                )}`,
              }}
              style={
                styles.cameraImage
              }
              contentFit="cover"
            />
          ) : (
            <View
              style={
                styles.cameraEmpty
              }
            >
              <Ionicons
                name="camera-outline"
                size={32}
                color="#8A8A8A"
              />

              <Text
                style={
                  styles.empty
                }
              >
                No photo yet
              </Text>
            </View>
          )}
        </View>

        <Text
          style={
            styles.cameraResult
          }
        >
          {!camera ||
          camera.is_full === null
            ? camera?.image
              ? 'Photo received. The camera has not sent a full or not-full result.'
              : 'Waiting for the camera.'
            : camera.is_full
              ? `Camera result: the same trashcan looks full. ${clock(
                  camera.updated_at
                )}`
              : `Camera result: the same trashcan does not look full. ${clock(
                  camera.updated_at
                )}`}
        </Text>
      </View>

      {/* =================================================
          HC-SR04 MEASUREMENTS
          ================================================= */}

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.cardTitle
          }
        >
          HC-SR04 measurements
        </Text>

        <Text
          style={
            styles.cardHint
          }
        >
          Newest distance readings
          from the same trashcan.
        </Text>

        {recent.length ===
        0 ? (
          <Text
            style={
              styles.empty
            }
          >
            No HC-SR04 measurements
            yet.
          </Text>
        ) : (
          recent.map(
            (
              point,
              index
            ) => (
              <View
                key={`${point.at}-${index}`}
                style={
                  styles.row
                }
              >
                <View
                  style={
                    styles.rowMain
                  }
                >
                  <Text
                    style={
                      styles.rowValue
                    }
                  >
                    {point.distance_cm ===
                    null
                      ? '—'
                      : `${point.distance_cm} cm`}
                  </Text>

                  <Text
                    style={
                      styles.rowMeta
                    }
                  >
                    {point.fill_percent}%
                    {' full · '}
                    {clock(
                      point.at
                    )}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.rowStatus,
                    {
                      color:
                        point.is_full
                          ? '#C62828'
                          : '#2E7D32',
                    },
                  ]}
                >
                  {point.is_full
                    ? 'Full'
                    : 'Not full'}
                </Text>
              </View>
            )
          )
        )}
      </View>

      {/* =================================================
          FULL NOTIFICATIONS
          ================================================= */}

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.cardTitle
          }
        >
          Full notifications
        </Text>

        <Text
          style={
            styles.cardHint
          }
        >
          Logged when this trashcan
          changes to full.
        </Text>

        {(state?.alerts.length ??
          0) === 0 ? (
          <Text
            style={
              styles.empty
            }
          >
            No full alerts yet.
          </Text>
        ) : (
          state?.alerts.map(
            (
              alert,
              index
            ) => (
              <View
                key={`${alert.at}-${alert.source}-${index}`}
                style={
                  styles.alertRow
                }
              >
                <Ionicons
                  name={
                    alert.source ===
                    'camera'
                      ? 'camera-outline'
                      : 'pulse-outline'
                  }
                  size={18}
                  color="#1B5E20"
                />

                <View
                  style={
                    styles.alertCopy
                  }
                >
                  <Text
                    style={
                      styles.alertMessage
                    }
                  >
                    {alert.message}
                  </Text>

                  <Text
                    style={
                      styles.rowMeta
                    }
                  >
                    {clock(
                      alert.at
                    )}
                  </Text>
                </View>
              </View>
            )
          )
        )}
      </View>
    </View>
  );
}

/*
 * =====================================================
 * STAT
 * =====================================================
 */

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.stat
      }
    >
      <Text
        style={
          styles.label
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.statValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

/*
 * =====================================================
 * STYLES
 * =====================================================
 */

const styles =
  StyleSheet.create({
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

    /*
     * BANNERS
     */

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

    /*
     * LIVE CARD
     */

    liveCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 18,
      marginBottom: 12,

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.08,
      shadowRadius: 6,

      elevation: 3,
    },

    liveHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    liveIconContainer: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },

    liveTitleArea: {
      flex: 1,
    },

    liveTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#222222',
    },

    liveSubtitle: {
      fontSize: 13,
      color: '#888888',
      marginTop: 2,
    },

    liveStatus: {
      fontSize: 13,
      fontWeight: '800',
    },

    capacityRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 18,
    },

    capacityValue: {
      fontSize: 38,
      fontWeight: 'bold',
    },

    capacityLabel: {
      fontSize: 14,
      color: '#888888',
      marginLeft: 8,
    },

    progressBackground: {
      height: 12,
      borderRadius: 8,
      backgroundColor: '#E4E4E4',
      overflow: 'hidden',
      marginTop: 10,
    },

    progressFill: {
      height: '100%',
      borderRadius: 8,
    },

    /*
     * SENSOR INFO
     */

    sensorInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 14,
    },

    sensorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    sensorInfoText: {
      fontSize: 13,
      color: '#555555',
    },

    /*
     * LOCATION + LAST UPDATED
     */

    detailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 18,
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: '#F0F0F0',
    },

    detailItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
    },

    detailTextContainer: {
      flex: 1,
    },

    detailLabel: {
      fontSize: 12,
      color: '#888888',
      marginBottom: 3,
    },

    detailValue: {
      fontSize: 13,
      color: '#555555',
      lineHeight: 18,
    },

    /*
     * STATISTICS
     */

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

    label: {
      fontSize: 12,
      color: '#888888',
    },

    statValue: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#1B5E20',
      marginTop: 4,
    },

    /*
     * GENERAL CARD
     */

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

    /*
     * CHART
     */

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

    /*
     * CAMERA
     */

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

    /*
     * MEASUREMENTS
     */

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

    /*
     * ALERTS
     */

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