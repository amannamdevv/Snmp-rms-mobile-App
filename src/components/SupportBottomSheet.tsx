import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Linking,
  Pressable,
  TouchableOpacity,
  Text,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Feather from 'react-native-vector-icons/Feather';
import { api } from '../api';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';

export interface SupportData {
  id?: number;
  number1?: string;
  number2?: string;
  email1?: string;
  whatsapp?: string;
  whatsapp_link?: string;
  telegram_bot_name?: string;
}

interface SupportBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  isDark?: boolean;
}

const DEFAULT_SUPPORT: SupportData = {
  number1: '07553122002',
  number2: '07553122005',
  email1: 'TPMS.Support@shrotigroup.in',
  whatsapp: '919755522181',
  telegram_bot_name: 'https://t.me/Shroti_Internal_Bot',
};

const SupportBottomSheet: React.FC<SupportBottomSheetProps> = ({
  visible,
  onClose,
  isDark = false,
}) => {
  const [supportData, setSupportData] = useState<SupportData>(DEFAULT_SUPPORT);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isActive = true;
    if (visible) {
      setLoading(true);
      api.getSupportDetails()
        .then((res: any) => {
          if (!isActive) return;
          if (res && res.success && res.data) {
            setSupportData(res.data);
          } else if (res && res.data) {
            setSupportData(res.data);
          }
        })
        .catch(err => {
          console.warn('[SupportBottomSheet] fetch error:', err);
        })
        .finally(() => {
          if (isActive) setLoading(false);
        });
    }
    return () => {
      isActive = false;
    };
  }, [visible]);

  if (!visible) return null;

  const openWhatsApp = async () => {
    if (supportData.whatsapp_link) {
      try {
        await Linking.openURL(supportData.whatsapp_link);
        return;
      } catch (_) {}
    }
    const phone = supportData.whatsapp || '919755522181';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    try {
      const waAppUrl = `whatsapp://send?phone=${cleanPhone}`;
      const supported = await Linking.canOpenURL(waAppUrl);
      if (supported) {
        await Linking.openURL(waAppUrl);
      } else {
        await Linking.openURL(`https://wa.me/${cleanPhone}`);
      }
    } catch {
      await Linking.openURL(`https://wa.me/${cleanPhone}`);
    }
  };

  const openTelegram = async () => {
    const rawTelegram = supportData.telegram_bot_name || 'https://t.me/Shroti_Internal_Bot';
    const botUser = rawTelegram.replace('https://t.me/', '').replace('tg://resolve?domain=', '').trim();
    try {
      const nativeTgUrl = `tg://resolve?domain=${botUser}`;
      const supported = await Linking.canOpenURL(nativeTgUrl);
      if (supported) {
        await Linking.openURL(nativeTgUrl);
      } else {
        await Linking.openURL(`https://t.me/${botUser}`);
      }
    } catch {
      await Linking.openURL(rawTelegram.startsWith('http') ? rawTelegram : `https://t.me/${botUser}`);
    }
  };

  const handleCall = (num?: string) => {
    if (!num) return;
    Linking.openURL(`tel:${num.trim()}`).catch(e => console.warn('Call error:', e));
  };

  const handleEmail = (email?: string) => {
    if (!email) return;
    Linking.openURL(`mailto:${email.trim()}`).catch(e => console.warn('Email error:', e));
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.backDrop}>
        <Pressable onPress={onClose} style={styles.backdropPressable} />

        <Animatable.View
          style={[
            styles.bottomSheet,
            { backgroundColor: isDark ? '#1e293b' : '#ffffff' },
          ]}
          duration={300}
          animation="slideInUp"
          useNativeDriver
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { backgroundColor: isDark ? '#0f172a' : '#1e3c72' },
            ]}
          >
            <View style={styles.headerLeft}>
              <View style={styles.headerIconWrap}>
                <MaterialCommunityIcons name="headset" size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.title}>Help & Support</Text>
                <Text style={styles.headerSubtitle}>24/7 Technical Assistance</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {loading && <ActivityIndicator size="small" color="#fff" />}
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.container}>
            <Text style={[styles.subText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              Facing any issue? Connect directly with our support team:
            </Text>

            {/* Hotline 1 */}
            {supportData.number1 ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleCall(supportData.number1)}
              >
                <View
                  style={[
                    styles.box,
                    {
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    },
                  ]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(30, 60, 114, 0.12)' }]}>
                    <MaterialCommunityIcons
                      name="phone"
                      size={22}
                      color={isDark ? '#60a5fa' : '#1e3c72'}
                    />
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.channelLabel}>Primary Hotline</Text>
                    <Text
                      style={[
                        styles.text,
                        { color: isDark ? '#f8fafc' : '#1e293b' },
                      ]}
                    >
                      {supportData.number1}
                    </Text>
                  </View>
                  <View style={styles.actionPill}>
                    <Text style={styles.actionPillText}>Call</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Hotline 2 */}
            {supportData.number2 ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleCall(supportData.number2)}
              >
                <View
                  style={[
                    styles.box,
                    {
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    },
                  ]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(30, 60, 114, 0.12)' }]}>
                    <MaterialCommunityIcons
                      name="phone-in-talk"
                      size={22}
                      color={isDark ? '#60a5fa' : '#1e3c72'}
                    />
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.channelLabel}>Secondary Hotline</Text>
                    <Text
                      style={[
                        styles.text,
                        { color: isDark ? '#f8fafc' : '#1e293b' },
                      ]}
                    >
                      {supportData.number2}
                    </Text>
                  </View>
                  <View style={styles.actionPill}>
                    <Text style={styles.actionPillText}>Call</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : null}

            {/* WhatsApp */}
            {supportData.whatsapp ? (
              <TouchableOpacity activeOpacity={0.7} onPress={openWhatsApp}>
                <View
                  style={[
                    styles.box,
                    {
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    },
                  ]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(37, 211, 102, 0.14)' }]}>
                    <MaterialCommunityIcons
                      name="whatsapp"
                      size={24}
                      color="#25D366"
                    />
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.channelLabel}>WhatsApp Support</Text>
                    <Text
                      style={[
                        styles.text,
                        { color: isDark ? '#f8fafc' : '#1e293b' },
                      ]}
                    >
                      +{supportData.whatsapp}
                    </Text>
                  </View>
                  <View style={[styles.actionPill, { backgroundColor: '#dcfce7' }]}>
                    <Text style={[styles.actionPillText, { color: '#15803d' }]}>Chat</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Telegram Bot */}
            <TouchableOpacity activeOpacity={0.7} onPress={openTelegram}>
              <View
                style={[
                  styles.box,
                  {
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                  },
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(42, 171, 238, 0.14)' }]}>
                  <FontAwesome5
                    name="telegram-plane"
                    size={20}
                    color="#2AABEE"
                  />
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.channelLabel}>Telegram Bot Assistant</Text>
                  <Text
                    style={[
                      styles.text,
                      { color: isDark ? '#f8fafc' : '#1e293b' },
                    ]}
                  >
                    Shroti Internal Bot
                  </Text>
                </View>
                <View style={[styles.actionPill, { backgroundColor: '#e0f2fe' }]}>
                  <Text style={[styles.actionPillText, { color: '#0369a1' }]}>Open</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Email */}
            {supportData.email1 ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleEmail(supportData.email1)}
              >
                <View
                  style={[
                    styles.box,
                    {
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    },
                  ]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(14, 165, 233, 0.12)' }]}>
                    <MaterialCommunityIcons
                      name="email-outline"
                      size={22}
                      color="#0ea5e9"
                    />
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.channelLabel}>Email Helpdesk</Text>
                    <Text
                      style={[
                        styles.text,
                        { color: isDark ? '#f8fafc' : '#1e293b' },
                      ]}
                    >
                      {supportData.email1}
                    </Text>
                  </View>
                  <View style={[styles.actionPill, { backgroundColor: '#f0f9ff' }]}>
                    <Text style={[styles.actionPillText, { color: '#0284c7' }]}>Mail</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </Animatable.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backDrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  backdropPressable: {
    flex: 1,
    width: '100%',
  },
  bottomSheet: {
    width: '100%',
    paddingBottom: verticalScale(28),
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: verticalScale(14),
    paddingHorizontal: moderateScale(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
  },
  headerIconWrap: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: responsiveFontSize(17),
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: responsiveFontSize(11),
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    paddingHorizontal: moderateScale(18),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(8),
  },
  subText: {
    fontSize: responsiveFontSize(12),
    marginBottom: verticalScale(8),
    lineHeight: 18,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(11),
    paddingHorizontal: moderateScale(14),
    marginTop: verticalScale(8),
    borderRadius: moderateScale(14),
    borderWidth: 1,
  },
  iconCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  infoCol: {
    flex: 1,
  },
  channelLabel: {
    fontSize: responsiveFontSize(10),
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  text: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
  },
  actionPill: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(30, 60, 114, 0.08)',
  },
  actionPillText: {
    fontSize: responsiveFontSize(11),
    fontWeight: '700',
    color: '#1e3c72',
  },
});

export default SupportBottomSheet;
