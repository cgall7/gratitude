import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_400Regular_Italic,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DancingScript_700Bold } from '@expo-google-fonts/dancing-script';

// Maps every family name referenced in theme.js to the module useFonts()
// needs to register it under. Keep this in sync with src/constants/theme.js.
// Note: RN only renders italic/weight variants a custom font actually ships
// as a distinct family — `fontStyle: 'italic'` on a Regular-only family is a
// silent no-op, so quote treatments register the real italic cut here.
// Nunito (Bold/ExtraBold) is the Sunbeam display face (GRATITUDE_DESIGN_SYSTEM_V1
// §2) — Inter stays registered below only as a fallback; nothing references it.
export const fontAssets = {
  'Inter-Regular': Inter_400Regular,
  'Inter-SemiBold': Inter_600SemiBold,
  'Inter-Bold': Inter_700Bold,
  'Inter-ExtraBold': Inter_800ExtraBold,
  'Nunito-Bold': Nunito_700Bold,
  'Nunito-ExtraBold': Nunito_800ExtraBold,
  'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
  'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
  'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
  'PlusJakartaSans-Italic': PlusJakartaSans_400Regular_Italic,
  'DancingScript-Bold': DancingScript_700Bold,
};
