import React, { useState, useRef } from 'react';
import { moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Easing,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { loginApi } from '../../api';
import AppIcon from '../../components/AppIcon';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      shake();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await loginApi(username.trim(), password.trim());

      if (res.status === 'success') {
        if (res.skip_otp) {
          const fullname = res.message.replace('Welcome ', '').replace('!', '');
          navigation.replace('Home', { fullname });
        } else {
          navigation.navigate('Otp', {
            whatsappUrl: res.whatsapp_url ?? '',
            username: username.trim()
          });
        }
      } else {
        setError(res.message || 'Login failed. Please try again.');
        shake();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Network error. Please check your connection.';
      setError(msg);
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.gradient}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

            <View style={styles.brandContainer}>
              <View style={styles.logoCircle}>
                <Image source={require('../../assets/splash.png')} style={styles.logoImage} resizeMode="contain" />
              </View>
              <Text style={styles.brandTitle}>SNMP-Remote Monitoring System</Text>
              <Text style={styles.brandSubtitle}>Shroti Telecom Pvt. Ltd.</Text>
            </View>

            <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
              <Text style={styles.cardTitle}>Welcome Back</Text>
              <Text style={styles.cardSubtitle}>Sign in to continue</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>User ID</Text>
                <View style={styles.inputWrapper}>
                  <AppIcon name="user" size={16} color="#94a3b8" style={{ marginRight: moderateScale(10) }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your User ID"
                    placeholderTextColor="#94a3b8"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <AppIcon name="lock" size={16} color="#94a3b8" style={{ marginRight: moderateScale(10) }} />
                  <TextInput
                    style={[styles.input, styles.inputPassword]}
                    placeholder="Enter your password"
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                    <AppIcon name={showPassword ? 'eye-off' : 'eye'} size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <AppIcon name="alert-triangle" size={14} color="#ef4444" style={{ marginRight: moderateScale(8) }} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[styles.loginBtn, loading && styles.loginBtnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginBtnGradient}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>After signing in, you'll receive a WhatsApp OTP for two-factor authentication.</Text>
              </View>
            </Animated.View>

            <Text style={styles.footer}>© 2026 Shroti Telecom Pvt. Ltd.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: moderateScale(24), paddingVertical: verticalScale(40) },
  brandContainer: { alignItems: 'center', marginBottom: verticalScale(35) },
  logoCircle: {
    width: moderateScale(100),
    height: verticalScale(100),
    borderRadius: 55,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(20),
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(4) },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  logoImage: { width: moderateScale(65), height: verticalScale(65) },
  brandTitle: { fontSize: responsiveFontSize(24), fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: 0.5 },
  brandSubtitle: { fontSize: responsiveFontSize(13), color: '#a0a5ba', marginTop: verticalScale(4), textAlign: 'center' },
  card: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: moderateScale(28), borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardTitle: { fontSize: responsiveFontSize(24), fontWeight: '800', color: '#fff', marginBottom: verticalScale(4) },
  cardSubtitle: { fontSize: responsiveFontSize(14), color: '#8a8fa8', marginBottom: verticalScale(28) },
  inputGroup: { marginBottom: verticalScale(18) },
  label: { fontSize: responsiveFontSize(13), fontWeight: '600', color: '#c0c6e8', marginBottom: verticalScale(8), letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: moderateScale(14) },
  inputIcon: { fontSize: responsiveFontSize(16), marginRight: moderateScale(10) },
  input: { flex: 1, height: verticalScale(52), color: '#fff', fontSize: responsiveFontSize(15) },
  inputPassword: { paddingRight: moderateScale(8) },
  eyeBtn: { padding: moderateScale(4) },
  eyeIcon: { fontSize: responsiveFontSize(18) },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 10, padding: moderateScale(12), marginBottom: verticalScale(16), borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  errorIcon: { fontSize: responsiveFontSize(14), marginRight: moderateScale(8) },
  errorText: { color: '#fca5a5', fontSize: responsiveFontSize(13), flex: 1 },
  loginBtn: { marginTop: verticalScale(8), borderRadius: 14, overflow: 'hidden' },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnGradient: { height: verticalScale(54), justifyContent: 'center', alignItems: 'center' },
  loginBtnText: { color: '#fff', fontSize: responsiveFontSize(16), fontWeight: '700', letterSpacing: 1 },
  infoBox: { marginTop: verticalScale(20), backgroundColor: 'rgba(102, 126, 234, 0.1)', borderRadius: 10, padding: moderateScale(12), borderWidth: 1, borderColor: 'rgba(102, 126, 234, 0.2)' },
  infoText: { color: '#a5b4fc', fontSize: responsiveFontSize(12), lineHeight: 18 },
  footer: { color: 'rgba(255,255,255,0.3)', fontSize: responsiveFontSize(11), textAlign: 'center', marginTop: verticalScale(32) },
});
