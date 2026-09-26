import {
    StyleSheet,
    Text,
    View,
} from 'react-native';

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
      <Text style={styles.title}>
        {title}
      </Text>

      <Text style={styles.subtitle}>
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#1B5E20',
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 24,
  },

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