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

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState('');
  const [successMessage, setSuccessMessage] =
    useState('');

  const handleUpdatePassword = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!password || !confirmPassword) {
      setErrorMessage(
        'Please enter your new password.'
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        'Password must be at least 6 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        'Passwords do not match.'
      );
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.updateUser({
          password: password,
        });

      if (error) {
        console.log(
          'PASSWORD UPDATE ERROR:',
          error.message
        );

        setErrorMessage(
          'Unable to update password. Please try again.'
        );

        setLoading(false);
        return;
      }

      console.log(
        'PASSWORD UPDATED SUCCESSFULLY'
      );

      setSuccessMessage(
        'Password updated successfully.'
      );

      setTimeout(() => {
        router.replace('/');
      }, 1500);

    } catch (error) {
      console.error(
        'PASSWORD UPDATE ERROR:',
        error
      );

      setErrorMessage(
        'Something went wrong. Please try again.'
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>

      <View style={styles.card}>

        {/* TITLE */}

        <Text style={styles.title}>
          Reset Password
        </Text>

        <Text style={styles.subtitle}>
          Enter your new password below.
        </Text>


        {/* NEW PASSWORD */}

        <View style={styles.inputContainer}>

          <Text style={styles.inputLabel}>
            New Password
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your new password"
            placeholderTextColor="#999999"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setErrorMessage('');
              setSuccessMessage('');
            }}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

        </View>


        {/* CONFIRM PASSWORD */}

        <View style={styles.inputContainer}>

          <Text style={styles.inputLabel}>
            Confirm Password
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Confirm your new password"
            placeholderTextColor="#999999"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrorMessage('');
              setSuccessMessage('');
            }}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

        </View>


        {/* ERROR */}

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}


        {/* SUCCESS */}

        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              {successMessage}
            </Text>
          </View>
        ) : null}


        {/* UPDATE BUTTON */}

        <TouchableOpacity
          style={[
            styles.button,
            loading &&
              styles.buttonDisabled,
          ]}
          onPress={handleUpdatePassword}
          disabled={loading}
          activeOpacity={0.8}
        >

          {loading ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.buttonText}>
              Update Password
            </Text>
          )}

        </TouchableOpacity>


        {/* BACK TO LOGIN */}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/')}
          disabled={loading}
          activeOpacity={0.7}
        >

          <Text style={styles.backText}>
            Back to Login
          </Text>

        </TouchableOpacity>

      </View>

    </View>
  );
}


const styles = StyleSheet.create({

  screen: {
    flex: 1,

    backgroundColor: '#F5F7F5',

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 20,
  },


  card: {
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


  title: {
    fontSize: 24,

    fontWeight: '700',

    color: '#1B5E20',

    textAlign: 'center',

    marginBottom: 8,
  },


  subtitle: {
    fontSize: 13,

    color: '#777777',

    textAlign: 'center',

    marginBottom: 30,
  },


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


  successBox: {
    backgroundColor: '#E8F5E9',

    borderWidth: 1,

    borderColor: '#A5D6A7',

    borderRadius: 8,

    paddingVertical: 10,

    paddingHorizontal: 12,

    marginBottom: 15,
  },


  successText: {
    color: '#2E7D32',

    fontSize: 13,

    fontWeight: '500',
  },


  button: {
    height: 52,

    backgroundColor: '#1B5E20',

    borderRadius: 10,

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 5,
  },


  buttonDisabled: {
    opacity: 0.6,
  },


  buttonText: {
    color: '#FFFFFF',

    fontSize: 16,

    fontWeight: 'bold',
  },


  backButton: {
    alignItems: 'center',

    marginTop: 18,
  },


  backText: {
    fontSize: 13,

    fontWeight: '700',

    color: '#1B5E20',
  },

});