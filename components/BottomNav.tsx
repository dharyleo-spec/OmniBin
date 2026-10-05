import { useCallback, useEffect, useState } from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  useFocusEffect,
  usePathname,
  useRouter,
} from 'expo-router';

import {
  fetchMonitorState,
  type MonitorState,
} from '../lib/binMonitor';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const [hasUnread, setHasUnread] =
    useState(false);

  /*
   * =====================================================
   * FULL NOTIFICATION THRESHOLD
   * =====================================================
   *
   * The red dot appears when the HC-SR04 reaches
   * 85% or higher.
   *
   * 0–84%  = No notification
   * 85–100% = Notification
   *
   * =====================================================
   */

  const NOTIFICATION_THRESHOLD = 85;

  /*
   * =====================================================
   * CHECK LIVE BIN LEVEL
   * =====================================================
   *
   * This uses the EXACT SAME source as BinMonitor
   * and Notifications.
   *
   * We do NOT use the notification table here.
   *
   * =====================================================
   */

  const checkUnreadNotifications =
    useCallback(async () => {

      try {

        const state: MonitorState =
          await fetchMonitorState();

        const level =
          state?.sensor?.fill_percent ?? 0;

        /*
         * Red dot appears at 85% or higher.
         */

        if (
          level >=
          NOTIFICATION_THRESHOLD
        ) {

          setHasUnread(true);

        } else {

          setHasUnread(false);

        }

      } catch (error) {

        /*
         * If the sensor cannot be read,
         * do not show the notification dot.
         */

        console.warn(
          'BottomNav sensor check failed:',
          error
        );

        setHasUnread(false);

      }

    }, []);

  /*
   * =====================================================
   * INITIAL CHECK
   * =====================================================
   */

  useEffect(() => {

    checkUnreadNotifications();

  }, [checkUnreadNotifications]);

  /*
   * =====================================================
   * AUTOMATIC SENSOR CHECK
   * =====================================================
   *
   * Checks the HC-SR04 level every 2 seconds.
   *
   * This means the red dot can appear while the user
   * is still on the Dashboard.
   *
   * No need to open Notifications.
   *
   * =====================================================
   */

  useEffect(() => {

    const interval =
      setInterval(() => {

        checkUnreadNotifications();

      }, 2000);

    return () => {

      clearInterval(interval);

    };

  }, [checkUnreadNotifications]);

  /*
   * =====================================================
   * CHECK WHEN SCREEN BECOMES ACTIVE
   * =====================================================
   *
   * Also perform an immediate check whenever the user
   * changes screens.
   *
   * =====================================================
   */

  useFocusEffect(
    useCallback(() => {

      checkUnreadNotifications();

    }, [checkUnreadNotifications])
  );

  /*
   * =====================================================
   * NAVIGATION ORDER
   * =====================================================
   *
   * Dashboard      = 0
   * Notifications  = 1
   * Profile        = 2
   *
   * =====================================================
   */

  const navigationOrder = {
    '/dashboard': 0,
    '/notifications': 1,
    '/profile': 2,
  };

  function navigate(
    route:
      | '/dashboard'
      | '/notifications'
      | '/profile'
  ) {

    if (pathname === route) {
      return;
    }

    const currentIndex =
      navigationOrder[
        pathname as keyof typeof navigationOrder
      ];

    const targetIndex =
      navigationOrder[route];

    /*
     * =================================================
     * MOVING FORWARD
     * =================================================
     */

    if (
      currentIndex !== undefined &&
      targetIndex > currentIndex
    ) {

      router.push(route);

      return;

    }

    /*
     * =================================================
     * MOVING BACKWARD
     * =================================================
     */

    if (
      currentIndex !== undefined &&
      targetIndex < currentIndex
    ) {

      router.dismissTo(route);

      return;

    }

    /*
     * =================================================
     * FALLBACK
     * =================================================
     */

    router.push(route);

  }

  /*
   * =====================================================
   * NAVIGATION ITEMS
   * =====================================================
   */

  const navItems = [
    {
      label: 'Dashboard',
      route: '/dashboard' as const,
      icon: 'home-outline' as const,
      activeIcon: 'home' as const,
    },

    {
      label: 'Notifications',
      route: '/notifications' as const,
      icon: 'notifications-outline' as const,
      activeIcon: 'notifications' as const,
    },

    {
      label: 'Profile',
      route: '/profile' as const,
      icon: 'person-outline' as const,
      activeIcon: 'person' as const,
    },
  ];

  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (

    <View style={styles.container}>

      <View style={styles.navBar}>

        {navItems.map((item) => {

          const isActive =
            pathname === item.route;

          return (

            <Pressable
              key={item.route}
              style={styles.navItem}
              onPress={() =>
                navigate(item.route)
              }
            >

              <View
                style={styles.iconWrapper}
              >

                <Ionicons
                  name={
                    isActive
                      ? item.activeIcon
                      : item.icon
                  }
                  size={25}
                  color={
                    isActive
                      ? '#1B5E20'
                      : '#777777'
                  }
                />

                {/* =====================================
                    NOTIFICATION RED DOT
                    ===================================== */}

                {item.route ===
                  '/notifications' &&
                  hasUnread && (

                    <View
                      style={
                        styles.notificationDot
                      }
                    />

                  )}

              </View>

              {isActive && (

                <Text
                  style={
                    styles.activeLabel
                  }
                >
                  {item.label}
                </Text>

              )}

            </Pressable>

          );

        })}

      </View>

    </View>

  );
}

/*
 * ======================================================
 * STYLES
 * ======================================================
 */

const styles = StyleSheet.create({

  container: {
    backgroundColor: '#FFFFFF',
  },

  navBar: {
    height: 72,
    backgroundColor: '#FFFFFF',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',

    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',

    elevation: 8,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: -2,
    },

    shadowOpacity: 0.08,
    shadowRadius: 4,
  },

  navItem: {
    flex: 1,
    height: 60,

    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrapper: {
    width: 32,
    height: 32,

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',
  },

  notificationDot: {
    position: 'absolute',

    top: -2,
    right: -2,

    width: 9,
    height: 9,

    borderRadius: 5,

    backgroundColor: '#C62828',

    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },

  activeLabel: {
    fontSize: 11,
    fontWeight: '600',

    color: '#1B5E20',

    marginTop: 2,
  },

});