import { Ionicons } from '@expo/vector-icons';

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

import BinMonitor from '../components/BinMonitor';
import BottomNav from '../components/BottomNav';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';


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

  const [monitorReloadKey, setMonitorReloadKey] =
    useState(0);


  /*
   * =====================================================
   * TRACK NOTIFIED BINS
   * =====================================================
   *
   * Prevents the same bin from repeatedly creating
   * notifications while it remains at 90% or higher.
   */

  const notifiedBins =
    useRef<Record<number, boolean>>({});


  /*
   * =====================================================
   * CREATE IN-APP NOTIFICATION
   * =====================================================
   *
   * This is NOT a push notification.
   *
   * It simply creates a record in the Supabase
   * notification table so it can appear inside
   * the OmniBin Notifications page.
   */

  const checkBinNotification =
    useCallback(
      async (bin: Bin) => {

        const level =
          Number(
            bin.current_level
          ) || 0;


        /*
         * -------------------------------------------------
         * BIN BELOW 90%
         * -------------------------------------------------
         *
         * Reset the trigger so the bin can create another
         * notification if it reaches 90% again later.
         */

        if (level < 90) {

          notifiedBins.current[
            bin.bin_id
          ] = false;

          return;
        }


        /*
         * -------------------------------------------------
         * ALREADY NOTIFIED
         * -------------------------------------------------
         */

        if (
          notifiedBins.current[
            bin.bin_id
          ]
        ) {

          return;
        }


        /*
         * Mark immediately to prevent duplicate inserts
         * if multiple realtime updates happen quickly.
         */

        notifiedBins.current[
          bin.bin_id
        ] = true;


        try {

          /*
           * -------------------------------------------------
           * CHECK EXISTING LATEST NOTIFICATION
           * -------------------------------------------------
           *
           * This helps prevent duplicate notification records
           * if the dashboard is reopened while the same bin
           * is still full.
           */

          const {
            data: latestNotification,
            error: latestNotificationError,
          } =
            await supabase
              .from('notification')
              .select(
                'notif_id, created_at'
              )
              .eq(
                'bin_id',
                bin.bin_id
              )
              .eq(
                'message',
                'Bin requires collection.'
              )
              .order(
                'created_at',
                {
                  ascending: false,
                }
              )
              .limit(1)
              .maybeSingle();


          if (
            latestNotificationError
          ) {

            console.error(
              'ERROR CHECKING EXISTING NOTIFICATION:',
              latestNotificationError.message
            );

            /*
             * Allow another attempt later.
             */

            notifiedBins.current[
              bin.bin_id
            ] = false;

            return;
          }


          /*
           * -------------------------------------------------
           * A RECENT NOTIFICATION ALREADY EXISTS
           * -------------------------------------------------
           *
           * If the latest notification was created after
           * the bin's latest update, there is no need to
           * create another one.
           */

          if (
            latestNotification &&
            bin.updated_at
          ) {

            const notificationTime =
              new Date(
                latestNotification.created_at
              ).getTime();

            const binUpdateTime =
              new Date(
                bin.updated_at
              ).getTime();


            if (
              notificationTime >=
              binUpdateTime
            ) {

              console.log(
                'NOTIFICATION ALREADY EXISTS FOR BIN:',
                bin.bin_id
              );

              return;
            }
          }


          /*
           * -------------------------------------------------
           * CREATE IN-APP NOTIFICATION
           * -------------------------------------------------
           */

          const {
            error,
          } =
            await supabase
              .from('notification')
              .insert({
                bin_id:
                  bin.bin_id,

                message:
                  'Bin requires collection.',

                is_read:
                  false,
              });


          if (error) {

            console.error(
              'ERROR CREATING IN-APP NOTIFICATION:',
              error.message
            );

            /*
             * Allow retry if the insert failed.
             */

            notifiedBins.current[
              bin.bin_id
            ] = false;

            return;
          }


          console.log(
            'IN-APP NOTIFICATION CREATED FOR BIN:',
            bin.bin_id
          );


        } catch (error) {

          console.error(
            'UNEXPECTED NOTIFICATION ERROR:',
            error
          );


          /*
           * Allow retry after an unexpected error.
           */

          notifiedBins.current[
            bin.bin_id
          ] = false;
        }

      },
      []
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


          const fetchedBins =
            (data || []) as Bin[];


          setBins(
            fetchedBins
          );


          /*
           * Check every bin for the
           * 90% notification threshold.
           */

          for (
            const bin of fetchedBins
          ) {

            await checkBinNotification(
              bin
            );

          }


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

    void fetchBins();

  }, [
    fetchBins,
  ]);


  /*
   * =====================================================
   * REALTIME BIN UPDATES
   * =====================================================
   */

  useEffect(() => {

    let cancelled =
      false;


    const setupRealtime =
      async () => {

        const channelName =
          'omnibin-bins';


        console.log(
          'SETTING UP BIN REALTIME...'
        );


        /*
         * -------------------------------------------------
         * REMOVE EXISTING CHANNEL
         * -------------------------------------------------
         */

        const existingChannels =
          supabase.getChannels();


        const existingChannel =
          existingChannels.find(
            (channel) =>
              channel.topic ===
              `realtime:${channelName}`
          );


        if (existingChannel) {

          console.log(
            'REMOVING EXISTING BIN REALTIME CHANNEL...'
          );


          await supabase.removeChannel(
            existingChannel
          );

        }


        /*
         * Stop if component was unmounted.
         */

        if (cancelled) {

          return null;

        }


        /*
         * -------------------------------------------------
         * CREATE CHANNEL
         * -------------------------------------------------
         */

        const channel =
          supabase.channel(
            channelName
          );


        /*
         * -------------------------------------------------
         * ADD REALTIME LISTENER
         * -------------------------------------------------
         *
         * IMPORTANT:
         * Listener is added BEFORE subscribe().
         */

        channel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bins',
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
             * Convert updated record
             * into a Bin object.
             */

            const updatedBin =
              payload.new as Bin;


            /*
             * Check the 90% threshold.
             */

            void checkBinNotification(
              updatedBin
            );


            /*
             * Refresh dashboard data.
             */

            void fetchBins();

          }
        );


        /*
         * -------------------------------------------------
         * SUBSCRIBE
         * -------------------------------------------------
         */

        channel.subscribe(
          (status) => {

            console.log(
              'REALTIME STATUS:',
              status
            );


            if (
              status ===
              'SUBSCRIBED'
            ) {

              console.log(
                'REALTIME CONNECTED SUCCESSFULLY'
              );

            }


            if (
              status ===
              'CHANNEL_ERROR'
            ) {

              console.error(
                'REALTIME CHANNEL ERROR'
              );

            }


            if (
              status ===
              'TIMED_OUT'
            ) {

              console.error(
                'REALTIME CONNECTION TIMED OUT'
              );

            }


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
     * -------------------------------------------------
     * SETUP CHANNEL
     * -------------------------------------------------
     */

    let realtimeChannel:
      ReturnType<
        typeof supabase.channel
      > | null = null;


    void setupRealtime().then(
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
     * -------------------------------------------------
     * CLEANUP
     * -------------------------------------------------
     */

    return () => {

      cancelled = true;


      if (
        realtimeChannel
      ) {

        console.log(
          'REMOVING BIN REALTIME CHANNEL...'
        );


        void supabase.removeChannel(
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


      setMonitorReloadKey(
        (key) =>
          key + 1
      );


      void fetchBins();

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
              Live fill, camera
              confirmation, and the
              status of every bin.
            </Text>

          </View>


          <BinMonitor
            reloadKey={
              monitorReloadKey
            }
          />


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

      backgroundColor:
        '#FFFFFF',

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

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

    },


    binTitleContainer: {

      flexDirection:
        'row',

      alignItems:
        'center',

      flex: 1,

    },


    binIcon: {

      width: 42,

      height: 42,

      borderRadius: 21,

      alignItems:
        'center',

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

      flexDirection:
        'row',

      alignItems:
        'baseline',

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

      backgroundColor:
        '#E5E5E5',

      borderRadius: 10,

      marginTop: 10,

      overflow: 'hidden',

    },


    progress: {

      height: '100%',

      borderRadius: 10,

    },


    infoRow: {

      flexDirection:
        'row',

      alignItems:
        'center',

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

      alignItems:
        'center',

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

      alignItems:
        'center',

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