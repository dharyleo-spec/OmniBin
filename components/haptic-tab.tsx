import * as Haptics from 'expo-haptics';
import { Platform, Pressable } from 'react-native';

export function HapticTab(props: any) {
  const handlePressIn = () => {
    // Triggers a light physical vibration feedback when clicked
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <Pressable
      {...props}
      onPressIn={handlePressIn}
      style={({ pressed }) => [
        props.style,
        { opacity: pressed ? 0.7 : 1 }
      ]}
    />
  );
}
