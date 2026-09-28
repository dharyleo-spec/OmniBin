import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

type HeaderProps = {
  title: string;
  subtitle: string;
};

export default function Header({
  title,
  subtitle,
}: HeaderProps) {
  return (
    <View style={styles.header}>

      {/* MAIN GRADIENT */}
      <LinearGradient
        colors={[
          '#123D18',
          '#1B5E20',
          '#2E7D32',
          '#1B5E20',
        ]}
        locations={[
          0,
          0.35,
          0.7,
          1,
        ]}
        start={{
          x: 0,
          y: 0,
        }}
        end={{
          x: 1,
          y: 1,
        }}
        style={styles.gradient}
      >

        {/* MESH LIGHT 1 */}
        <LinearGradient
          colors={[
            'rgba(129, 199, 132, 0.30)',
            'rgba(129, 199, 132, 0)',
          ]}
          start={{
            x: 0,
            y: 0,
          }}
          end={{
            x: 1,
            y: 1,
          }}
          style={styles.meshOne}
        />

        {/* MESH LIGHT 2 */}
        <LinearGradient
          colors={[
            'rgba(76, 175, 80, 0)',
            'rgba(76, 175, 80, 0.30)',
          ]}
          start={{
            x: 1,
            y: 0,
          }}
          end={{
            x: 0,
            y: 1,
          }}
          style={styles.meshTwo}
        />

        {/* CONTENT */}
        <View style={styles.content}>

          <Text style={styles.title}>
            {title}
          </Text>

          <Text style={styles.subtitle}>
            {subtitle}
          </Text>

        </View>

      </LinearGradient>

    </View>
  );
}

const styles = StyleSheet.create({

  header: {
    overflow: 'hidden',
  },

  gradient: {
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 24,

    position: 'relative',
    overflow: 'hidden',
  },

  content: {
    position: 'relative',
    zIndex: 3,
  },

  /*
   * MESH AREAS
   */

  meshOne: {
    position: 'absolute',

    width: 230,
    height: 170,

    top: -80,
    left: -50,

    borderRadius: 120,

    transform: [
      {
        rotate: '-20deg',
      },
    ],
  },

  meshTwo: {
    position: 'absolute',

    width: 260,
    height: 180,

    top: -50,
    right: -80,

    borderRadius: 130,

    transform: [
      {
        rotate: '25deg',
      },
    ],
  },

  /*
   * TEXT
   */

  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
  },

  subtitle: {
    color: '#DDEBDD',
    fontSize: 14,
    marginTop: 4,
  },

});