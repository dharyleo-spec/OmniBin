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

export default function Register() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRegister = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    // Check empty fields
    if (
      !displayName.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setErrorMessage(
        'Please complete all fields.'
      );
      return;
    }

    // Check password
    if (password !== confirmPassword) {
      setErrorMessage(
        'Passwords do not match.'
      );
      return;
    }

    // Check password length
    if (password.length < 6) {
      setErrorMessage(
        'Password must be at least 6 characters.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: email.trim(),
          password: password,

          // SAVE DISPLAY NAME
          options: {
            data: {
              display_name: displayName.trim(),
            },
          },
        });

      if (error) {
        console.error(
          'REGISTER ERROR:',
          error.message
        );

        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      console.log(
        'REGISTER SUCCESS:',
        data.user?.email
      );

      setSuccessMessage(
        'Account created successfully. Please log in.'
      );

      setLoading(false);

      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);

    } catch (error) {
      console.error(
        'REGISTER ERROR:',
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

      {/* REGISTER CARD */}
      <View style={styles.registerCard}>

        {/* HEADER */}
        <View style={styles.headerContainer}>

          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>
              O
            </Text>
          </View>

          <Text style={styles.title}>
            Create Account
          </Text>

          <Text style={styles.subtitle}>
            Register for OmniBin
          </Text>

        </View>

        {/* DISPLAY NAME */}
        <View style={styles.inputContainer}>

          <Text style={styles.inputLabel}>
            Display Name
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor="#999999"
            value={displayName}
            onChangeText={(text) => {
              setDisplayName(text);
              setErrorMessage('');
            }}
            autoCapitalize="words"
            editable={!loading}
          />

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

        {/* CONFIRM PASSWORD */}
        <View style={styles.inputContainer}>

          <Text style={styles.inputLabel}>
            Confirm Password
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Confirm your password"
            placeholderTextColor="#999999"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrorMessage('');
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

        {/* REGISTER BUTTON */}
        <TouchableOpacity
          style={[
            styles.registerButton,
            loading &&
              styles.registerButtonDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.registerButtonText}>
              Register
            </Text>
          )}
        </TouchableOpacity>

        {/* BACK TO LOGIN */}
        <View style={styles.loginContainer}>

          <Text style={styles.loginText}>
            Already have an account?
          </Text>

          <TouchableOpacity
            onPress={() =>
              router.replace('/(tabs)')
            }
            disabled={loading}
          >
            <Text style={styles.loginLink}>
              Log In
            </Text>
          </TouchableOpacity>

        </View>

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

  registerCard: {
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

  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logoCircle: {
    width: 75,
    height: 75,
    borderRadius: 38,
    backgroundColor: '#1B5E20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  logoText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: 'bold',
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1B5E20',
  },

  subtitle: {
    fontSize: 13,
    color: '#777777',
    marginTop: 5,
    textAlign: 'center',
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
    backgroundColor: '#EAF5E7',
    borderWidth: 1,
    borderColor: '#B8D9AE',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 15,
  },

  successText: {
    color: '#2E6B25',
    fontSize: 13,
    fontWeight: '500',
  },

  registerButton: {
    height: 52,
    backgroundColor: '#1B5E20',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },

  registerButtonDisabled: {
    opacity: 0.6,
  },

  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },

  loginText: {
    fontSize: 13,
    color: '#777777',
  },

  loginLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B5E20',
    marginLeft: 5,
  },

});