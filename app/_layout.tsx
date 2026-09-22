import * as Notifications from 'expo-notifications';
import { Stack, router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { registerForPushNotifications } from '../lib/notifications';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const pathname = usePathname();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  /*
   * =====================================================
   * AUTHENTICATION
   * =====================================================
   */

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /*
   * =====================================================
   * PUSH NOTIFICATION REGISTRATION
   * =====================================================
   *
   * Only register the device when a user
   * is logged in.
   */

  useEffect(() => {
    if (!session) {
      return;
    }

    registerForPushNotifications();
  }, [session]);

  /*
   * =====================================================
   * PUSH NOTIFICATION LISTENERS
   * =====================================================
   *
   * Handles notifications while the app is open
   * and when the user taps a notification.
   */

  useEffect(() => {
    const notificationListener =
      Notifications.addNotificationReceivedListener(
        (notification) => {
          console.log(
            'Push notification received:',
            notification
          );
        }
      );

    const responseListener =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          console.log(
            'Push notification opened:',
            response
          );
        }
      );

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  /*
   * =====================================================
   * ROUTE PROTECTION
   * =====================================================
   */

  useEffect(() => {
    if (loading) {
      return;
    }

    const isLoginPage =
      pathname === '/' ||
      pathname === '/(tabs)' ||
      pathname === '/(tabs)/';

    const isProtectedPage =
      pathname === '/dashboard' ||
      pathname === '/notifications' ||
      pathname === '/profile';

    if (!session && isProtectedPage) {
      router.replace('/(tabs)');
    }

    if (session && isLoginPage) {
      router.replace('/dashboard');
    }
  }, [
    session,
    loading,
    pathname,
  ]);

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (loading) {
    return null;
  }

  /*
   * =====================================================
   * NAVIGATION
   * =====================================================
   */

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
          animation: 'none',
        }}
      />

      <Stack.Screen
        name="dashboard"
        options={{
          headerShown: false,
          animation: 'none',
        }}
      />

      <Stack.Screen
        name="notifications"
        options={{
          headerShown: false,
          animation: 'none',
        }}
      />

      <Stack.Screen
        name="profile"
        options={{
          headerShown: false,
          animation: 'none',
        }}
      />
    </Stack>
  );
}