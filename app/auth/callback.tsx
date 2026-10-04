import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useEffect,
  useRef,
} from 'react';

import { supabase } from '../../lib/supabase';


export default function AuthCallback() {

  const params =
    useLocalSearchParams();

  const handled =
    useRef(false);


  useEffect(() => {

    if (handled.current) {
      return;
    }

    handled.current = true;


    const handleCallback =
      async () => {

        try {

          console.log(
            'AUTH CALLBACK PARAMS:',
            params
          );


          /*
           * =================================================
           * SUPABASE PKCE CODE
           * =================================================
           *
           * Supabase may return:
           *
           * ?code=xxxxxxxx
           *
           * Exchange that code for a session.
           */

          const code =
            typeof params.code === 'string'
              ? params.code
              : undefined;


          if (code) {

            console.log(
              'SUPABASE AUTH CODE FOUND'
            );


            const {
              data,
              error,
            } =
              await supabase.auth.exchangeCodeForSession(
                code
              );


            if (error) {

              console.error(
                'AUTH CALLBACK ERROR:',
                error.message
              );

              router.replace('/');

              return;

            }


            console.log(
              'AUTH CALLBACK SESSION:',
              data.session
                ? 'CREATED'
                : 'NONE'
            );


            /*
             * Email confirmation succeeded.
             *
             * Send the user to Login.
             */

            router.replace('/');

            return;

          }


          /*
           * =================================================
           * SUPABASE ACCESS TOKEN
           * =================================================
           *
           * Some Supabase confirmation flows return:
           *
           * #access_token=...
           * #refresh_token=...
           */

          const accessToken =
            typeof params.access_token === 'string'
              ? params.access_token
              : undefined;


          const refreshToken =
            typeof params.refresh_token === 'string'
              ? params.refresh_token
              : undefined;


          if (
            accessToken &&
            refreshToken
          ) {

            console.log(
              'SUPABASE ACCESS TOKEN FOUND'
            );


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
                'AUTH CALLBACK SESSION ERROR:',
                error.message
              );

              router.replace('/');

              return;

            }


            console.log(
              'AUTH CALLBACK SESSION:',
              data.session
                ? 'CREATED'
                : 'NONE'
            );


            /*
             * Email confirmation succeeded.
             */

            router.replace('/');

            return;

          }


          /*
           * =================================================
           * NO AUTH DATA
           * =================================================
           */

          console.log(
            'AUTH CALLBACK: No authentication data found'
          );


          router.replace('/');


        } catch (error) {

          console.error(
            'AUTH CALLBACK UNEXPECTED ERROR:',
            error
          );


          router.replace('/');

        }

      };


    void handleCallback();

  }, [params]);


  /*
   * =====================================================
   * LOADING SCREEN
   * =====================================================
   */

  return (

    <View
      style={
        styles.container
      }
    >

      <ActivityIndicator
        size="large"
        color="#1B5E20"
      />

      <Text
        style={
          styles.text
        }
      >
        Confirming your email...
      </Text>

    </View>

  );

}


const styles =
  StyleSheet.create({

    container: {

      flex: 1,

      backgroundColor:
        '#F5F7F5',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        30,

    },


    text: {

      marginTop:
        15,

      fontSize:
        15,

      color:
        '#555555',

      textAlign:
        'center',

    },

  });