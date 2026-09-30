import { router } from 'expo-router';
import { useState } from 'react';

import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { supabase } from '../lib/supabase';

export default function ForgotPassword() {

  const [email, setEmail] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const [successMessage, setSuccessMessage] =
    useState('');


  const handleForgotPassword =
    async () => {

      setErrorMessage('');
      setSuccessMessage('');

      /*
       * CHECK EMAIL
       */

      if (!email.trim()) {

        setErrorMessage(
          'Please enter your email.'
        );

        return;
      }


      setLoading(true);


      try {

        /*
         * SEND PASSWORD RESET EMAIL
         */

        const {
          error,
        } =
          await supabase.auth.resetPasswordForEmail(
            email.trim(),
            {
              redirectTo:
                'omnibin://reset-password',
            }
          );


        if (error) {

          console.error(
            'FORGOT PASSWORD ERROR:',
            error.message
          );

          setErrorMessage(
            error.message
          );

          setLoading(false);

          return;
        }


        /*
         * SUCCESS
         */

        console.log(
          'PASSWORD RESET EMAIL SENT'
        );

        setSuccessMessage(
          'Password reset email sent. Please check your email.'
        );

        setLoading(false);

      } catch (error) {

        console.error(
          'FORGOT PASSWORD ERROR:',
      error);

        setErrorMessage(
          'Something went wrong. Please try again.'
        );

        setLoading(false);

      }

    };


  return (

    <View
      style={
        styles.screen
      }
    >

      <View
        style={
          styles.card
        }
      >

        {/* HEADER */}

        <View
          style={
            styles.header
          }
        >

          <Text
            style={
              styles.title
            }
          >
            Forgot Password
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Enter your email to reset your password
          </Text>

        </View>


        {/* EMAIL */}

        <View
          style={
            styles.inputContainer
          }
        >

          <Text
            style={
              styles.inputLabel
            }
          >
            Email
          </Text>

          <TextInput
            style={
              styles.input
            }

            placeholder="Enter your email"

            placeholderTextColor="#999999"

            value={
              email
            }

            onChangeText={(text) => {

              setEmail(text);

              setErrorMessage('');

              setSuccessMessage('');

            }}

            autoCapitalize="none"

            keyboardType="email-address"

            editable={
              !loading
            }
          />

        </View>


        {/* ERROR */}

        {errorMessage ? (

          <View
            style={
              styles.errorBox
            }
          >

            <Text
              style={
                styles.errorText
              }
            >
              {
                errorMessage
              }
            </Text>

          </View>

        ) : null}


        {/* SUCCESS */}

        {successMessage ? (

          <View
            style={
              styles.successBox
            }
          >

            <Text
              style={
                styles.successText
              }
            >
              {
                successMessage
              }
            </Text>

          </View>

        ) : null}


        {/* SEND BUTTON */}

        <TouchableOpacity

          style={[
            styles.resetButton,

            loading &&
              styles.resetButtonDisabled,
          ]}

          onPress={
            handleForgotPassword
          }

          disabled={
            loading
          }

          activeOpacity={
            0.8
          }

        >

          {loading ? (

            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />

          ) : (

            <Text
              style={
                styles.resetButtonText
              }
            >
              Send Reset Email
            </Text>

          )}

        </TouchableOpacity>


        {/* BACK TO LOGIN */}

        <TouchableOpacity

          onPress={() =>
            router.replace('/')
          }

          disabled={
            loading
          }

          style={
            styles.backButton
          }

        >

          <Text
            style={
              styles.backText
            }
          >
            Back to Login
          </Text>

        </TouchableOpacity>

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

      alignItems: 'center',

      justifyContent:
        'center',

      paddingHorizontal: 20,
    },


    card: {
      width: '100%',

      maxWidth: 450,

      backgroundColor:
        '#FFFFFF',

      borderRadius: 20,

      paddingHorizontal: 28,

      paddingVertical: 35,

      elevation: 4,

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity: 0.08,

      shadowRadius: 8,
    },


    header: {
      alignItems: 'center',

      marginBottom: 30,
    },


    title: {
      fontSize: 28,

      fontWeight: 'bold',

      color:
        '#1B5E20',
    },


    subtitle: {
      fontSize: 13,

      color:
        '#777777',

      marginTop: 5,

      textAlign:
        'center',
    },


    inputContainer: {
      marginBottom: 18,
    },


    inputLabel: {
      fontSize: 14,

      fontWeight: '600',

      color:
        '#333333',

      marginBottom: 7,
    },


    input: {
      height: 50,

      borderWidth: 1,

      borderColor:
        '#D6DDD6',

      borderRadius: 10,

      paddingHorizontal: 15,

      fontSize: 14,

      color:
        '#222222',

      backgroundColor:
        '#FAFCFA',
    },


    errorBox: {
      backgroundColor:
        '#FDECEC',

      borderWidth: 1,

      borderColor:
        '#F5B5B5',

      borderRadius: 8,

      paddingVertical: 10,

      paddingHorizontal: 12,

      marginBottom: 15,
    },


    errorText: {
      color:
        '#C62828',

      fontSize: 13,

      fontWeight: '500',
    },


    successBox: {
      backgroundColor:
        '#EAF5E7',

      borderWidth: 1,

      borderColor:
        '#B8D9AE',

      borderRadius: 8,

      paddingVertical: 10,

      paddingHorizontal: 12,

      marginBottom: 15,
    },


    successText: {
      color:
        '#2E6B25',

      fontSize: 13,

      fontWeight: '500',
    },


    resetButton: {
      height: 52,

      backgroundColor:
        '#1B5E20',

      borderRadius: 10,

      alignItems: 'center',

      justifyContent:
        'center',

      marginTop: 5,
    },


    resetButtonDisabled: {
      opacity: 0.6,
    },


    resetButtonText: {
      color:
        '#FFFFFF',

      fontSize: 16,

      fontWeight: 'bold',
    },


    backButton: {
      alignItems: 'center',

      marginTop: 20,
    },


    backText: {
      fontSize: 13,

      fontWeight: '700',

      color:
        '#1B5E20',
    },

  });