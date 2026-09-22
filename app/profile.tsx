import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BottomNav from '../components/BottomNav';
import { supabase } from '../lib/supabase';

export default function Profile() {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserEmail();
  }, []);

  const getUserEmail = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setEmail(user.email ?? '');
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);

    const { error } = await supabase.auth.signOut({
      scope: 'local',
    });

    if (error) {
      console.log('Logout error:', error.message);
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header */}
          <View style={styles.header}>
            <View style={styles.profileIcon}>
              <Ionicons
                name="person"
                size={38}
                color="#1B5E20"
              />
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.name}>
                Personnel
              </Text>

              {loading ? (
                <ActivityIndicator
                  size="small"
                  color="#DDEBDD"
                  style={styles.emailLoader}
                />
              ) : (
                <Text
                  style={styles.email}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {email || 'No email available'}
                </Text>
              )}
            </View>
          </View>

          {/* Access Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Access Information
            </Text>

            <View style={styles.card}>
              {/* Access Level */}
              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={21}
                    color="#1B5E20"
                  />
                </View>

                <View style={styles.infoText}>
                  <Text style={styles.label}>
                    Access Level
                  </Text>

                  <Text style={styles.value}>
                    Authorized Personnel
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Access Place */}
              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Ionicons
                    name="location-outline"
                    size={21}
                    color="#1B5E20"
                  />
                </View>

                <View style={styles.infoText}>
                  <Text style={styles.label}>
                    Access Place
                  </Text>

                  <Text style={styles.value}>
                    CLIRDEC Building
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* System Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              System Information
            </Text>

            <View style={styles.card}>
              {/* System */}
              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Ionicons
                    name="trash-outline"
                    size={21}
                    color="#1B5E20"
                  />
                </View>

                <View style={styles.infoText}>
                  <Text style={styles.label}>
                    System
                  </Text>

                  <Text style={styles.value}>
                    OmniBin Waste Management System
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Application */}
              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={21}
                    color="#1B5E20"
                  />
                </View>

                <View style={styles.infoText}>
                  <Text style={styles.label}>
                    Application
                  </Text>

                  <Text style={styles.value}>
                    OmniBin
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Version */}
              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={21}
                    color="#1B5E20"
                  />
                </View>

                <View style={styles.infoText}>
                  <Text style={styles.label}>
                    Version
                  </Text>

                  <Text style={styles.value}>
                    1.0.0
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Logout */}
          <Pressable
            style={styles.logoutButton}
            onPress={() => setShowLogoutModal(true)}
          >
            <Ionicons
              name="log-out-outline"
              size={21}
              color="#C62828"
            />

            <Text style={styles.logoutText}>
              Log Out
            </Text>
          </Pressable>
        </ScrollView>

        <BottomNav />
      </View>

      {/* Logout Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowLogoutModal(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons
                name="log-out-outline"
                size={30}
                color="#C62828"
              />
            </View>

            <Text style={styles.modalTitle}>
              Log Out
            </Text>

            <Text style={styles.modalMessage}>
              Are you sure you want to log out?
            </Text>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() =>
                  setShowLogoutModal(false)
                }
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={styles.confirmButton}
                onPress={handleLogout}
              >
                <Text style={styles.confirmText}>
                  Log Out
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7F5',
  },

  container: {
    flex: 1,
    backgroundColor: '#F5F7F5',
  },

  content: {
    paddingBottom: 25,
  },

  /* Profile Header */
  header: {
    backgroundColor: '#1B5E20',
    paddingTop: 55,
    paddingBottom: 30,
    paddingHorizontal: 24,

    flexDirection: 'row',
    alignItems: 'center',
  },

  profileIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 18,
  },

  profileInfo: {
    flex: 1,
  },

  name: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: 'bold',
  },

  email: {
    color: '#DDEBDD',
    fontSize: 14,
    marginTop: 5,
  },

  emailLoader: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },

  /* Sections */
  section: {
    marginTop: 22,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222222',
    marginHorizontal: 20,
    marginBottom: 10,
  },

  /* Cards */
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 18,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,

    elevation: 2,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,

    backgroundColor: '#E8F5E9',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 14,
  },

  infoText: {
    flex: 1,
  },

  label: {
    color: '#999999',
    fontSize: 12,
    marginBottom: 3,
  },

  value: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 15,
  },

  /* Logout */
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 25,
    marginBottom: 10,

    height: 52,
    borderRadius: 14,

    backgroundColor: '#FFFFFF',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 1,
    borderColor: '#FFCDD2',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 4,

    elevation: 2,
  },

  logoutText: {
    color: '#C62828',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  /* Logout Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },

  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,

    elevation: 5,
  },

  modalIcon: {
    width: 55,
    height: 55,
    borderRadius: 28,

    backgroundColor: '#FFEBEE',

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222222',
    textAlign: 'center',
  },

  modalMessage: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },

  modalButtons: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },

  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },

  cancelText: {
    color: '#555555',
    fontSize: 15,
    fontWeight: '600',
  },

  confirmButton: {
    flex: 1,
    backgroundColor: '#C62828',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },

  confirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});