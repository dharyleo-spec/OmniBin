import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BottomNav from '../components/BottomNav';
import Header from '../components/Header';

import {
  FULL_PERCENT,
  fetchMonitorState,
  type MonitorState
} from '../lib/binMonitor';

type IoniconName =
  keyof typeof Ionicons.glyphMap;

function formatDate(
  iso: string | undefined
) {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/*
 * =====================================================
 * LEVEL COLOR
 * =====================================================
 *
 * 0–49   = Green
 * 50–84  = Yellow
 * 85–100 = Red
 *
 */

function getLevelColor(
  level: number
) {
  if (level >= 85) {
    return '#C62828';
  }

  if (level >= 50) {
    return '#F9A825';
  }

  return '#2E7D32';
}

export default function Notifications() {

  const [state, setState] =
    useState<MonitorState | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [
    selectedNotification,
    setSelectedNotification,
  ] = useState(false);

  const [
    notificationRead,
    setNotificationRead,
  ] = useState(false);

  /*
   * =====================================================
   * FETCH LIVE TRASHCAN STATE
   * =====================================================
   *
   * IMPORTANT:
   * This uses the EXACT SAME data source as BinMonitor.
   *
   * There is NO bins table here.
   * There is NO notification table here.
   *
   * The HC-SR04 reading is the source of truth.
   */

  const loadNotifications =
    useCallback(async () => {

      try {

        const next =
          await fetchMonitorState();

        setState(next);
        setError('');

      } catch (loadError) {

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Could not load the live trashcan.';

        console.error(
          'NOTIFICATION FETCH ERROR:',
          message
        );

        setError(message);

      } finally {

        setLoading(false);

      }

    }, []);

  /*
   * =====================================================
   * LOAD WHEN SCREEN OPENS
   * =====================================================
   */

  useFocusEffect(
    useCallback(() => {

      setLoading(true);

      loadNotifications();

    }, [loadNotifications])
  );

  /*
   * =====================================================
   * REALTIME HC-SR04 / CAMERA UPDATES
   * =====================================================
   *
   * This is the SAME realtime source used by BinMonitor.
   *
   * When a new reading arrives, the notification screen
   * immediately checks the latest HC-SR04 measurement.
   */

  useEffect(() => {

    let cancelled = false;

    const setupRealtime =
      async () => {

        const channelName =
          'omnibin-notifications';

        /*
         * Remove an existing channel with
         * the same name first.
         */

        const existing =
          // @ts-ignore
          undefined;

        /*
         * Create realtime channel.
         */

        const channel =
          require('../lib/supabase')
            .supabase
            .channel(channelName);

        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'readings',
          },
          () => {

            if (!cancelled) {
              loadNotifications();
            }

          }
        );

        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'camera_checks',
          },
          () => {

            if (!cancelled) {
              loadNotifications();
            }

          }
        );

        channel.subscribe();

        return channel;
      };

    let realtimeChannel:
      ReturnType<
        typeof import('../lib/supabase').supabase.channel
      > | null = null;

    setupRealtime().then(
      (channel) => {

        if (
          channel &&
          !cancelled
        ) {

          realtimeChannel =
            channel;

        } else if (channel) {

          require('../lib/supabase')
            .supabase
            .removeChannel(
              channel
            );

        }

      }
    );

    return () => {

      cancelled = true;

      if (realtimeChannel) {

        require('../lib/supabase')
          .supabase
          .removeChannel(
            realtimeChannel
          );

      }

    };

  }, [loadNotifications]);

  /*
   * =====================================================
   * CURRENT HC-SR04 DATA
   * =====================================================
   */

  const sensor =
    state?.sensor ?? null;

  /*
   * =====================================================
   * CURRENT LEVEL COLOR
   * =====================================================
   */

  const currentLevel =
    sensor?.fill_percent ?? 0;

  const currentLevelColor =
    getLevelColor(
      currentLevel
    );

  /*
   * =====================================================
   * ACTIVE NOTIFICATION
   * =====================================================
   *
   * ONLY the HC-SR04 full state creates the notification.
   *
   * Therefore:
   *
   * HC-SR04 = 0%
   *      ↓
   * No notification
   *
   * HC-SR04 = FULL_PERCENT or higher
   *      ↓
   * Collection notification
   *
   * This keeps Notifications consistent with the
   * Live Trashcan card on Dashboard.
   */

  const isFull =
    sensor?.is_full === true;

  /*
   * If the bin becomes not full again,
   * reset the local read state.
   */

  useEffect(() => {

    if (!isFull) {

      setNotificationRead(false);
      setSelectedNotification(false);

    }

  }, [isFull]);

  /*
   * =====================================================
   * OPEN NOTIFICATION
   * =====================================================
   */

  const openNotification =
    () => {

      setSelectedNotification(
        true
      );

      setNotificationRead(
        true
      );

    };

  /*
   * =====================================================
   * CLOSE MODAL
   * =====================================================
   */

  const closeModal =
    () => {

      setSelectedNotification(
        false
      );

    };

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (
    loading &&
    !state
  ) {

    return (

      <View
        style={
          styles.container
        }
      >

        <Header
          title="Notifications"
          subtitle="Bin collection alerts"
        />

        <View
          style={
            styles.loadingContainer
          }
        >

          <ActivityIndicator
            size="large"
            color="#537B2F"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Checking live trashcan...
          </Text>

        </View>

        <BottomNav />

      </View>

    );

  }

  /*
   * =====================================================
   * ERROR
   * =====================================================
   */

  if (
    error &&
    !state
  ) {

    return (

      <View
        style={
          styles.container
        }
      >

        <Header
          title="Notifications"
          subtitle="Bin collection alerts"
        />

        <View
          style={
            styles.errorContainer
          }
        >

          <View
            style={
              styles.errorIconContainer
            }
          >

            <Ionicons
              name="alert-circle-outline"
              size={42}
              color="#C62828"
            />

          </View>

          <Text
            style={
              styles.emptyTitle
            }
          >
            Unable to Load
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            The live trashcan data could not
            be loaded.
          </Text>

          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>

        </View>

        <BottomNav />

      </View>

    );

  }

  /*
   * =====================================================
   * MAIN UI
   * =====================================================
   */

  return (

    <View
      style={
        styles.container
      }
    >

      {/* HEADER */}

      <Header
        title="Notifications"
        subtitle="Bin collection alerts"
      />

      <ScrollView
        style={
          styles.scrollView
        }
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >

        {/*
         * =================================================
         * NO ACTIVE NOTIFICATION
         * =================================================
         */}

        {!isFull ? (

          <View
            style={
              styles.emptyContainer
            }
          >

            <View
              style={
                styles.emptyIconContainer
              }
            >

              <Ionicons
                name="checkmark-circle-outline"
                size={42}
                color="#537B2F"
              />

            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No Notifications
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              The live trashcan does not
              currently require collection.
            </Text>

            {sensor && (

              <View
                style={
                  styles.currentState
                }
              >

                <Text
                  style={
                    styles.currentStateLabel
                  }
                >
                  Current HC-SR04 level
                </Text>

                <Text
                  style={[
                    styles.currentStateValue,
                    {
                      color:
                        currentLevelColor,
                    },
                  ]}
                >
                  {sensor.fill_percent}%
                </Text>

                <Text
                  style={
                    styles.currentStateDistance
                  }
                >
                  {sensor.distance_cm === null
                    ? 'Distance unavailable'
                    : `${sensor.distance_cm} cm from sensor`}
                </Text>

              </View>

            )}

          </View>

        ) : (

          /*
           * =================================================
           * ACTIVE COLLECTION NOTIFICATION
           * =================================================
           */

          <Pressable
            style={[
              styles.notificationCard,

              !notificationRead &&
                styles.unreadCard,
            ]}
            onPress={
              openNotification
            }
          >

            {/* ALERT ICON */}

            <View
              style={
                styles.alertIconContainer
              }
            >

              <Ionicons
                name="alert"
                size={24}
                color="#C62828"
              />

            </View>

            {/* CONTENT */}

            <View
              style={
                styles.notificationContent
              }
            >

              <View
                style={
                  styles.titleRow
                }
              >

                <View
                  style={
                    styles.titleContainer
                  }
                >

                  <Text
                    style={
                      styles.notificationTitle
                    }
                  >
                    Live Trashcan
                  </Text>

                  <Text
                    style={
                      styles.notificationSubtitle
                    }
                  >
                    HC-SR04 monitored
                  </Text>

                </View>

                {!notificationRead && (

                  <View
                    style={
                      styles.unreadDot
                    }
                  />

                )}

              </View>

              <Text
                style={
                  styles.notificationMessage
                }
              >
                The trashcan requires
                collection.
              </Text>

              <Text
                style={[
                  styles.currentLevelText,
                  {
                    color:
                      currentLevelColor,
                  },
                ]}
              >
                Current level:{' '}
                {sensor?.fill_percent ?? 0}%
              </Text>

              {sensor?.distance_cm !==
                null &&
                sensor?.distance_cm !==
                  undefined && (

                  <Text
                    style={
                      styles.distanceText
                    }
                  >
                    HC-SR04:{' '}
                    {sensor.distance_cm} cm
                  </Text>

                )}

              <Text
                style={
                  styles.dateText
                }
              >
                {formatDate(
                  sensor?.updated_at
                )}
              </Text>

            </View>

          </Pressable>

        )}

      </ScrollView>

      {/* =================================================
          LIVE BIN INFORMATION MODAL
          ================================================= */}

      <Modal
        visible={
          selectedNotification
        }
        transparent
        animationType="fade"
        onRequestClose={
          closeModal
        }
      >

        <View
          style={
            styles.modalOverlay
          }
        >

          <View
            style={
              styles.modalContainer
            }
          >

            {/* MODAL HEADER */}

            <View
              style={
                styles.modalHeader
              }
            >

              <View
                style={
                  styles.binIconContainer
                }
              >

                <Ionicons
                  name={
                    'trash-bin-outline' as IoniconName
                  }
                  size={28}
                  color="#C62828"
                />

              </View>

              <View
                style={
                  styles.modalTitleContainer
                }
              >

                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Live Trashcan
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Current HC-SR04 status
                </Text>

              </View>

            </View>

            {/* CURRENT LEVEL */}

            <View
              style={
                styles.infoRow
              }
            >

              <Text
                style={
                  styles.infoLabel
                }
              >
                Current Level
              </Text>

              <Text
                style={[
                  styles.infoValue,
                  styles.levelValue,
                  {
                    color:
                      currentLevelColor,
                  },
                ]}
              >
                {sensor?.fill_percent ?? 0}%
              </Text>

            </View>

            {/* DISTANCE */}

            <View
              style={
                styles.infoRow
              }
            >

              <Text
                style={
                  styles.infoLabel
                }
              >
                HC-SR04 Distance
              </Text>

              <Text
                style={
                  styles.infoValue
                }
              >
                {sensor?.distance_cm ===
                null ||
                sensor?.distance_cm ===
                  undefined
                  ? '—'
                  : `${sensor.distance_cm} cm`}
              </Text>

            </View>

            {/* STATUS */}

            <View
              style={
                styles.infoRow
              }
            >

              <Text
                style={
                  styles.infoLabel
                }
              >
                Status
              </Text>

              <Text
                style={[
                  styles.infoValue,
                  styles.statusValue,
                ]}
              >
                REQUIRES COLLECTION
              </Text>

            </View>

            {/* FULL THRESHOLD */}

            <View
              style={
                styles.infoRow
              }
            >

              <Text
                style={
                  styles.infoLabel
                }
              >
                Full Threshold
              </Text>

              <Text
                style={
                  styles.infoValue
                }
              >
                {FULL_PERCENT}%
              </Text>

            </View>

            {/* LAST UPDATED */}

            <View
              style={
                styles.infoRow
              }
            >

              <Text
                style={
                  styles.infoLabel
                }
              >
                Last Updated
              </Text>

              <Text
                style={
                  styles.infoValue
                }
              >
                {formatDate(
                  sensor?.updated_at
                )}
              </Text>

            </View>

            {/* CLOSE */}

            <Pressable
              style={
                styles.closeButton
              }
              onPress={
                closeModal
              }
            >

              <Text
                style={
                  styles.closeButtonText
                }
              >
                CLOSE
              </Text>

            </Pressable>

          </View>

        </View>

      </Modal>

      {/* BOTTOM NAVIGATION */}

      <BottomNav />

    </View>

  );
}

/*
 * ======================================================
 * STYLES
 * ======================================================
 */

const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      backgroundColor: '#F5F5F5',
    },

    scrollView: {
      flex: 1,
    },

    content: {
      padding: 20,
      paddingBottom: 110,
    },

    /*
     * ==================================================
     * NOTIFICATION CARD
     * ==================================================
     */

    notificationCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 20,
      marginBottom: 14,
      flexDirection: 'row',
      alignItems: 'flex-start',

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.08,
      shadowRadius: 6,

      elevation: 3,
    },

    unreadCard: {
      borderLeftWidth: 4,
      borderLeftColor: '#C62828',
    },

    alertIconContainer: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: '#FCEAEA',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },

    notificationContent: {
      flex: 1,
    },

    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },

    titleContainer: {
      flex: 1,
    },

    notificationTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#222222',
      marginBottom: 3,
    },

    notificationSubtitle: {
      fontSize: 13,
      color: '#888888',
    },

    unreadDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: '#C62828',
      marginTop: 5,
      marginLeft: 8,
    },

    notificationMessage: {
      fontSize: 14,
      color: '#555555',
      marginTop: 12,
      marginBottom: 10,
    },

    currentLevelText: {
      fontSize: 14,
      color: '#444444',
      marginBottom: 5,
    },

    distanceText: {
      fontSize: 13,
      color: '#666666',
      marginBottom: 5,
    },

    dateText: {
      fontSize: 12,
      color: '#888888',
    },

    /*
     * ==================================================
     * EMPTY STATE
     * ==================================================
     */

    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 100,
      paddingHorizontal: 30,
    },

    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#EAF2E6',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },

    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#333333',
      marginBottom: 8,
    },

    emptyText: {
      fontSize: 14,
      color: '#777777',
      textAlign: 'center',
      lineHeight: 20,
    },

    currentState: {
      width: '100%',
      marginTop: 24,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 18,
      alignItems: 'center',

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.06,
      shadowRadius: 5,

      elevation: 2,
    },

    currentStateLabel: {
      fontSize: 12,
      color: '#888888',
    },

    currentStateValue: {
      fontSize: 30,
      fontWeight: '700',
      color: '#2E7D32',
      marginTop: 4,
    },

    currentStateDistance: {
      fontSize: 13,
      color: '#777777',
      marginTop: 4,
    },

    /*
     * ==================================================
     * LOADING
     * ==================================================
     */

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 100,
    },

    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: '#777777',
    },

    /*
     * ==================================================
     * ERROR
     * ==================================================
     */

    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
      paddingBottom: 100,
    },

    errorIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#FCEAEA',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },

    errorText: {
      fontSize: 12,
      color: '#C62828',
      textAlign: 'center',
      marginTop: 12,
      lineHeight: 18,
    },

    /*
     * ==================================================
     * MODAL
     * ==================================================
     */

    modalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0, 0, 0, 0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },

    modalContainer: {
      width: '100%',
      maxWidth: 500,
      backgroundColor: '#FFFFFF',
      borderRadius: 22,
      padding: 26,

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 5,
      },

      shadowOpacity: 0.2,
      shadowRadius: 12,

      elevation: 8,
    },

    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 22,
    },

    binIconContainer: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: '#FCEAEA',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },

    modalTitleContainer: {
      flex: 1,
    },

    modalTitle: {
      fontSize: 23,
      fontWeight: '700',
      color: '#222222',
    },

    modalSubtitle: {
      fontSize: 13,
      color: '#888888',
      marginTop: 3,
    },

    /*
     * ==================================================
     * INFORMATION
     * ==================================================
     */

    infoRow: {
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: '#EEEEEE',
    },

    infoLabel: {
      fontSize: 13,
      color: '#888888',
      marginBottom: 5,
    },

    infoValue: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333333',
    },

    levelValue: {
      color: '#C62828',
    },

    statusValue: {
      color: '#C62828',
      fontWeight: '700',
    },

    /*
     * ==================================================
     * CLOSE
     * ==================================================
     */

    closeButton: {
      height: 50,
      backgroundColor: '#F1F1F1',
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
    },

    closeButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#444444',
    },

  });