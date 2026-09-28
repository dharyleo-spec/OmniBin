import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export async function registerForPushNotifications() {
  try {
    /*
     * =====================================================
     * ANDROID NOTIFICATION CHANNEL
     * =====================================================
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

          sound: 'omnibin_alert',

          enableVibrate: true,

          showBadge: true,
        }
      );

      console.log(
        'ANDROID NOTIFICATION CHANNEL READY'
      );
    }

    /*
     * =====================================================
     * CHECK NOTIFICATION PERMISSION
     * =====================================================
     */

    const {
      status: existingStatus,
    } =
      await Notifications.getPermissionsAsync();

    let finalStatus =
      existingStatus;

    /*
     * =====================================================
     * REQUEST NOTIFICATION PERMISSION
     * =====================================================
     */

    if (
      existingStatus !==
      'granted'
    ) {
      const {
        status,
      } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (
      finalStatus !==
      'granted'
    ) {
      console.log(
        'PUSH NOTIFICATION PERMISSION DENIED'
      );

      return null;
    }

    console.log(
      'PUSH NOTIFICATION PERMISSION GRANTED'
    );

    /*
     * =====================================================
     * GET EXPO PROJECT ID
     * =====================================================
     */

    const projectId =
      Constants?.expoConfig?.extra?.eas
        ?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.error(
        'EXPO PROJECT ID NOT FOUND'
      );

      return null;
    }

    console.log(
      'EXPO PROJECT ID:',
      projectId
    );

    /*
     * =====================================================
     * GET EXPO PUSH TOKEN
     * =====================================================
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
      '================================='
    );

    console.log(
      'EXPO PUSH TOKEN:',
      token
    );

    console.log(
      '================================='
    );

    /*
     * =====================================================
     * GET CURRENT USER
     * =====================================================
     */

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError) {
      console.error(
        'USER ERROR:',
        userError.message
      );

      return token;
    }

    if (!user) {
      console.log(
        'NO LOGGED-IN USER FOUND'
      );

      return token;
    }

    console.log(
      'USER ID:',
      user.id
    );

    /*
     * =====================================================
     * SAVE TOKEN TO SUPABASE
     * =====================================================
     */

    const {
      error,
    } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id:
            user.id,

          expo_push_token:
            token,

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
        'ERROR SAVING PUSH TOKEN:',
        error.message
      );
    } else {
      console.log(
        'PUSH TOKEN SAVED SUCCESSFULLY'
      );
    }

    return token;

  } catch (error) {

    console.error(
      'PUSH NOTIFICATION REGISTRATION ERROR:',
      error
    );

    return null;
  }
}