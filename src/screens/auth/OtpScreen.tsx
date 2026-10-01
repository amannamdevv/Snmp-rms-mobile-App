import React, { useState, useRef, useEffect } from 'react';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../../utils/responsive';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Easing,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { verifyOtpApi } from '../../api';
import AppIcon from '../../components/AppIcon';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Otp'>;

const OtpCell = ({ value, focused }: { value: string; focused: boolean }) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (focused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [focused, pulse]);

  return (
    <Animated.View style={[styles.otpCell, focused && styles.otpCellFocused, { transform: [{ scale: pulse }] }]}>
      <Text style={styles.otpCellText}>{value || (focused ? '|' : '')}</Text>
    </Animated.View>
  );
};

export default function OtpScreen({ navigation, route }: Props) {
  const { whatsappUrl, username } = route.params;

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inputRef = useRef<TextInput>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  };

  const openWhatsApp = () => {
    if (whatsappUrl) {
      Linking.openURL(whatsappUrl).catch(() => setError('Could not open WhatsApp. Please install it.'));
    }
  };

  const handleVerify = async () => {
    if (!otp.trim() || otp.length < 4) {
      setError('Please enter the OTP you received.');
      shake();
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await verifyOtpApi(otp.trim(), username);
      if (res.status === 'success') {
        setSuccess(res.message);
        setTimeout(() => {
          const fullname = res.message.replace('Welcome ', '').replace('!', '').trim();
          navigation.replace('Home', { fullname });
        }, 800);
      } else {
        setError(res.message || 'OTP verification failed.');
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

  const otpDigits = otp.split('').slice(0, 6);
  while (otpDigits.length < 6) otpDigits.push('');

  return (
    <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.gradient}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>Back to Login</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.logoCircle}>
                <Image source={require('../../assets/splash.png')} style={styles.logoImage} resizeMode="contain" />
              </View>
              <Text style={styles.title}>WhatsApp OTP Verification</Text>
              <Text style={styles.subtitle}>Two-factor authentication required</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.step}>
                <View style={styles.stepNumBadge}><Text style={styles.stepNum}>1</Text></View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Open WhatsApp</Text>
                  <Text style={styles.stepDesc}>Tap the button below to open WhatsApp and send the authentication message.</Text>
                  <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsApp} activeOpacity={0.85}>
                    <LinearGradient colors={['#25d366', '#128c7e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.whatsappBtnGradient}>
                      <AppIcon name="message-circle" size={18} color="#fff" style={{ marginRight: moderateScale(8) }} />
                      <Text style={styles.whatsappBtnText}>Open WhatsApp</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.step}>
                <View style={styles.stepNumBadge}><Text style={styles.stepNum}>2</Text></View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Enter OTP</Text>
                  <Text style={styles.stepDesc}>Enter the OTP code you receive on WhatsApp below.</Text>

                  <Animated.View style={[styles.otpContainer, { transform: [{ translateX: shakeAnim }] }]}>
                    <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
                      <View style={styles.otpRow} pointerEvents="none">
                        {otpDigits.map((digit, i) => (
                          <OtpCell key={i} value={digit} focused={i === otp.length && otp.length < 6} />
                        ))}
                      </View>
                    </TouchableOpacity>
                    <TextInput
                      ref={inputRef}
                      value={otp}
                      onChangeText={v => {
                        const cleaned = v.replace(/[^0-9]/g, '').slice(0, 6);
                        setOtp(cleaned);
                        setError('');
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={styles.hiddenInput}
                      autoFocus
                    />
                  </Animated.View>

                  {error ? (
                    <View style={styles.errorBox}>
                      <AppIcon name="alert-triangle" size={14} color="#ef4444" style={{ marginRight: moderateScale(8) }} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {success ? (
                    <View style={styles.successBox}>
                      <AppIcon name="check-circle" size={14} color="#10b981" style={{ marginRight: moderateScale(8) }} />
                      <Text style={styles.successText}>{success}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]} onPress={handleVerify} disabled={loading} activeOpacity={0.85}>
                    <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.verifyBtnGradient}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyBtnText}>Verify & Login</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>OTP is valid for 5 minutes only.{'\n'}Make sure WhatsApp is installed on your device.</Text>
            </View>

            <Text style={styles.footer}>© 2026 Shroti Telecom Pvt. Ltd.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, gradient: { flex: 1 }, scrollContent: { flexGrow: 1, paddingHorizontal: moderateScale(24), paddingVertical: verticalScale(20), paddingBottom: verticalScale(40) },
  backBtn: { alignSelf: 'flex-start', paddingVertical: verticalScale(8), paddingHorizontal: moderateScale(4), marginBottom: verticalScale(24) },
  backBtnText: { color: '#667eea', fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: verticalScale(35) },
  logoCircle: {
    width: moderateScale(100),
    height: verticalScale(100),
    borderRadius: 50,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(16),
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(4) },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  logoImage: { width: moderateScale(65), height: verticalScale(65) },
  title: { fontSize: responsiveFontSize(24), flexShrink: 1, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: 0.5 },
  subtitle: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#a0a5ba', marginTop: verticalScale(4), textAlign: 'center' },
  card: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: moderateScale(24), borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  step: { flexDirection: 'row', alignItems: 'flex-start' },
  stepNumBadge: { width: moderateScale(28), height: verticalScale(28), borderRadius: 14, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center', marginRight: moderateScale(14), marginTop: verticalScale(2), flexShrink: 0 },
  stepNum: { color: '#fff', fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700' }, stepContent: { flex: 1 },
  stepTitle: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '700', color: '#fff', marginBottom: verticalScale(6) },
  stepDesc: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#8a8fa8', lineHeight: 20, marginBottom: verticalScale(16) },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: verticalScale(20) },
  whatsappBtn: { borderRadius: 12, overflow: 'hidden' },
  whatsappBtnGradient: { height: verticalScale(48), justifyContent: 'center', alignItems: 'center' },
  whatsappBtnText: { color: '#fff', fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '700' },
  otpContainer: { marginBottom: verticalScale(16) }, otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(4) },
  otpCell: { width: moderateScale(44), height: verticalScale(54), borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  otpCellFocused: { borderColor: '#667eea', backgroundColor: 'rgba(102, 126, 234, 0.1)' },
  otpCellText: { color: '#fff', fontSize: responsiveFontSize(22), flexShrink: 1, fontWeight: '700' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 10, padding: moderateScale(12), marginBottom: verticalScale(16), borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  errorIcon: { fontSize: responsiveFontSize(14), flexShrink: 1, marginRight: moderateScale(8) }, errorText: { color: '#fca5a5', fontSize: responsiveFontSize(13), flexShrink: 1, flex: 1 },
  successBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34, 197, 94, 0.15)', borderRadius: 10, padding: moderateScale(12), marginBottom: verticalScale(16), borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' },
  successIcon: { fontSize: responsiveFontSize(14), flexShrink: 1, marginRight: moderateScale(8) }, successText: { color: '#86efac', fontSize: responsiveFontSize(13), flexShrink: 1, flex: 1 },
  verifyBtn: { borderRadius: 12, overflow: 'hidden' }, verifyBtnDisabled: { opacity: 0.7 },
  verifyBtnGradient: { height: verticalScale(52), justifyContent: 'center', alignItems: 'center' },
  verifyBtnText: { color: '#fff', fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '700', letterSpacing: 0.5 },
  noteBox: { marginTop: verticalScale(20), backgroundColor: 'rgba(102, 126, 234, 0.08)', borderRadius: 12, padding: moderateScale(14), borderWidth: 1, borderColor: 'rgba(102, 126, 234, 0.15)' },
  noteText: { color: '#a5b4fc', fontSize: responsiveFontSize(12), flexShrink: 1, lineHeight: 20 },
  footer: { color: 'rgba(255,255,255,0.3)', fontSize: responsiveFontSize(11), flexShrink: 1, textAlign: 'center', marginTop: verticalScale(28) },
});
