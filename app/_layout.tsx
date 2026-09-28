import {
  Stack,
  router,
  useSegments,
} from 'expo-router';

import {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import * as Notifications from 'expo-notifications';

import {
  registerForPushNotifications,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';

/*
 * =====================================================
 * PUSH NOTIFICATION HANDLER
 * =====================================================
 *
 * This makes notifications appear even when the app
 * is currently open in the foreground.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});


export default function RootLayout() {

  const segments = useSegments();

  const [session, setSession] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);


  /*
   * =====================================================
   * GET EXISTING SESSION
   * =====================================================
   */

  useEffect(() => {

    let mounted = true;

    const initializeAuth = async () => {

      try {

        const {
          data,
          error,
        } =
          await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        if (error) {

          console.error(
            'AUTH SESSION ERROR:',
            error.message
          );

          setSession(null);

          return;
        }

        console.log(
          'EXISTING SESSION:',
          data.session
            ? 'FOUND'
            : 'NONE'
        );

        setSession(
          data.session
        );

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

    initializeAuth();


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

          setSession(
            newSession
          );


          /*
           * USER LOGGED OUT
           */

          if (
            event ===
            'SIGNED_OUT'
          ) {

            router.replace(
              '/(tabs)'
            );

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
   * REGISTER PUSH NOTIFICATIONS
   * =====================================================
   *
   * This runs whenever a valid user session exists.
   *
   * IMPORTANT:
   * You do NOT need to put this code inside
   * Dashboard, Notifications, or Profile.
   */

  useEffect(() => {

    if (!session) {

      console.log(
        'PUSH REGISTRATION SKIPPED: No session'
      );

      return;

    }


    const registerPush =
      async () => {

        console.log(
          '================================='
        );

        console.log(
          'REGISTERING PUSH NOTIFICATIONS...'
        );

        console.log(
          'USER:',
          session.user?.email
        );

        console.log(
          '================================='
        );


        const token =
          await registerForPushNotifications();


        if (token) {

          console.log(
            '================================='
          );

          console.log(
            'PUSH NOTIFICATIONS READY'
          );

          console.log(
            'TOKEN:',
            token
          );

          console.log(
            '================================='
          );

        } else {

          console.error(
            'PUSH NOTIFICATION REGISTRATION FAILED'
          );

        }

      };


    registerPush();

  }, [session]);


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
      firstSegment ===
      '(tabs)';


    const isRegisterPage =
      firstSegment ===
      'Register';


    const isAuthPage =
      isLoginPage ||
      isRegisterPage;


    /*
     * ===================================================
     * NO SESSION
     * ===================================================
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
     * ===================================================
     * SESSION EXISTS
     * ===================================================
     *
     * Do not redirect.
     *
     * The user can stay on:
     *
     * Dashboard
     * Notifications
     * Profile
     */

  }, [
    session,
    loading,
    segments,
  ]);


  /*
   * =====================================================
   * LOADING SCREEN
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

      <Stack.Screen
        name="(tabs)"
      />

      <Stack.Screen
        name="Register"
      />

      <Stack.Screen
        name="dashboard"
      />

      <Stack.Screen
        name="notifications"
      />

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

const styles =
  StyleSheet.create({

    loadingScreen: {
      flex: 1,
      backgroundColor:
        '#F5F7F5',

      alignItems: 'center',
      justifyContent: 'center',
    },

  });