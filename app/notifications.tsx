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
import { supabase } from '../lib/supabase';

type Notification = {
  notif_id: number;
  bin_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
};

type Bin = {
  bin_id: number;
  name: string;
  waste_type: string;
  current_level: number;
  status: string;
  location: string;
  updated_at: string;
};

type NotificationWithBin = {
  notification: Notification;
  bin: Bin;
};

type IoniconName =
  keyof typeof Ionicons.glyphMap;

export default function Notifications() {
  const [
    notifications,
    setNotifications,
  ] = useState<
    NotificationWithBin[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [
    selectedNotification,
    setSelectedNotification,
  ] =
    useState<NotificationWithBin | null>(
      null
    );

  /*
   * =====================================================
   * WASTE TYPE ICON
   * =====================================================
   */

  const getWasteIcon = (
    wasteType: string
  ): IoniconName => {

    const type =
      wasteType.toLowerCase().trim();

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
   * WASTE TYPE ICON COLOR
   * =====================================================
   */

  const getWasteIconColor = (
    wasteType: string
  ) => {

    const type =
      wasteType.toLowerCase().trim();

    if (
      type === 'biodegradable'
    ) {
      return '#537B2F';
    }

    if (
      type === 'non-biodegradable'
    ) {
      return '#777777';
    }

    return '#537B2F';
  };

  /*
   * =====================================================
   * FETCH NOTIFICATIONS
   * =====================================================
   */

  const fetchNotifications =
    useCallback(async () => {

      try {

        const {
          data: notificationData,
          error: notificationError,
        } = await supabase
          .from('notification')
          .select(
            'notif_id, bin_id, message, is_read, created_at'
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          );

        if (notificationError) {

          console.error(
            'Error fetching notifications:',
            notificationError.message
          );

          setNotifications([]);

          return;
        }

        if (
          !notificationData ||
          notificationData.length === 0
        ) {

          setNotifications([]);

          return;
        }

        const validNotifications:
          NotificationWithBin[] = [];

        /*
         * =================================================
         * PREVENT DUPLICATE NOTIFICATIONS
         * =================================================
         *
         * notificationData is ordered newest first.
         *
         * If multiple notification records exist for
         * the same bin, keep only the newest one.
         */

        const processedBins =
          new Set<number>();

        for (
          const notification
          of notificationData
        ) {

          /*
           * Only collection notifications
           */

          if (
            notification.message !==
            'Bin requires collection.'
          ) {
            continue;
          }

          /*
           * Skip duplicate notification records
           * for the same bin.
           */

          if (
            processedBins.has(
              notification.bin_id
            )
          ) {
            continue;
          }

          const {
            data: binData,
            error: binError,
          } = await supabase
            .from('bins')
            .select(
              'bin_id, name, waste_type, current_level, status, location, updated_at'
            )
            .eq(
              'bin_id',
              notification.bin_id
            )
            .single();

          if (
            binError ||
            !binData
          ) {
            continue;
          }

          /*
           * Only display when
           * bin is 90% or higher.
           */

          if (
            Number(
              binData.current_level
            ) < 90
          ) {
            continue;
          }

          /*
           * Mark this bin as already processed.
           *
           * Because notifications are ordered
           * newest first, this keeps the newest
           * notification for the bin.
           */

          processedBins.add(
            notification.bin_id
          );

          validNotifications.push({
            notification,
            bin: {
              ...binData,
              current_level:
                Number(
                  binData.current_level
                ) || 0,
            },
          });
        }

        setNotifications(
          validNotifications
        );

      } catch (error) {

        console.error(
          'Unexpected notification error:',
          error
        );

        setNotifications([]);

      } finally {

        setLoading(false);

      }

    }, []);

  /*
   * =====================================================
   * FETCH WHEN SCREEN IS OPENED
   * =====================================================
   */

  useFocusEffect(
    useCallback(() => {

      setLoading(true);

      fetchNotifications();

    }, [fetchNotifications])
  );

  /*
   * =====================================================
   * REALTIME NOTIFICATION UPDATES
   * =====================================================
   */

  useEffect(() => {

    const channel =
      supabase
        .channel(
          `notifications-${Date.now()}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notification',
          },
          (payload) => {

            console.log(
              'Notification realtime update:',
              payload
            );

            fetchNotifications();

          }
        )
        .subscribe(
          (status) => {

            console.log(
              'Notifications realtime status:',
              status
            );

          }
        );

    return () => {

      supabase.removeChannel(
        channel
      );

    };

  }, [fetchNotifications]);

  /*
   * =====================================================
   * ALSO LISTEN FOR BIN CHANGES
   * =====================================================
   */

  useEffect(() => {

    const channel =
      supabase
        .channel(
          `notification-bins-${Date.now()}`
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
              'Notification bin update:',
              payload
            );

            fetchNotifications();

          }
        )
        .subscribe(
          (status) => {

            console.log(
              'Notification bin realtime status:',
              status
            );

          }
        );

    return () => {

      supabase.removeChannel(
        channel
      );

    };

  }, [fetchNotifications]);

  /*
   * =====================================================
   * OPEN NOTIFICATION
   * =====================================================
   */

  const openNotification = async (
    item: NotificationWithBin
  ) => {

    setSelectedNotification(
      item
    );

    if (
      !item.notification.is_read
    ) {

      const {
        error,
      } = await supabase
        .from('notification')
        .update({
          is_read: true,
        })
        .eq(
          'notif_id',
          item.notification
            .notif_id
        );

      if (error) {

        console.error(
          'Error marking notification as read:',
          error.message
        );

      } else {

        setNotifications(
          (current) =>
            current.map(
              (
                notificationItem
              ) =>
                notificationItem
                  .notification
                  .notif_id ===
                item.notification
                  .notif_id
                  ? {
                      ...notificationItem,

                      notification: {
                        ...notificationItem.notification,

                        is_read: true,
                      },
                    }
                  : notificationItem
            )
        );

      }
    }
  };

  /*
   * =====================================================
   * CLOSE MODAL
   * =====================================================
   */

  const closeModal = () => {

    setSelectedNotification(
      null
    );

  };

  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <View style={styles.container}>

      {/* HEADER */}

      <Header
        title="Notifications"
        subtitle="Bin collection alerts"
      />

      {/* NOTIFICATION LIST */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >

        {loading ? (

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
              Loading notifications...
            </Text>

          </View>

        ) : notifications.length === 0 ? (

          /* EMPTY STATE */

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
              There are no bins requiring
              collection.
            </Text>

          </View>

        ) : (

          /* NOTIFICATIONS */

          notifications.map(
            (item) => {

              const bin =
                item.bin;

              return (

                <Pressable
                  key={
                    item.notification
                      .notif_id
                  }
                  style={[
                    styles.notificationCard,

                    !item.notification
                      .is_read &&
                      styles.unreadCard,
                  ]}
                  onPress={() =>
                    openNotification(
                      item
                    )
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

                    <Text
                      style={
                        styles.notificationTitle
                      }
                    >
                      Bin requires collection.
                    </Text>

                    <Text
                      style={
                        styles.notificationMessage
                      }
                    >
                      Bin requires collection.
                    </Text>

                    <Text
                      style={
                        styles.currentLevelText
                      }
                    >
                      Current level:{' '}
                      {
                        bin.current_level
                      }%
                    </Text>

                    <Text
                      style={
                        styles.dateText
                      }
                    >
                      {new Date(
                        item.notification
                          .created_at
                      ).toLocaleString()}
                    </Text>

                  </View>

                </Pressable>
              );
            }
          )

        )}

      </ScrollView>

      {/* =================================================
          BIN INFORMATION MODAL
          ================================================= */}

      <Modal
        visible={
          selectedNotification !==
          null
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

            {selectedNotification && (
              <>

                {/* MODAL HEADER */}

                <View
                  style={
                    styles.modalHeader
                  }
                >

                  <View
                    style={[
                      styles.binIconContainer,
                      {
                        backgroundColor:
                          getWasteIconColor(
                            selectedNotification
                              .bin
                              .waste_type
                          ) + '18',
                      },
                    ]}
                  >

                    <Ionicons
                      name={getWasteIcon(
                        selectedNotification
                          .bin
                          .waste_type
                      )}
                      size={28}
                      color={getWasteIconColor(
                        selectedNotification
                          .bin
                          .waste_type
                      )}
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
                      Bin Information
                    </Text>

                  </View>

                </View>

                {/* NAME */}

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
                    Name
                  </Text>

                  <Text
                    style={
                      styles.infoValue
                    }
                  >
                    {
                      selectedNotification
                        .bin
                        .name
                    }
                  </Text>

                </View>

                {/* LOCATION */}

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
                    Location
                  </Text>

                  <Text
                    style={
                      styles.infoValue
                    }
                  >
                    {
                      selectedNotification
                        .bin
                        .location
                    }
                  </Text>

                </View>

                {/* WASTE TYPE */}

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
                    Waste Type
                  </Text>

                  <Text
                    style={
                      styles.infoValue
                    }
                  >
                    {
                      selectedNotification
                        .bin
                        .waste_type
                    }
                  </Text>

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
                    ]}
                  >
                    {
                      selectedNotification
                        .bin
                        .current_level
                    }%
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

              </>
            )}

          </View>

        </View>

      </Modal>

      {/* BOTTOM NAVIGATION */}

      <BottomNav />

    </View>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({

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

  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 5,
  },

  notificationMessage: {
    fontSize: 14,
    color: '#555555',
    marginBottom: 10,
  },

  currentLevelText: {
    fontSize: 14,
    color: '#444444',
    marginBottom: 5,
  },

  dateText: {
    fontSize: 12,
    color: '#888888',
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#777777',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
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