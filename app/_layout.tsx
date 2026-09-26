import { Stack, router, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const segments = useSegments();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  /*
   * =====================================================
   * AUTHENTICATION INITIALIZATION
   * =====================================================
   */

  useEffect(() => {
    let mounted = true;

    const getSession = async () => {
      try {
        const {
          data,
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error(
            'AUTH SESSION ERROR:',
            error.message
          );

          if (mounted) {
            setSession(null);
          }

          return;
        }

        if (mounted) {
          setSession(data.session);
        }

      } catch (error) {

        console.error(
          'AUTH INITIALIZATION ERROR:',
          error
        );

        if (mounted) {
          setSession(null);
        }

      } finally {

        if (mounted) {
          setLoading(false);
        }

      }
    };

    getSession();

    /*
     * ===================================================
     * AUTH STATE LISTENER
     * ===================================================
     */

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (event, newSession) => {

          console.log(
            'AUTH EVENT:',
            event
          );

          if (!mounted) {
            return;
          }

          setSession(newSession);

          /*
           * USER LOGGED OUT
           */

          if (
            event === 'SIGNED_OUT'
          ) {
            router.replace(
              '/(tabs)'
            );

            return;
          }

          /*
           * USER LOGGED IN
           */

          if (
            event === 'SIGNED_IN' &&
            newSession
          ) {
            router.replace(
              '/dashboard'
            );

            return;
          }

        }
      );

    /*
     * ===================================================
     * CLEANUP
     * ===================================================
     */

    return () => {
      mounted = false;
      subscription.unsubscribe();
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

    const firstSegment =
      segments[0];

    const isLoginPage =
      firstSegment === '(tabs)';

    const isRegisterPage =
      firstSegment === 'Register';

    const isAuthPage =
      isLoginPage ||
      isRegisterPage;

    /*
     * NO SESSION
     *
     * Send user to login.
     */

    if (
      !session &&
      !isAuthPage
    ) {
      router.replace(
        '/(tabs)'
      );

      return;
    }

    /*
     * SESSION EXISTS
     *
     * Prevent logged-in users from
     * remaining on login/register.
     */

    if (
      session &&
      isAuthPage
    ) {
      router.replace(
        '/dashboard'
      );
    }

  }, [
    session,
    loading,
    segments,
  ]);

  /*
   * =====================================================
   * INITIAL LOADING
   * =====================================================
   */

  if (loading) {
    return (
      <View
        style={
          styles.loadingScreen
        }
      >
        <ActivityIndicator
          size="large"
          color="#1B5E20"
        />
      </View>
    );
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

      {/* LOGIN */}

      <Stack.Screen
        name="(tabs)"
      />

      {/* REGISTER */}

      <Stack.Screen
        name="Register"
      />

      {/* DASHBOARD */}

      <Stack.Screen
        name="dashboard"
      />

      {/* NOTIFICATIONS */}

      <Stack.Screen
        name="notifications"
      />

      {/* PROFILE */}

      <Stack.Screen
        name="profile"
      />

    </Stack>
  );
}

/*
 * =====================================================
 * STYLES
 * =====================================================
 */

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#F5F7F5',

    alignItems: 'center',
    justifyContent: 'center',
  },
});