import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export async function registerForPushNotifications() {
  try {
    /*
     * ANDROID NOTIFICATION CHANNEL
     */

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(
        'omnibin-alerts',
        {
          name: 'OmniBin Alerts',
          importance:
            Notifications.AndroidImportance.MAX,
          vibrationPattern: [
            0,
            250,
            250,
            250,
          ],
          sound: 'default',
        }
      );
    }

    /*
     * CHECK CURRENT PERMISSION
     */

    const {
      status: existingStatus,
    } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    /*
     * ASK USER FOR PERMISSION
     */

    if (existingStatus !== 'granted') {
      const {
        status,
      } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log(
        'Push notification permission denied.'
      );

      return null;
    }

    /*
     * GET EXPO PROJECT ID
     */

    const projectId =
      Constants?.expoConfig?.extra?.eas
        ?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.error(
        'Expo project ID not found.'
      );

      return null;
    }

    /*
     * GET EXPO PUSH TOKEN
     */

    const token =
      (
        await Notifications.getExpoPushTokenAsync(
          {
            projectId,
          }
        )
      ).data;

    console.log(
      'Expo Push Token:',
      token
    );

    /*
     * GET CURRENT USER
     */

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      console.log(
        'No logged-in user found.'
      );

      return token;
    }

    /*
     * SAVE TOKEN TO SUPABASE
     */

    const {
      error,
    } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: user.id,
          expo_push_token: token,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            'expo_push_token',
        }
      );

    if (error) {
      console.error(
        'Error saving push token:',
        error.message
      );
    } else {
      console.log(
        'Push token saved successfully.'
      );
    }

    return token;
  } catch (error) {
    console.error(
      'Push notification registration error:',
      error
    );

    return null;
  }
}