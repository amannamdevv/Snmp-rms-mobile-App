import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Dimensions,
  Image, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import { LineChart, BarChart } from 'react-native-chart-kit';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import { launchImageLibrary } from 'react-native-image-picker';

import { 
  scale, verticalScale, moderateScale, responsiveFontSize, 
  SCREEN_WIDTH as screenWidth 
} from '../../utils/responsive';

export default function SupportRequiredScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [fullname, setFullname] = useState('Administrator');
  const [email, setEmail] = useState('');

  // Tab states for each card
  const [portalTab, setPortalTab] = useState<'analytics' | 'form'>('analytics');
  const [fixTab, setFixTab] = useState<'analytics' | 'form'>('analytics');

  // Form states
  const [portalData, setPortalData] = useState({
    name: '',
    email: '',
    issue_category: '',
    description: '',
    screenshot: null as any
  });

  const [fixData, setFixData] = useState({
    name: '',
    email: '',
    area_to_correct: '',
    details: '',
    attach_reference: null as any
  });

  useEffect(() => {
    AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
  }, []);

  const handlePickImage = async (type: 'portal' | 'fix') => {
    const options = { mediaType: 'photo' as const, quality: 0.8 as const };
    const result = await launchImageLibrary(options);
    if (result.assets && result.assets.length > 0) {
      if (type === 'portal') {
        setPortalData({ ...portalData, screenshot: result.assets[0] });
      } else {
        setFixData({ ...fixData, attach_reference: result.assets[0] });
      }
    }
  };

  const handleSubmit = async (formType: 'portal' | 'fix') => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('form_type', formType);

      if (formType === 'portal') {
        if (!portalData.issue_category || !portalData.description) {
          Alert.alert('Error', 'Please fill all required fields');
          setLoading(false);
          return;
        }
        formData.append('name', portalData.name);
        formData.append('email', portalData.email);
        formData.append('issue_category', portalData.issue_category);
        formData.append('description', portalData.description);
        if (portalData.screenshot) {
          formData.append('screenshot', {
            uri: portalData.screenshot.uri,
            type: portalData.screenshot.type,
            name: portalData.screenshot.fileName || 'screenshot.jpg',
          } as any);
        }
      } else {
        if (!fixData.area_to_correct || !fixData.details) {
          Alert.alert('Error', 'Please fill all required fields');
          setLoading(false);
          return;
        }
        formData.append('name', fixData.name);
        formData.append('email', fixData.email);
        formData.append('area_to_correct', fixData.area_to_correct);
        formData.append('details', fixData.details);
        if (fixData.attach_reference) {
          formData.append('attach_reference', {
            uri: fixData.attach_reference.uri,
            type: fixData.attach_reference.type,
            name: fixData.attach_reference.fileName || 'reference.jpg',
          } as any);
        }
      }

      const res = await api.submitSupportTicket(formData);
      if (res.success) {
        Alert.alert('Success', `Ticket #${res.ticket_id} submitted!`);
        // Reset form and switch to analytics
        if (formType === 'portal') {
          setPortalData({ ...portalData, issue_category: '', description: '', screenshot: null });
          setPortalTab('analytics');
        } else {
          setFixData({ ...fixData, area_to_correct: '', details: '', attach_reference: null });
          setFixTab('analytics');
        }
      } else {
        Alert.alert('Error', res.error || 'Submission failed');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Network error or server unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
      <AppHeader
        title="SUPPORT REQUIRED"
        subtitle="REPORT ISSUES INSTANTLY"
        leftAction="menu"
        onLeftPress={() => setSidebarVisible(true)}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Support System</Text>
          <Text style={styles.heroSub}>Report and resolve technical issues faster</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>24</Text>
            <Text style={styles.statLab}>Resolved Today</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>12</Text>
            <Text style={styles.statLab}>Pending</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>2.4h</Text>
            <Text style={styles.statLab}>Avg. Response</Text>
          </View>
        </View>

        {/* Card 1: Portal Issues */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <AppIcon name="monitor" size={20} color="#3b82f6" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Report Portal Issues</Text>
              <Text style={styles.cardDesc}>Technical problems & system errors</Text>
            </View>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity onPress={() => setPortalTab('analytics')} style={[styles.tab, portalTab === 'analytics' && styles.tabActive]}>
              <Text style={[styles.tabText, portalTab === 'analytics' && styles.tabTextActive]}>Analytics</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPortalTab('form')} style={[styles.tab, portalTab === 'form' && styles.tabActive]}>
              <Text style={[styles.tabText, portalTab === 'form' && styles.tabTextActive]}>Report Issue</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.panel}>
            {portalTab === 'analytics' ? (
              <LineChart
                data={{
                  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                  datasets: [{ data: [12, 18, 9, 15, 11, 7, 10] }]
                }}
                width={screenWidth - 60}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            ) : (
              <View style={styles.form}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Your name"
                      placeholderTextColor="#94a3b8"
                      value={portalData.name}
                      onChangeText={t => setPortalData({ ...portalData, name: t })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="you@company.com"
                      placeholderTextColor="#94a3b8"
                      value={portalData.email}
                      onChangeText={t => setPortalData({ ...portalData, email: t })}
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Issue Category</Text>
                <View style={styles.pickerWrap}>
                  {['Login/Access', 'Performance', 'Broken Feature', 'UI/UX', 'Other'].map(cat => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setPortalData({ ...portalData, issue_category: cat })}
                      style={[styles.chip, portalData.issue_category === cat && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, portalData.issue_category === cat && styles.chipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, { height: verticalScale(80), textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Describe the problem..."
                  placeholderTextColor="#94a3b8"
                  value={portalData.description}
                  onChangeText={t => setPortalData({ ...portalData, description: t })}
                />

                <TouchableOpacity style={styles.fileBtn} onPress={() => handlePickImage('portal')}>
                  <AppIcon name="image" size={18} color="#64748b" style={{ marginRight: moderateScale(8) }} />
                  <Text style={styles.fileBtnText}>{portalData.screenshot ? (portalData.screenshot.fileName || 'Image Selected') : 'Attach Screenshot'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.submitBtn} onPress={() => handleSubmit('portal')} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Ticket</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Card 2: Instant Reporting */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <AppIcon name="check-circle" size={20} color="#10b981" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Reporting & Correction</Text>
              <Text style={styles.cardDesc}>Quick fixes & content corrections</Text>
            </View>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity onPress={() => setFixTab('analytics')} style={[styles.tab, fixTab === 'analytics' && styles.tabActive]}>
              <Text style={[styles.tabText, fixTab === 'analytics' && styles.tabTextActive]}>Analytics</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFixTab('form')} style={[styles.tab, fixTab === 'form' && styles.tabActive]}>
              <Text style={[styles.tabText, fixTab === 'form' && styles.tabTextActive]}>Report Fix</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.panel}>
            {fixTab === 'analytics' ? (
              <BarChart
                data={{
                  labels: ['Cont', 'Comm', 'Data', 'Link', 'Img'],
                  datasets: [{ data: [18, 7, 12, 16, 5] }]
                }}
                width={screenWidth - 60}
                height={200}
                chartConfig={chartConfig}
                style={styles.chart}
                yAxisLabel=""
                yAxisSuffix=""
              />
            ) : (
              <View style={styles.form}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Your name"
                      placeholderTextColor="#94a3b8"
                      value={fixData.name}
                      onChangeText={t => setFixData({ ...fixData, name: t })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="you@company.com"
                      placeholderTextColor="#94a3b8"
                      value={fixData.email}
                      onChangeText={t => setFixData({ ...fixData, email: t })}
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Area to Correct</Text>
                <View style={styles.pickerWrap}>
                  {['Content', 'Data', 'Link', 'Image', 'Other'].map(cat => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setFixData({ ...fixData, area_to_correct: cat })}
                      style={[styles.chip, fixData.area_to_correct === cat && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, fixData.area_to_correct === cat && styles.chipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Details</Text>
                <TextInput
                  style={[styles.input, { height: verticalScale(80), textAlignVertical: 'top' }]}
                  multiline
                  placeholder="What needs to be corrected?"
                  placeholderTextColor="#94a3b8"
                  value={fixData.details}
                  onChangeText={t => setFixData({ ...fixData, details: t })}
                />

                <TouchableOpacity style={styles.fileBtn} onPress={() => handlePickImage('fix')}>
                  <AppIcon name="paperclip" size={18} color="#64748b" style={{ marginRight: moderateScale(8) }} />
                  <Text style={styles.fileBtnText}>{fixData.attach_reference ? (fixData.attach_reference.fileName || 'File Selected') : 'Attach Reference'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#10b981' }]} onPress={() => handleSubmit('fix')} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: verticalScale(40) }} />
      </ScrollView>

      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        fullname={fullname}
        activeRoute="SupportRequired"
        handleLogout={async () => {
          await AsyncStorage.multiRemove(['djangoSession', 'user_fullname', 'user_email']);
          navigation.replace('Login');
        }}
      />
      </View>
    </SafeAreaView>
  );
}

const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  color: (opacity = 1) => `rgba(30, 60, 114, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.6,
  useShadowColorFromDataset: false,
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#3b82f6' }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },
  content: { flex: 1, padding: moderateScale(16) },
  row: { flexDirection: 'row', gap: moderateScale(10), alignItems: 'center' },
  heroSection: { marginBottom: verticalScale(20), alignItems: 'center' },
  heroTitle: { fontSize: responsiveFontSize(24), flexShrink: 1, fontWeight: '800', color: '#1e293b' },
  heroSub: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', marginTop: moderateScale(4) },

  statsRow: { flexDirection: 'row', gap: moderateScale(10), marginBottom: verticalScale(24) },
  statBox: { 
    flex: 1, 
    backgroundColor: '#fff', 
    padding: moderateScale(16), 
    borderRadius: moderateScale(16), 
    alignItems: 'center', 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: verticalScale(2) }, 
    shadowOpacity: 0.05, 
    shadowRadius: 8 
  },
  statVal: { fontSize: responsiveFontSize(20), flexShrink: 1, fontWeight: '800', color: '#1e3c72' },
  statLab: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', fontWeight: '600', marginTop: moderateScale(4), textAlign: 'center' },

  card: { 
    backgroundColor: '#fff', 
    borderRadius: moderateScale(20), 
    padding: moderateScale(16), 
    marginBottom: verticalScale(20), 
    elevation: 3, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: verticalScale(4) }, 
    shadowOpacity: 0.08, 
    shadowRadius: 12 
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(16), gap: moderateScale(12) },
  iconBox: { 
    width: scale(40), 
    height: scale(40), 
    borderRadius: moderateScale(12), 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  cardTitle: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '700', color: '#1e293b' },
  cardDesc: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#64748b' },

  tabs: { 
    flexDirection: 'row', 
    backgroundColor: '#f1f5f9', 
    borderRadius: moderateScale(12), 
    padding: moderateScale(4), 
    marginBottom: verticalScale(16) 
  },
  tab: { flex: 1, paddingVertical: verticalScale(8), alignItems: 'center', borderRadius: moderateScale(10) },
  tabActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  tabText: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#1e3c72' },

  panel: { minHeight: verticalScale(220) },
  chart: { borderRadius: moderateScale(16), marginVertical: verticalScale(8), marginLeft: scale(-10) },

  form: { gap: moderateScale(12) },
  inputLabel: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', color: '#475569', marginBottom: moderateScale(4) },
  input: { 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: moderateScale(10), 
    padding: moderateScale(12), 
    fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b', 
    backgroundColor: '#fcfcfc' 
  },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(8) },
  chip: { 
    paddingHorizontal: moderateScale(12), 
    paddingVertical: verticalScale(6), 
    borderRadius: moderateScale(20), 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    backgroundColor: '#fff' 
  },
  chipActive: { borderColor: '#1e3c72', backgroundColor: 'rgba(30, 60, 114, 0.05)' },
  chipText: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#1e3c72' },

  fileBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: moderateScale(12), 
    borderRadius: moderateScale(10), 
    borderStyle: 'dashed', 
    borderWidth: 1, 
    borderColor: '#cbd5e1', 
    backgroundColor: '#f8fafc' 
  },
  fileBtnText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '500' },
  submitBtn: { 
    backgroundColor: '#1e3c72', 
    padding: verticalScale(14), 
    borderRadius: moderateScale(12), 
    alignItems: 'center', 
    marginTop: verticalScale(8) 
  },
  submitBtnText: { color: '#fff', fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '700' },
});
