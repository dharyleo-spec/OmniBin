import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../lib/supabase';

export default function HomeScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage('');

    // Check empty fields
    if (!email.trim() || !password) {
      setErrorMessage(
        'Please enter your email and password.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

      if (error) {
        console.log(
          'LOGIN ERROR:',
          error.message
        );

        setErrorMessage(
          'Invalid email or password.'
        );

        setLoading(false);
        return;
      }

      console.log(
        'LOGIN SUCCESS:',
        data.user?.email
      );

      setLoading(false);

      router.replace('/dashboard');

    } catch (error) {
      console.error(
        'LOGIN ERROR:',
        error
      );

      setErrorMessage(
        'Something went wrong. Please try again.'
      );

      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>

      {/* LOGIN CARD */}
      <View style={styles.loginCard}>

        {/* LOGO / NAMEPLATE */}
        <View style={styles.logoContainer}>

          <Image
            source={require('../assets/images/omnibin-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />

          <Image
            source={require('../assets/images/omnibin-nameplate.png')}
            style={styles.nameplateImage}
            resizeMode="contain"
          />

          <Text style={styles.subtitle}>
            Smart Waste Management System
          </Text>

        </View>

        {/* EMAIL */}
        <View style={styles.inputContainer}>

          <Text style={styles.inputLabel}>
            Email
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#999999"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrorMessage('');
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

        </View>

        {/* PASSWORD */}
        <View style={styles.inputContainer}>

          <Text style={styles.inputLabel}>
            Password
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#999999"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrorMessage('');
            }}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

        </View>

        {/* FORGOT PASSWORD */}
        <View style={styles.forgotContainer}>

          <TouchableOpacity
            onPress={() =>
              router.push('/forgot-password')
            }
            disabled={loading}
            activeOpacity={0.7}
          >

            <Text style={styles.forgotLink}>
              Forgot Password?
            </Text>

          </TouchableOpacity>

        </View>

        {/* ERROR MESSAGE */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {/* LOGIN BUTTON */}
        <TouchableOpacity
          style={[
            styles.loginButton,
            loading &&
              styles.loginButtonDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >

          {loading ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.loginButtonText}>
              Log In
            </Text>
          )}

        </TouchableOpacity>

        {/* REGISTER */}
        <View style={styles.registerContainer}>

          <Text style={styles.registerText}>
            Don't have an account?
          </Text>

          <TouchableOpacity
            onPress={() =>
              router.push('/Register')
            }
            disabled={loading}
            activeOpacity={0.7}
          >

            <Text style={styles.registerLink}>
              Register
            </Text>

          </TouchableOpacity>

        </View>

        {/* FOOTER */}
        <Text style={styles.footerText}>
          Authorized personnel only
        </Text>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  // --------------------------------------------------
  // SCREEN
  // --------------------------------------------------

  screen: {
    flex: 1,
    backgroundColor: '#F5F7F5',

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 20,
  },

  // --------------------------------------------------
  // LOGIN CARD
  // --------------------------------------------------

  loginCard: {
    width: '100%',
    maxWidth: 450,

    backgroundColor: '#FFFFFF',

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

  // --------------------------------------------------
  // LOGO
  // --------------------------------------------------

  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logoImage: {
    width: 90,
    height: 90,

    marginBottom: 8,
  },

  nameplateImage: {
    width: 220,
    height: 60,

    marginBottom: 3,
  },

  subtitle: {
    fontSize: 13,
    color: '#777777',

    marginTop: 3,

    textAlign: 'center',
  },

  // --------------------------------------------------
  // INPUTS
  // --------------------------------------------------

  inputContainer: {
    marginBottom: 18,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',

    color: '#333333',

    marginBottom: 7,
  },

  input: {
    height: 50,

    borderWidth: 1,
    borderColor: '#D6DDD6',

    borderRadius: 10,

    paddingHorizontal: 15,

    fontSize: 14,
    color: '#222222',

    backgroundColor: '#FAFCFA',
  },

  // --------------------------------------------------
  // FORGOT PASSWORD
  // --------------------------------------------------

  forgotContainer: {
    alignItems: 'flex-end',

    marginTop: -8,

    marginBottom: 15,
  },

  forgotLink: {
    fontSize: 13,

    fontWeight: '600',

    color: '#1B5E20',
  },

  // --------------------------------------------------
  // ERROR
  // --------------------------------------------------

  errorBox: {
    backgroundColor: '#FDECEC',

    borderWidth: 1,
    borderColor: '#F5B5B5',

    borderRadius: 8,

    paddingVertical: 10,
    paddingHorizontal: 12,

    marginBottom: 15,
  },

  errorText: {
    color: '#C62828',

    fontSize: 13,

    fontWeight: '500',
  },

  // --------------------------------------------------
  // LOGIN BUTTON
  // --------------------------------------------------

  loginButton: {
    height: 52,

    backgroundColor: '#1B5E20',

    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 5,
  },

  loginButtonDisabled: {
    opacity: 0.6,
  },

  loginButtonText: {
    color: '#FFFFFF',

    fontSize: 16,

    fontWeight: 'bold',
  },

  // --------------------------------------------------
  // REGISTER
  // --------------------------------------------------

  registerContainer: {
    flexDirection: 'row',

    justifyContent: 'center',

    alignItems: 'center',

    marginTop: 18,
  },

  registerText: {
    fontSize: 13,

    color: '#777777',
  },

  registerLink: {
    fontSize: 13,

    fontWeight: '700',

    color: '#1B5E20',

    marginLeft: 5,
  },

  // --------------------------------------------------
  // FOOTER
  // --------------------------------------------------

  footerText: {
    textAlign: 'center',

    color: '#999999',

    fontSize: 12,

    marginTop: 20,
  },

});