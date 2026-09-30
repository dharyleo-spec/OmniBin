import {
  Stack,
  router,
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

import * as Linking from 'expo-linking';

import { supabase } from '../lib/supabase';

export default function RootLayout() {

  const [session, setSession] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  const [recoveringPassword, setRecoveringPassword] =
    useState(false);


  /*
   * =====================================================
   * PASSWORD RECOVERY
   * =====================================================
   *
   * When the user clicks the password reset email,
   * Supabase sends the access token and refresh token
   * back to:
   *
   * omnibin://reset-password
   *
   * We use those tokens to create a Supabase session.
   */

  useEffect(() => {

    let mounted = true;

    const handleRecoveryUrl =
      async (url: string) => {

        try {

          console.log(
            'PASSWORD RECOVERY URL:',
            url
          );


          /*
           * Supabase places the tokens in the URL.
           *
           * Example:
           *
           * omnibin://reset-password#access_token=...
           * &refresh_token=...
           * &type=recovery
           */

          const hash =
            url.split('#')[1];

          if (!hash) {
            return;
          }

          const params =
            new URLSearchParams(hash);

          const accessToken =
            params.get('access_token');

          const refreshToken =
            params.get('refresh_token');

          const type =
            params.get('type');


          /*
           * Only continue if this is
           * a password recovery link.
           */

          if (
            type !== 'recovery' ||
            !accessToken ||
            !refreshToken
          ) {

            return;

          }


          console.log(
            'PASSWORD RECOVERY DETECTED'
          );


          if (mounted) {

            setRecoveringPassword(true);

          }


          /*
           * Create Supabase session
           */

          const {
            data,
            error,
          } =
            await supabase.auth.setSession({

              access_token:
                accessToken,

              refresh_token:
                refreshToken,

            });


          if (error) {

            console.error(
              'PASSWORD RECOVERY SESSION ERROR:',
              error.message
            );

            if (mounted) {

              setRecoveringPassword(
                false
              );

            }

            return;

          }


          console.log(
            'PASSWORD RECOVERY SESSION CREATED:',
            data.session
              ? 'YES'
              : 'NO'
          );


          if (mounted) {

            setSession(
              data.session
            );

          }


          /*
           * Open the reset password screen.
           */

          router.replace(
            '/reset-password'
          );


        } catch (error) {

          console.error(
            'PASSWORD RECOVERY ERROR:',
            error
          );

          if (mounted) {

            setRecoveringPassword(
              false
            );

          }

        }

      };


    /*
     * ===================================================
     * HANDLE INITIAL URL
     * ===================================================
     *
     * This handles the case where the app is CLOSED
     * and the user clicks the reset email.
     */

    const handleInitialUrl =
      async () => {

        const url =
          await Linking.getInitialURL();

        if (url) {

          await handleRecoveryUrl(
            url
          );

        }

      };


    void handleInitialUrl();


    /*
     * ===================================================
     * HANDLE URL WHILE APP IS OPEN
     * ===================================================
     */

    const subscription =
      Linking.addEventListener(
        'url',
        ({ url }) => {

          void handleRecoveryUrl(
            url
          );

        }
      );


    /*
     * ===================================================
     * CLEANUP
     * ===================================================
     */

    return () => {

      mounted = false;

      subscription.remove();

    };

  }, []);


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
              '/'
            );

          }


          /*
           * PASSWORD RECOVERY
           */

          if (
            event ===
            'PASSWORD_RECOVERY'
          ) {

            console.log(
              'PASSWORD RECOVERY EVENT DETECTED'
            );


            setRecoveringPassword(
              true
            );


            router.replace(
              '/reset-password'
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
   * ROUTE PROTECTION
   * =====================================================
   */

  useEffect(() => {

    if (loading) {

      return;

    }


    /*
     * Do not redirect while processing
     * a password recovery link.
     */

    if (recoveringPassword) {

      return;

    }


    /*
     * ===================================================
     * NO SESSION
     * ===================================================
     *
     * Send unauthenticated users to the login page.
     */

    if (!session) {

      router.replace(
        '/'
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
    recoveringPassword,
  ]);


  /*
   * =====================================================
   * LOADING SCREEN
   * =====================================================
   */

  if (
    loading ||
    recoveringPassword
  ) {

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
        name="index"
      />

      <Stack.Screen
        name="Register"
      />

      <Stack.Screen
        name="forgot-password"
      />

      <Stack.Screen
        name="reset-password"
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

      alignItems:
        'center',

      justifyContent:
        'center',

    },

  });