import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Feather from 'react-native-vector-icons/Feather';

import { api } from '../../api';
import AppHeader from '../../components/AppHeader';
import {
  scale,
  verticalScale,
  moderateScale,
  responsiveFontSize,
} from '../../utils/responsive';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SupportApiData {
  id?: number;
  number1?: string;
  number2?: string;
  whatsapp?: string;
  whatsapp_link?: string;
  telegram_bot_name?: string;
  email1?: string;
  updated_at?: string;
}

const FAQS_DATA = [
  {
    q: 'Why is a site showing as Non-Communicating?',
    a: 'Sites may show as non-communicating due to power outages, SIM network disconnection, or local router downtime. Check site DC power and MQTT gateway status.',
  },
  {
    q: 'How frequently are SNMP alarm and telemetry logs refreshed?',
    a: 'Logs and alarms synchronize automatically every 30 seconds via MQTT and background polling.',
  },
  {
    q: 'How are Battery Health and DCEM metrics calculated?',
    a: 'Battery Health scores evaluate discharge efficiency, voltage drop curves, and charge cycles recorded over the active window.',
  },
  {
    q: 'How to request access for SNMP RMS Write Commands?',
    a: 'Write commands require elevated authorization. Contact your administrator to enable permissions in User Management.',
  },
  {
    q: 'Experiencing OTP or Login authentication issues?',
    a: 'Ensure your registered mobile number has active network reception. You can also contact our 24/7 helpline for immediate account verification.',
  },
];

export default function SupportRequiredScreen({ navigation }: any) {
  const [supportData, setSupportData] = useState<SupportApiData | null>(null);
  const [loadingSupport, setLoadingSupport] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const fetchSupport = useCallback(async () => {
    try {
      const res: any = await api.getSupportDetails();
      if (res && res.success && res.data) {
        setSupportData(res.data);
      } else if (res && res.data) {
        setSupportData(res.data);
      }
    } catch (e) {
      console.warn('[SupportRequiredScreen] fetch error:', e);
    } finally {
      setLoadingSupport(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSupport();
  }, [fetchSupport]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSupport();
  };

  const handleCall = (num?: string) => {
    const targetNum = num || supportData?.number1 || '07553122002';
    Linking.openURL('tel:' + targetNum.trim()).catch(e => console.warn('Call error:', e));
  };

  const handleEmail = (email?: string) => {
    const targetEmail = email || supportData?.email1 || 'TPMS.Support@shrotigroup.in';
    Linking.openURL('mailto:' + targetEmail.trim()).catch(e => console.warn('Email error:', e));
  };

  const openWhatsApp = async () => {
    if (supportData?.whatsapp_link) {
      try {
        await Linking.openURL(supportData.whatsapp_link);
        return;
      } catch (_) {}
    }
    const phone = supportData?.whatsapp || '919755522181';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    try {
      const waUrl = 'whatsapp://send?phone=' + cleanPhone;
      const supported = await Linking.canOpenURL(waUrl);
      if (supported) {
        await Linking.openURL(waUrl);
      } else {
        await Linking.openURL('https://wa.me/' + cleanPhone);
      }
    } catch {
      await Linking.openURL('https://wa.me/' + cleanPhone);
    }
  };

  const openTelegram = async () => {
    const rawTelegram = supportData?.telegram_bot_name || 'https://t.me/Shroti_Internal_Bot';
    const botUser = rawTelegram.replace('https://t.me/', '').replace('tg://resolve?domain=', '').trim();
    try {
      const nativeTg = 'tg://resolve?domain=' + botUser;
      const supported = await Linking.canOpenURL(nativeTg);
      if (supported) {
        await Linking.openURL(nativeTg);
      } else {
        await Linking.openURL('https://t.me/' + botUser);
      }
    } catch {
      await Linking.openURL(rawTelegram.startsWith('http') ? rawTelegram : 'https://t.me/' + botUser);
    }
  };

  const toggleFaq = (idx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === idx ? null : idx);
  };

  const displayPhone1 = supportData?.number1 || '07553122002';
  const displayPhone2 = supportData?.number2 || '07553122005';
  const displayWhatsApp = supportData?.whatsapp
    ? ('+' + supportData.whatsapp.replace(/^(\d{2})(\d{5})(\d{5})$/, '$1 $2 $3'))
    : '+91 9755522181';
  const displayTelegram = supportData?.telegram_bot_name
    ? supportData.telegram_bot_name.replace('https://t.me/', '')
    : 'Shroti_Internal_Bot';
  const displayEmail = supportData?.email1 || 'TPMS.Support@shrotigroup.in';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerWrapper}>
        <AppHeader
          title="Help & Support"
          leftAction="back"
          onLeftPress={() => navigation.goBack()}
          hideGlobalFilter={true}
        />

        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
        >
          {/* HERO BANNER */}
          <View style={styles.heroCard}>
            <View style={styles.heroLeftIconCircle}>
              <MaterialCommunityIcons name="headphones" size={34} color="#1d4ed8" />
            </View>
            <View style={styles.heroRightContent}>
              <Text style={styles.heroTitle}>We{"'"}re Here to Help!</Text>
              <Text style={styles.heroSubText}>
                For any issue, query or technical support, reach out to us. We{"'"}re available <Text style={styles.heroHighlight247}>24/7</Text> to assist you.
              </Text>
            </View>
          </View>

          {/* SECTION 1: CONTACT SUPPORT CHANNELS */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleIconWrap}>
              <MaterialCommunityIcons name="phone-in-talk" size={18} color="#0f203c" />
            </View>
            <Text style={styles.sectionTitleText}>Contact Support</Text>
            {loadingSupport && <ActivityIndicator size="small" color="#1e3c72" style={{ marginLeft: 8 }} />}
          </View>

          <View style={styles.contactList}>
            {/* Phone 1 */}
            <TouchableOpacity
              style={styles.contactRowCard}
              activeOpacity={0.7}
              onPress={() => handleCall(displayPhone1)}
            >
              <View style={[styles.contactIconBox, { backgroundColor: '#eff6ff' }]}>
                <MaterialCommunityIcons name="phone" size={20} color="#2563eb" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Primary Helpline (Phone 1)</Text>
                <Text style={styles.contactValue}>{displayPhone1}</Text>
              </View>
              <MaterialCommunityIcons name="phone" size={18} color="#94a3b8" />
            </TouchableOpacity>

            {/* Phone 2 */}
            <TouchableOpacity
              style={styles.contactRowCard}
              activeOpacity={0.7}
              onPress={() => handleCall(displayPhone2)}
            >
              <View style={[styles.contactIconBox, { backgroundColor: '#f0fdf4' }]}>
                <MaterialCommunityIcons name="phone" size={20} color="#16a34a" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Secondary Helpline (Phone 2)</Text>
                <Text style={styles.contactValue}>{displayPhone2}</Text>
              </View>
              <MaterialCommunityIcons name="phone" size={18} color="#94a3b8" />
            </TouchableOpacity>

            {/* WhatsApp hidden */}

            {/* Telegram Bot */}
            <TouchableOpacity
              style={styles.contactRowCard}
              activeOpacity={0.7}
              onPress={openTelegram}
            >
              <View style={[styles.contactIconBox, { backgroundColor: '#e0f2fe' }]}>
                <FontAwesome5 name="telegram-plane" size={18} color="#0284c7" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Telegram Bot</Text>
                <Text style={styles.contactValue}>{displayTelegram}</Text>
              </View>
              <Feather name="external-link" size={18} color="#94a3b8" />
            </TouchableOpacity>

            {/* Email */}
            <TouchableOpacity
              style={styles.contactRowCard}
              activeOpacity={0.7}
              onPress={() => handleEmail(displayEmail)}
            >
              <View style={[styles.contactIconBox, { backgroundColor: '#fae8ff' }]}>
                <MaterialCommunityIcons name="email" size={20} color="#a855f7" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Email Support</Text>
                <Text style={styles.contactValue}>{displayEmail}</Text>
              </View>
              <Feather name="external-link" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* SECTION 2: FAQS & GUIDES */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleIconWrap}>
              <MaterialCommunityIcons name="book-open-page-variant" size={18} color="#0f203c" />
            </View>
            <Text style={styles.sectionTitleText}>Frequently Asked Questions</Text>
          </View>

          <View style={styles.faqsList}>
            {FAQS_DATA.map((item, idx) => {
              const isExp = expandedFaq === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.faqRow, isExp && styles.faqRowActive]}
                  activeOpacity={0.8}
                  onPress={() => toggleFaq(idx)}
                >
                  <View style={styles.faqRowHeader}>
                    <Text style={styles.faqNumberText}>{(idx + 1) + '.'}</Text>
                    <Text style={styles.faqQuestionText}>{item.q}</Text>
                    <Feather name={isExp ? 'chevron-up' : 'chevron-down'} size={18} color="#64748b" />
                  </View>
                  {isExp && <Text style={styles.faqAnswerText}>{item.a}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* FOOTER */}
          <View style={styles.pageFooter}>
            <Text style={styles.footerBrand}>STPL SNMP-RMS</Text>
            <Text style={styles.footerSub}>Monitoring Portal  |  App Version 1.3.0</Text>
          </View>

          <View style={{ height: verticalScale(30) }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  innerWrapper: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 650,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: moderateScale(16),
    paddingTop: verticalScale(12),
  },

  // HERO CARD
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: moderateScale(18),
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: verticalScale(18),
  },
  heroLeftIconCircle: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(14),
    elevation: 2,
    shadowColor: '#0284c7',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  heroRightContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: responsiveFontSize(17),
    fontWeight: '700',
    color: '#0f203c',
    marginBottom: 4,
  },
  heroSubText: {
    fontSize: responsiveFontSize(12),
    color: '#334155',
    lineHeight: 18,
  },
  heroHighlight247: {
    fontWeight: '700',
    color: '#0284c7',
  },

  // SECTION HEADER
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(6),
    marginBottom: verticalScale(12),
  },
  sectionTitleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sectionTitleText: {
    fontSize: responsiveFontSize(14),
    fontWeight: '700',
    color: '#0f203c',
    letterSpacing: 0.2,
  },

  // CONTACT CHANNELS LIST
  contactList: {
    marginBottom: verticalScale(16),
  },
  contactRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: verticalScale(12),
    paddingHorizontal: moderateScale(14),
    borderRadius: moderateScale(14),
    marginBottom: verticalScale(10),
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  contactIconBox: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: responsiveFontSize(11),
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: responsiveFontSize(13.5),
    color: '#0f203c',
    fontWeight: '600',
  },

  // FAQS LIST
  faqsList: {
    marginBottom: verticalScale(16),
  },
  faqRow: {
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(12),
    padding: moderateScale(14),
    marginBottom: verticalScale(8),
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  faqRowActive: {
    borderColor: '#93c5fd',
    backgroundColor: '#f8fafc',
  },
  faqRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  faqNumberText: {
    fontSize: responsiveFontSize(13),
    fontWeight: '700',
    color: '#1e3c72',
    marginRight: 6,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: responsiveFontSize(13),
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 18,
    marginRight: 6,
  },
  faqAnswerText: {
    fontSize: responsiveFontSize(12),
    color: '#475569',
    lineHeight: 18,
    marginTop: verticalScale(8),
    paddingTop: verticalScale(8),
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  // FOOTER
  pageFooter: {
    alignItems: 'center',
    marginTop: verticalScale(14),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerBrand: {
    fontSize: responsiveFontSize(12),
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  footerSub: {
    fontSize: responsiveFontSize(10.5),
    color: '#94a3b8',
    marginTop: 2,
  },
});
