import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BottomNav from '../components/BottomNav';
import { supabase } from '../lib/supabase';

type Bin = {
  bin_id: number;
  name: string;
  waste_type: string;
  current_level: number;
  status: string;
  location: string;
  updated_at: string;
};

type IoniconName = keyof typeof Ionicons.glyphMap;

export default function Dashboard() {
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /*
   * =====================================================
   * FETCH BINS
   * =====================================================
   */

  const fetchBins = useCallback(async () => {
    console.log('Fetching bins...');

    try {
      const {
        data,
        error,
      } = await supabase
        .from('bins')
        .select(
          'bin_id, name, waste_type, current_level, status, location, updated_at'
        )
        .order('current_level', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Error fetching bins:',
          error.message
        );

        setBins([]);
        return;
      }

      console.log(
        'Bins loaded:',
        data
      );

      setBins(
        (data || []).map((bin) => ({
          ...bin,
          current_level:
            Number(bin.current_level) || 0,
        }))
      );
    } catch (error) {
      console.error(
        'Unexpected fetch error:',
        error
      );

      setBins([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /*
   * =====================================================
   * INITIAL LOAD
   * =====================================================
   */

  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  /*
   * =====================================================
   * REALTIME BIN UPDATES
   * =====================================================
   *
   * IMPORTANT:
   * This channel is ONLY for Dashboard.
   */

  useEffect(() => {
    console.log(
      'Starting Dashboard realtime...'
    );

    const channel = supabase
      .channel(
        `dashboard-bins-${Date.now()}`
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bins',
        },
        (payload) => {
          console.log(
            'Dashboard realtime update:',
            payload
          );

          const updatedBin =
            payload.new as Partial<Bin>;

          if (
            updatedBin.bin_id ===
            undefined
          ) {
            return;
          }

          setBins((currentBins) => {
            const newBins =
              currentBins.map((bin) => {
                if (
                  bin.bin_id !==
                  updatedBin.bin_id
                ) {
                  return bin;
                }

                return {
                  ...bin,
                  ...updatedBin,
                  current_level:
                    Number(
                      updatedBin.current_level ??
                        bin.current_level
                    ),
                };
              });

            return [...newBins].sort(
              (a, b) =>
                Number(b.current_level) -
                Number(a.current_level)
            );
          });
        }
      );

    channel.subscribe((status) => {
      console.log(
        'Dashboard realtime status:',
        status
      );
    });

    return () => {
      console.log(
        'Stopping Dashboard realtime...'
      );

      supabase.removeChannel(channel);
    };
  }, []);

  /*
   * =====================================================
   * PULL TO REFRESH
   * =====================================================
   */

  const onRefresh = () => {
    setRefreshing(true);
    fetchBins();
  };

  /*
   * =====================================================
   * STATUS
   * =====================================================
   */

  const getStatus = (
    level: number
  ) => {
    if (level >= 90) {
      return 'FULL';
    }

    if (level >= 50) {
      return 'HALF FULL';
    }

    return 'AVAILABLE';
  };

  /*
   * =====================================================
   * STATUS COLOR
   * =====================================================
   */

  const getStatusColor = (
    level: number
  ) => {
    if (level >= 90) {
      return '#C62828';
    }

    if (level >= 50) {
      return '#F9A825';
    }

    return '#2E7D32';
  };

  /*
   * =====================================================
   * WASTE ICON
   * =====================================================
   */

  const getWasteIcon = (
    wasteType: string
  ): IoniconName => {
    const type =
      wasteType
        .toLowerCase()
        .trim();

    if (
      type === 'biodegradable'
    ) {
      return 'leaf-outline';
    }

    if (
      type === 'non-biodegradable'
    ) {
      return 'trash-bin-outline';
    }

    return 'trash-bin-outline';
  };

  /*
   * =====================================================
   * SCREEN
   * =====================================================
   */

  return (
    <View style={styles.screen}>
      <View style={styles.container}>

        <ScrollView
          contentContainerStyle={
            styles.content
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          showsVerticalScrollIndicator={
            false
          }
        >

          {/* HEADER */}

          <View style={styles.header}>
            <Text style={styles.title}>
              OmniBin
            </Text>

            <Text style={styles.subtitle}>
              Smart Waste Management System
            </Text>
          </View>

          {/* WELCOME */}

          <View style={styles.welcome}>
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
              Monitor the current status
              of all waste bins.
            </Text>
          </View>

          {/* LOADING */}

          {loading ? (
            <View
              style={
                styles.loadingContainer
              }
            >
              <ActivityIndicator
                size="large"
                color="#1B5E20"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                Loading bins...
              </Text>
            </View>

          ) : bins.length === 0 ? (

            /* EMPTY */

            <View
              style={
                styles.emptyContainer
              }
            >
              <View
                style={styles.emptyIcon}
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
                There is currently no waste
                bin information available.
              </Text>
            </View>

          ) : (

            /* BINS */

            <View>
              {bins.map((bin) => {
                const level =
                  Number(
                    bin.current_level
                  ) || 0;

                const status =
                  getStatus(level);

                const statusColor =
                  getStatusColor(level);

                return (
                  <View
                    key={bin.bin_id}
                    style={styles.card}
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

                        <View
                          style={[
                            styles.binIcon,
                            {
                              backgroundColor:
                                level >= 90
                                  ? '#FFEBEE'
                                  : '#E8F5E9',
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              getWasteIcon(
                                bin.waste_type
                              )
                            }
                            size={21}
                            color={
                              statusColor
                            }
                          />
                        </View>

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
                            {bin.name}
                          </Text>
                        </View>

                      </View>

                      <Text
                        style={[
                          styles.status,
                          {
                            color:
                              statusColor,
                          },
                        ]}
                      >
                        {status}
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
                        {level}%
                      </Text>

                      <Text
                        style={
                          styles.capacityText
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
                          styles.progress,
                          {
                            width: `${Math.min(
                              level,
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
                        {bin.location}
                      </Text>
                    </View>

                    {/* UPDATED */}

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
              })}
            </View>
          )}

        </ScrollView>

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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7F5',
  },

  container: {
    flex: 1,
    backgroundColor: '#F5F7F5',
  },

  content: {
    paddingBottom: 100,
  },

  header: {
    backgroundColor: '#1B5E20',
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 24,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
  },

  subtitle: {
    color: '#DDEBDD',
    fontSize: 14,
    marginTop: 4,
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

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#777777',
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
    justifyContent: 'space-between',
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
    justifyContent: 'center',
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
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingTop: 75,
  },

  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: '#E8ECE8',
    alignItems: 'center',
    justifyContent: 'center',
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