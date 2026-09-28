import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BottomNav from '../components/BottomNav';
import Header from '../components/Header';

import {
  registerForPushNotifications,
} from '../lib/notifications';

import { supabase } from '../lib/supabase';

/*
 * =====================================================
 * NOTIFICATION HANDLER
 * =====================================================
 *
 * Allows notifications to appear while the app
 * is currently open.
 *
 * =====================================================
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/*
 * =====================================================
 * BIN TYPE
 * =====================================================
 */

type Bin = {
  bin_id: number;
  name: string;
  waste_type: string;
  current_level: number;
  status: string;
  location: string;
  updated_at: string;
};

/*
 * =====================================================
 * DASHBOARD
 * =====================================================
 */

export default function Dashboard() {

  const [bins, setBins] =
    useState<Bin[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  /*
   * =====================================================
   * TRACK NOTIFIED BINS
   * =====================================================
   *
   * Prevents repeated notifications while a bin
   * remains at 90% or higher.
   *
   * =====================================================
   */

  const notifiedBins =
    useRef<Record<number, boolean>>({});

  /*
   * =====================================================
   * REGISTER PUSH NOTIFICATIONS
   * =====================================================
   */

  useEffect(() => {

    console.log(
      'STARTING PUSH NOTIFICATION REGISTRATION...'
    );

    registerForPushNotifications();

  }, []);

  /*
   * =====================================================
   * SEND BIN NOTIFICATION
   * =====================================================
   */

  const sendBinNotification =
    useCallback(
      async (bin: Bin) => {

        try {

          console.log(
            '================================='
          );

          console.log(
            'SENDING BIN NOTIFICATION'
          );

          console.log(
            'BIN:',
            bin.name
          );

          console.log(
            'LEVEL:',
            bin.current_level
          );

          /*
           * ---------------------------------------------
           * CREATE LOCAL ANDROID NOTIFICATION
           * ---------------------------------------------
           */

          await Notifications.scheduleNotificationAsync({

            content: {

              title:
                'OmniBin Alert',

              body:
                `${bin.waste_type} bin has reached ` +
                `${bin.current_level}%. ` +
                `Please collect bin now.`,

              sound:
                'omnibin_alert',

              data: {

                bin_id:
                  bin.bin_id,

                waste_type:
                  bin.waste_type,

                level:
                  bin.current_level,
              },

            },

            /*
             * null = send immediately
             */

            trigger: null,

          });

          console.log(
            'BIN NOTIFICATION SENT:',
            bin.name
          );

          console.log(
            '================================='
          );

        } catch (error) {

          console.error(
            'NOTIFICATION ERROR:',
            error
          );

        }
      },

      []
    );

  /*
   * =====================================================
   * CHECK BIN NOTIFICATION
   * =====================================================
   */

  const checkBinNotification =
    useCallback(
      (bin: Bin) => {

        console.log(
          'CHECKING BIN NOTIFICATION:',
          bin.name,
          bin.current_level
        );

        /*
         * ---------------------------------------------
         * BIN REACHED 90%
         * ---------------------------------------------
         */

        if (
          bin.current_level >= 90
        ) {

          console.log(
            'BIN REACHED 90%:',
            bin.name
          );

          /*
           * -------------------------------------------
           * ONLY SEND ONCE
           * -------------------------------------------
           */

          if (
            !notifiedBins.current[
              bin.bin_id
            ]
          ) {

            console.log(
              'SENDING NOTIFICATION:',
              bin.name
            );

            /*
             * Mark as notified BEFORE sending
             * to prevent duplicate notifications.
             */

            notifiedBins.current[
              bin.bin_id
            ] = true;

            sendBinNotification(
              bin
            );

          } else {

            console.log(
              'NOTIFICATION ALREADY SENT:',
              bin.name
            );

          }

          return;
        }

        /*
         * ---------------------------------------------
         * BIN DROPPED BELOW 90%
         * ---------------------------------------------
         *
         * Reset the notification state.
         *
         * This allows another notification when
         * the bin reaches 90% again.
         *
         * ---------------------------------------------
         */

        if (
          bin.current_level < 90
        ) {

          notifiedBins.current[
            bin.bin_id
          ] = false;

        }

      },

      [
        sendBinNotification,
      ]
    );

  /*
   * =====================================================
   * FETCH BINS
   * =====================================================
   */

  const fetchBins =
    useCallback(
      async () => {

        try {

          const {
            data,
            error,
          } =
            await supabase
              .from('bins')
              .select('*')
              .order(
                'current_level',
                {
                  ascending: false,
                }
              );

          /*
           * -------------------------------------------
           * DATABASE ERROR
           * -------------------------------------------
           */

          if (error) {

            console.error(
              'ERROR FETCHING BINS:',
              error.message
            );

            setBins([]);

            return;
          }

          console.log(
            'BINS FETCHED:',
            data
          );

          /*
           * -------------------------------------------
           * CONVERT DATA
           * -------------------------------------------
           */

          const fetchedBins =
            (data || []) as Bin[];

          setBins(
            fetchedBins
          );

          /*
           * -------------------------------------------
           * CHECK EVERY BIN
           * -------------------------------------------
           */

          fetchedBins.forEach(
            (bin) => {

              checkBinNotification(
                bin
              );

            }
          );

        } catch (error) {

          console.error(
            'UNEXPECTED FETCH ERROR:',
            error
          );

          setBins([]);

        } finally {

          setLoading(false);

          setRefreshing(false);

        }
      },

      [
        checkBinNotification,
      ]
    );

  /*
   * =====================================================
   * INITIAL DATA FETCH
   * =====================================================
   */

  useEffect(() => {

    fetchBins();

  }, [
    fetchBins,
  ]);

  /*
   * =====================================================
   * REALTIME BIN UPDATES
   * =====================================================
   */

  useEffect(() => {

    let cancelled = false;

    const setupRealtime =
      async () => {

        const channelName =
          'omnibin-bins';

        console.log(
          'SETTING UP BIN REALTIME...'
        );

        /*
         * ---------------------------------------------
         * REMOVE EXISTING CHANNEL
         * ---------------------------------------------
         */

        const existingChannels =
          supabase.getChannels();

        const existingChannel =
          existingChannels.find(
            (channel) =>
              channel.topic ===
              `realtime:${channelName}`
          );

        if (
          existingChannel
        ) {

          console.log(
            'REMOVING EXISTING BIN REALTIME CHANNEL...'
          );

          await supabase.removeChannel(
            existingChannel
          );

        }

        /*
         * ---------------------------------------------
         * CHECK CANCELLATION
         * ---------------------------------------------
         */

        if (
          cancelled
        ) {

          return null;

        }

        /*
         * ---------------------------------------------
         * CREATE CHANNEL
         * ---------------------------------------------
         */

        const channel =
          supabase.channel(
            channelName
          );

        /*
         * ---------------------------------------------
         * ADD REALTIME LISTENER
         * ---------------------------------------------
         *
         * IMPORTANT:
         *
         * The listener MUST be added
         * before subscribe().
         *
         * ---------------------------------------------
         */

        channel.on(
          'postgres_changes',

          {
            event:
              'UPDATE',

            schema:
              'public',

            table:
              'bins',

          },

          (payload) => {

            console.log(
              '================================='
            );

            console.log(
              'BIN REALTIME UPDATE'
            );

            console.log(
              'OLD DATA:',
              payload.old
            );

            console.log(
              'NEW DATA:',
              payload.new
            );

            console.log(
              '================================='
            );

            /*
             * -----------------------------------------
             * CONVERT UPDATED BIN
             * -----------------------------------------
             */

            const updatedBin =
              payload.new as Bin;

            /*
             * -----------------------------------------
             * CHECK NOTIFICATION
             * -----------------------------------------
             */

            checkBinNotification(
              updatedBin
            );

            /*
             * -----------------------------------------
             * REFRESH DASHBOARD
             * -----------------------------------------
             */

            fetchBins();

          }
        );

        /*
         * ---------------------------------------------
         * SUBSCRIBE
         * ---------------------------------------------
         */

        channel.subscribe(
          (status) => {

            console.log(
              'REALTIME STATUS:',
              status
            );

            /*
             * -----------------------------------------
             * CONNECTED
             * -----------------------------------------
             */

            if (
              status ===
              'SUBSCRIBED'
            ) {

              console.log(
                'REALTIME CONNECTED SUCCESSFULLY'
              );

            }

            /*
             * -----------------------------------------
             * ERROR
             * -----------------------------------------
             */

            if (
              status ===
              'CHANNEL_ERROR'
            ) {

              console.error(
                'REALTIME CHANNEL ERROR'
              );

            }

            /*
             * -----------------------------------------
             * TIMEOUT
             * -----------------------------------------
             */

            if (
              status ===
              'TIMED_OUT'
            ) {

              console.error(
                'REALTIME CONNECTION TIMED OUT'
              );

            }

            /*
             * -----------------------------------------
             * CLOSED
             * -----------------------------------------
             */

            if (
              status ===
              'CLOSED'
            ) {

              console.log(
                'REALTIME CHANNEL CLOSED'
              );

            }

          }
        );

        return channel;

      };

    /*
     * =================================================
     * SETUP CHANNEL
     * =================================================
     */

    let realtimeChannel:
      ReturnType<
        typeof supabase.channel
      > | null = null;

    setupRealtime()
      .then(
        (channel) => {

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

    /*
     * =================================================
     * CLEANUP
     * =================================================
     */

    return () => {

      cancelled = true;

      if (
        realtimeChannel
      ) {

        console.log(
          'REMOVING BIN REALTIME CHANNEL...'
        );

        supabase.removeChannel(
          realtimeChannel
        );

        realtimeChannel =
          null;

      }

    };

  }, [
    fetchBins,
    checkBinNotification,
  ]);

  /*
   * =====================================================
   * PULL TO REFRESH
   * =====================================================
   */

  const onRefresh =
    () => {

      setRefreshing(
        true
      );

      fetchBins();

    };

  /*
   * =====================================================
   * DETERMINE STATUS
   * =====================================================
   */

  const getStatus =
    (
      level: number
    ) => {

      if (
        level >= 90
      ) {

        return 'FULL';

      }

      if (
        level >= 50
      ) {

        return 'HALF FULL';

      }

      return 'AVAILABLE';

    };

  /*
   * =====================================================
   * DETERMINE STATUS COLOR
   * =====================================================
   */

  const getStatusColor =
    (
      level: number
    ) => {

      if (
        level >= 90
      ) {

        return '#C62828';

      }

      if (
        level >= 50
      ) {

        return '#F9A825';

      }

      return '#2E7D32';

    };

  /*
   * =====================================================
   * DETERMINE WASTE ICON
   * =====================================================
   */

  const getWasteIcon =
    (
      wasteType: string
    ) => {

      const type =
        wasteType
          .toLowerCase()
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

        return 'recycle-outline';

      }

      return 'trash-bin-outline';

    };

  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (

    <View
      style={
        styles.screen
      }
    >

      <View
        style={
          styles.container
        }
      >

        <ScrollView

          contentContainerStyle={
            styles.content
          }

          refreshControl={

            <RefreshControl

              refreshing={
                refreshing
              }

              onRefresh={
                onRefresh
              }

            />

          }

          showsVerticalScrollIndicator={
            false
          }

        >

          {/* HEADER */}

          <Header
            title="OmniBin"
            subtitle="Smart Waste Management System"
          />

          {/* WELCOME */}

          <View
            style={
              styles.welcome
            }
          >

            <Text
              style={
                styles.welcomeTitle
              }
            >
              Dashboard
            </Text>

            <Text
              style={
                styles.welcomeText
              }
            >
              Monitor the current
              status of all waste
              bins.
            </Text>

          </View>

          {/* LOADING */}

          {loading ? (

            <ActivityIndicator

              size="large"

              color="#1B5E20"

              style={
                styles.loading
              }

            />

          ) : bins.length === 0 ? (

            /* EMPTY STATE */

            <View
              style={
                styles.emptyContainer
              }
            >

              <View
                style={
                  styles.emptyIcon
                }
              >

                <Ionicons

                  name="trash-outline"

                  size={30}

                  color="#8A8A8A"

                />

              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No Bin Data
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                There is currently
                no waste bin
                information
                available.
              </Text>

            </View>

          ) : (

            /* BIN LIST */

            <View>

              {bins.map(
                (bin) => {

                  const status =
                    getStatus(
                      bin.current_level
                    );

                  const statusColor =
                    getStatusColor(
                      bin.current_level
                    );

                  return (

                    <View

                      key={
                        bin.bin_id
                      }

                      style={
                        styles.card
                      }

                    >

                      {/* CARD HEADER */}

                      <View
                        style={
                          styles.cardHeader
                        }
                      >

                        <View
                          style={
                            styles.binTitleContainer
                          }
                        >

                          {/* WASTE ICON */}

                          <View
                            style={[
                              styles.binIcon,
                              {
                                backgroundColor:
                                  bin.current_level >=
                                  90
                                    ? '#FFEBEE'
                                    : '#E8F5E9',
                              },
                            ]}
                          >

                            <Ionicons

                              name={
                                getWasteIcon(
                                  bin.waste_type
                                ) as any
                              }

                              size={21}

                              color={
                                statusColor
                              }

                            />

                          </View>

                          {/* BIN INFORMATION */}

                          <View>

                            <Text
                              style={
                                styles.binName
                              }
                            >
                              {
                                bin.waste_type
                              }
                            </Text>

                            <Text
                              style={
                                styles.binIdentifier
                              }
                            >
                              {
                                bin.name
                              }
                            </Text>

                          </View>

                        </View>

                        {/* STATUS */}

                        <Text
                          style={[
                            styles.status,
                            {
                              color:
                                statusColor,
                            },
                          ]}
                        >
                          {
                            status
                          }
                        </Text>

                      </View>

                      {/* LEVEL */}

                      <View
                        style={
                          styles.levelRow
                        }
                      >

                        <Text
                          style={[
                            styles.level,
                            {
                              color:
                                statusColor,
                            },
                          ]}
                        >
                          {
                            bin.current_level
                          }%
                        </Text>

                        <Text
                          style={
                            styles.capacityText
                          }
                        >
                          Capacity
                        </Text>

                      </View>

                      {/* PROGRESS BAR */}

                      <View
                        style={
                          styles.progressBackground
                        }
                      >

                        <View
                          style={[
                            styles.progress,
                            {
                              width: `${Math.min(
                                Math.max(
                                  bin.current_level,
                                  0
                                ),
                                100
                              )}%`,

                              backgroundColor:
                                statusColor,
                            },
                          ]}
                        />

                      </View>

                      {/* LOCATION */}

                      <View
                        style={
                          styles.infoRow
                        }
                      >

                        <Ionicons

                          name="location-outline"

                          size={16}

                          color="#777777"

                        />

                        <Text
                          style={
                            styles.location
                          }
                        >
                          {
                            bin.location
                          }
                        </Text>

                      </View>

                      {/* LAST UPDATED */}

                      <View
                        style={
                          styles.infoRow
                        }
                      >

                        <Ionicons

                          name="time-outline"

                          size={15}

                          color="#999999"

                        />

                        <Text
                          style={
                            styles.updated
                          }
                        >
                          Last updated:{' '}

                          {bin.updated_at

                            ? new Date(
                                bin.updated_at
                              ).toLocaleString()

                            : 'N/A'}

                        </Text>

                      </View>

                    </View>

                  );

                }
              )}

            </View>

          )}

        </ScrollView>

        {/* BOTTOM NAVIGATION */}

        <BottomNav />

      </View>

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

    screen: {
      flex: 1,
      backgroundColor:
        '#F5F7F5',
    },

    container: {
      flex: 1,
      backgroundColor:
        '#F5F7F5',
    },

    content: {
      paddingBottom: 100,
    },

    welcome: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 12,
    },

    welcomeTitle: {
      fontSize: 25,
      fontWeight: 'bold',
      color: '#222222',
    },

    welcomeText: {
      color: '#666666',
      marginTop: 5,
      fontSize: 14,
      lineHeight: 20,
    },

    loading: {
      marginTop: 45,
    },

    card: {
      backgroundColor: '#FFFFFF',
      marginHorizontal: 20,
      marginVertical: 8,
      padding: 20,
      borderRadius: 16,

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.05,
      shadowRadius: 4,

      elevation: 2,
    },

    cardHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    binTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },

    binIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,

      alignItems: 'center',
      justifyContent:
        'center',

      marginRight: 12,
    },

    binName: {
      fontSize: 17,
      fontWeight: 'bold',
      color: '#222222',
    },

    binIdentifier: {
      fontSize: 12,
      color: '#888888',
      marginTop: 2,
    },

    status: {
      fontSize: 11,
      fontWeight: 'bold',
    },

    levelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 15,
    },

    level: {
      fontSize: 32,
      fontWeight: 'bold',
    },

    capacityText: {
      fontSize: 12,
      color: '#999999',
      marginLeft: 7,
    },

    progressBackground: {
      height: 10,
      backgroundColor: '#E5E5E5',
      borderRadius: 10,
      marginTop: 10,
      overflow: 'hidden',
    },

    progress: {
      height: '100%',
      borderRadius: 10,
    },

    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
    },

    location: {
      color: '#666666',
      fontSize: 13,
      marginLeft: 6,
    },

    updated: {
      color: '#999999',
      fontSize: 11,
      marginLeft: 6,
    },

    emptyContainer: {
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 30,
      paddingTop: 75,
    },

    emptyIcon: {
      width: 65,
      height: 65,
      borderRadius: 33,

      backgroundColor:
        '#E8ECE8',

      alignItems: 'center',
      justifyContent:
        'center',

      marginBottom: 15,
    },

    emptyTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#333333',
    },

    emptyText: {
      fontSize: 14,
      color: '#888888',
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },

  });