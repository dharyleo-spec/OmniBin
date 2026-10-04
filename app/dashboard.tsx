import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import BinMonitor from '../components/BinMonitor';
import BottomNav from '../components/BottomNav';
import Header from '../components/Header';

export default function Dashboard() {
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  /*
   * =====================================================
   * REFRESH MONITOR
   * =====================================================
   */

  const refreshMonitor = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  /*
   * =====================================================
   * AUTO REFRESH
   * =====================================================
   *
   * This gives the dashboard another refresh every
   * 10 seconds. Supabase Realtime is still handled
   * inside BinMonitor.
   */

  useEffect(() => {
    const interval = setInterval(() => {
      refreshMonitor();
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [refreshMonitor]);

  return (
    <View style={styles.container}>

      {/* HEADER */}

      <Header
        title="Dashboard"
        subtitle="Smart waste monitoring"
      />

      {/* CONTENT */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* =================================================
            WELCOME
            ================================================= */}

        <View style={styles.welcomeContainer}>

          <Text style={styles.welcomeTitle}>
            Welcome to OmniBin
          </Text>

          <Text style={styles.welcomeText}>
            Monitor the current condition of the smart
            trashcan and view its sensor activity.
          </Text>

        </View>

        {/* =================================================
            LIVE TRASHCAN
            ================================================= */}

        <BinMonitor
          reloadKey={reloadKey}
        />

      </ScrollView>

      {/* =================================================
          BOTTOM NAVIGATION
          ================================================= */}

      <BottomNav />

    </View>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F5F7F5',
  },

  scrollView: {
    flex: 1,
  },

  content: {
    paddingBottom: 110,
  },

  welcomeContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },

  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222222',
  },

  welcomeText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 19,
    marginTop: 5,
  },

});