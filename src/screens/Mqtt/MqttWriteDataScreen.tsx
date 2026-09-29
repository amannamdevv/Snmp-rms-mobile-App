import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { api } from '../../api';
import { scale, moderateScale, responsiveFontSize, verticalScale } from '../../utils/responsive';

const DELTA_PARAMS = [
  'BAT_LLVD',
  'BAT_BLVD',
  'SYS_FLOAT_VOLT',
  'SYS_BOOST_VOLT',
  'CHG_CURR_LIMIT',
  'FC_CURR_LIMIT',
];

const VERTIV_PARAMS = [
  'BAT1_LLVD_CONN_VOLT',
  'BAT1_LLVD_DISCONN_VOLT',
  'BAT1_LVD_DISCONN_VOLT',
  'BAT1_LVD_RECONN_VOLT',
];

const MqttWriteDataScreen = ({ navigation }: any) => {
  const [deviceType, setDeviceType] = useState<'Delta' | 'VERTIV'>('Delta');
  const [imei, setImei] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [selectedParam, setSelectedParam] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [commandStatus, setCommandStatus] = useState<any>(null);

  const params = deviceType === 'Delta' ? DELTA_PARAMS : VERTIV_PARAMS;

  const fetchSettings = async () => {
    if (!imei) {
      Alert.alert('Error', 'Please enter an IMEI');
      return;
    }
    setLoading(true);
    try {
      const response = await api.getDeviceSettings(imei, deviceType);
      if (response.status === 'success') {
        setSettings(response.data);
      } else {
        Alert.alert('Error', response.message || 'Failed to fetch settings');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'An error occurred while fetching settings');
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async () => {
    if (!imei || !selectedParam || !newValue) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('imei', imei);
      formData.append('device_type', deviceType);
      formData.append('parameter', selectedParam);
      formData.append('value', newValue);
      formData.append('command', 'write');

      const response = await api.sendDeviceCommand(formData);
      if (response.status === 'success') {
        Alert.alert('Success', 'Command sent successfully');
        pollCommandStatus();
      } else {
        Alert.alert('Error', response.message || 'Failed to send command');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'An error occurred while sending command');
    } finally {
      setLoading(false);
    }
  };

  const pollCommandStatus = async () => {
    try {
      const response = await api.getCommandStatus(imei);
      setCommandStatus(response);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <LinearGradient colors={['#6366f1', '#a855f7', '#ec4899']} style={styles.gradientContainer}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>STPL MQTT Command Center</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Send Configuration</Text>
            <Text style={styles.cardSubHeader}>{deviceType} • {deviceType === 'Delta' ? 'VERTIV' : 'Delta'}</Text>

            {/* Device Type Toggle */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, deviceType === 'Delta' && styles.activeTab]}
                onPress={() => {
                  setDeviceType('Delta');
                  setSelectedParam('');
                }}
              >
                <Text style={[styles.tabText, deviceType === 'Delta' && styles.activeTabText]}>Delta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, deviceType === 'VERTIV' && styles.activeTab]}
                onPress={() => {
                  setDeviceType('VERTIV');
                  setSelectedParam('');
                }}
              >
                <Text style={[styles.tabText, deviceType === 'VERTIV' && styles.activeTabText]}>VERTIV</Text>
              </TouchableOpacity>
            </View>

            {/* IMEI Input */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>IMEI Number <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 861919084310928"
                placeholderTextColor="#94a3b8"
                value={imei}
                onChangeText={setImei}
                keyboardType="numeric"
              />
            </View>

            {/* Load Button */}
            <TouchableOpacity style={styles.loadButton} onPress={fetchSettings} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.loadButtonText}>Load Current Settings</Text>
              )}
            </TouchableOpacity>

            {/* Parameter Selector */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Setting Parameter <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowPicker(true)}>
                <Text style={[styles.pickerTriggerText, !selectedParam && { color: '#94a3b8' }]}>
                  {selectedParam || '-- Select Setting --'}
                </Text>
                <Icon name="chevron-down" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* New Value Input */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>New Value <Text style={styles.required}>*</Text></Text>
              <View style={styles.valueInputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new value"
                  placeholderTextColor="#94a3b8"
                  value={newValue}
                  onChangeText={setNewValue}
                  keyboardType="numeric"
                />
                <View style={styles.stepperContainer}>
                   <TouchableOpacity onPress={() => setNewValue(prev => (parseFloat(prev || '0') + 0.1).toFixed(1))} style={styles.stepBtn}>
                     <Icon name="chevron-up" size={16} color="#64748b" />
                   </TouchableOpacity>
                   <TouchableOpacity onPress={() => setNewValue(prev => (parseFloat(prev || '0') - 0.1).toFixed(1))} style={styles.stepBtn}>
                     <Icon name="chevron-down" size={16} color="#64748b" />
                   </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Send Command Button */}
            <TouchableOpacity style={styles.sendButton} onPress={sendCommand} disabled={loading}>
              <Icon name="send" size={18} color="#fff" style={{ marginRight: moderateScale(8) }} />
              <Text style={styles.sendButtonText}>Send Command</Text>
            </TouchableOpacity>

            {/* Current Value Display (If settings loaded) */}
            {settings && selectedParam && settings[selectedParam] !== undefined && (
              <View style={styles.currentValContainer}>
                <Text style={styles.currentValLabel}>Current value for {selectedParam}:</Text>
                <Text style={styles.currentValText}>{settings[selectedParam]}</Text>
              </View>
            )}
          </View>

          {commandStatus && (
            <View style={styles.statusCard}>
              <Text style={styles.cardHeader}>Command Status</Text>
              <View style={styles.statusRow}>
                <Icon 
                  name={commandStatus.status === 'success' ? 'check-circle' : 'clock-outline'} 
                  size={20} 
                  color={commandStatus.status === 'success' ? '#10b981' : '#f59e0b'} 
                />
                <Text style={[styles.statusText, { color: commandStatus.status === 'success' ? '#10b981' : '#f59e0b' }]}>
                  {commandStatus.status.toUpperCase()}
                </Text>
              </View>
              {commandStatus.message && <Text style={styles.statusMsg}>{commandStatus.message}</Text>}
            </View>
          )}
        </ScrollView>

        {/* Parameter Picker Modal */}
        <Modal visible={showPicker} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Parameter</Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Icon name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={params}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedParam(item);
                      setShowPicker(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, selectedParam === item && styles.modalItemTextActive]}>
                      {item}
                    </Text>
                    {selectedParam === item && <Icon name="check" size={20} color="#6366f1" />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(12),
  },
  backBtn: { marginRight: scale(12) },
  headerTitle: {
    color: '#fff',
    fontSize: responsiveFontSize(18),
    fontWeight: 'bold',
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(4),
    borderRadius: 12,
  },
  liveDot: {
    width: moderateScale(6),
    height: verticalScale(6),
    borderRadius: 3,
    backgroundColor: '#ff4b4b',
    marginRight: moderateScale(4),
  },
  liveText: { color: '#fff', fontSize: responsiveFontSize(10), fontWeight: 'bold' },
  scrollContent: { padding: moderateScale(20) },
  card: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    padding: moderateScale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(4) },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  cardHeader: {
    fontSize: responsiveFontSize(20),
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  cardSubHeader: {
    fontSize: responsiveFontSize(12),
    color: '#64748b',
    textAlign: 'center',
    marginBottom: moderateScale(20),
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: moderateScale(8),
    padding: moderateScale(4),
    marginBottom: moderateScale(20),
  },
  tab: {
    flex: 1,
    paddingVertical: moderateScale(10),
    alignItems: 'center',
    borderRadius: moderateScale(6),
  },
  activeTab: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: verticalScale(2) },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  tabText: { color: '#64748b', fontWeight: '600' },
  activeTabText: { color: '#fff' },
  fieldContainer: { marginBottom: moderateScale(16) },
  label: { color: '#475569', fontSize: responsiveFontSize(14), fontWeight: '600', marginBottom: verticalScale(6) },
  required: { color: '#ef4444' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: moderateScale(12),
    fontSize: responsiveFontSize(16),
    color: '#1e293b',
  },
  valueInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperContainer: {
    position: 'absolute',
    right: 1,
    height: '100%',
    width: moderateScale(32),
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtn: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadButton: {
    backgroundColor: '#6366f1',
    paddingVertical: moderateScale(14),
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: moderateScale(20),
  },
  loadButtonText: { color: '#fff', fontWeight: 'bold', fontSize: responsiveFontSize(15) },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: moderateScale(12),
  },
  pickerTriggerText: { fontSize: responsiveFontSize(16), color: '#1e293b' },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    paddingVertical: moderateScale(14),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(8),
  },
  sendButtonText: { color: '#fff', fontWeight: 'bold', fontSize: responsiveFontSize(16) },
  currentValContainer: {
    marginTop: verticalScale(16),
    padding: moderateScale(12),
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  currentValLabel: { fontSize: responsiveFontSize(12), color: '#64748b' },
  currentValText: { fontSize: responsiveFontSize(18), fontWeight: 'bold', color: '#1e293b' },
  statusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: moderateScale(16),
    marginTop: verticalScale(16),
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: verticalScale(8) },
  statusText: { marginLeft: moderateScale(8), fontWeight: 'bold' },
  statusMsg: { marginTop: verticalScale(4), color: '#475569', fontSize: responsiveFontSize(13) },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: verticalScale(20),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(20),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: responsiveFontSize(18), fontWeight: 'bold', color: '#1e293b' },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(20),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemText: { fontSize: responsiveFontSize(16), color: '#475569' },
  modalItemTextActive: { color: '#6366f1', fontWeight: 'bold' },
});

export default MqttWriteDataScreen;
