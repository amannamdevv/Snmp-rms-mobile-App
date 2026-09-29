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
import AppHeader from '../../components/AppHeader';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SnmpToolScreen = ({ navigation }: any) => {
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [fullname, setFullname] = useState('User');

  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<any>(null);
  
  const [paramsList, setParamsList] = useState<any[]>([]);
  const [selectedParam, setSelectedParam] = useState<any>(null);

  const [currentValues, setCurrentValues] = useState<any[]>([]);
  const [readValue, setReadValue] = useState<any>(null);
  
  const [newValue, setNewValue] = useState('');
  
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingParams, setLoadingParams] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [loadingValues, setLoadingValues] = useState(false);

  const [showSitePicker, setShowSitePicker] = useState(false);
  const [showParamPicker, setShowParamPicker] = useState(false);

  useEffect(() => {
    loadSites();
    loadUser();
  }, []);

  const loadUser = async () => {
    const name = await AsyncStorage.getItem('user_fullname');
    if (name) setFullname(name);
  };

  const loadSites = async () => {
    setLoadingSites(true);
    try {
      const response = await api.getSnmpSites();
      if (response.success && response.data) {
        setSites(response.data);
      }
    } catch (error) {
      console.error('Error loading sites:', error);
      Alert.alert('Error', 'Failed to load sites');
    } finally {
      setLoadingSites(false);
    }
  };

  const loadParams = async (site: any) => {
    if (!site) return;
    setLoadingParams(true);
    try {
      const response = await api.getSnmpDeviceParameters(site.imei);
      if (response.success && response.parameters) {
        setParamsList(response.parameters);
      } else {
        setParamsList([]);
      }
    } catch (error) {
      console.error('Error loading parameters:', error);
    } finally {
      setLoadingParams(false);
    }
  };

  const loadCurrentValues = async (site: any) => {
    if (!site) return;
    setLoadingValues(true);
    try {
      const response = await api.getSnmpCurrentValues(site.imei);
      if (response.success && response.data) {
        setCurrentValues(response.data);
      } else {
        setCurrentValues([]);
      }
    } catch (error) {
      console.error('Error loading current values:', error);
    } finally {
      setLoadingValues(false);
    }
  };

  const handleSiteSelect = (site: any) => {
    setSelectedSite(site);
    setSelectedParam(null);
    setShowSitePicker(false);
    setReadValue(null);
    setCurrentValues([]);
    
    loadParams(site);
    loadCurrentValues(site);
  };

  const handleParamSelect = (param: any) => {
    setSelectedParam(param);
    setShowParamPicker(false);
    setReadValue(null);
  };

  const handleGet = async () => {
    if (!selectedSite || !selectedParam) {
      Alert.alert('Error', 'Please select site and parameter');
      return;
    }
    setLoadingAction(true);
    try {
      const formData = new FormData();
      formData.append('imei', selectedSite.imei);
      formData.append('oid', selectedParam.oid);
      formData.append('type', selectedParam.type);

      const response = await api.sendSnmpGet(formData);
      if (response.success) {
        setReadValue(response.value);
        Alert.alert('Success', `Read value: ${response.value}`);
      } else {
        Alert.alert('Read Error', response.error || 'Failed to read value');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to perform GET operation');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSet = async () => {
    if (!selectedSite || !selectedParam || !newValue) {
      Alert.alert('Error', 'Please select site, parameter, and enter a new value');
      return;
    }
    setLoadingAction(true);
    try {
      const formData = new FormData();
      formData.append('imei', selectedSite.imei);
      formData.append('oid', selectedParam.oid);
      formData.append('type', selectedParam.type);
      formData.append('value', newValue);

      const response = await api.sendSnmpSet(formData);
      if (response.success) {
        Alert.alert('Success', `Write verified: ${response.verified_value}`);
        loadCurrentValues(selectedSite);
      } else {
        Alert.alert('Write Error', response.error || 'Failed to write value');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to perform SET operation');
    } finally {
      setLoadingAction(false);
    }
  };

  const renderCurrentValues = () => {
    if (loadingValues) return <ActivityIndicator color="#6366f1" style={{ marginTop: verticalScale(20) }} />;
    if (!currentValues || currentValues.length === 0) return null;

    return (
      <View style={{ marginTop: verticalScale(20) }}>
        {currentValues.map((section: any, index: number) => (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{section.table}</Text>
            <View style={styles.gridContainer}>
              {Object.entries(section.values).map(([key, val]: any, idx) => {
                if (key.toLowerCase().includes('id') && key !== 'site_id') return null; // skip internal cols
                return (
                  <View key={idx} style={styles.gridItem}>
                    <Text style={styles.gridKey}>{key.replace(/^st/, '').replace(/_/g, ' ')}</Text>
                    <Text style={[styles.gridValue, (val === null || val === '') && { color: '#94a3b8' }]}>
                      {val !== null && val !== '' ? String(val) : 'N/A'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0f2027', '#203a43', '#2c5364']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        
        <AppHeader
          title="SNMP Tool"
          onMenuPress={() => setSidebarVisible(true)}
          onNotificationPress={() => navigation.navigate('LiveAlarms')}
          rightIcon="bell"
        />

        <Sidebar
          isVisible={isSidebarVisible}
          onClose={() => setSidebarVisible(false)}
          navigation={navigation}
          fullname={fullname}
          activeRoute="SnmpTool"
          handleLogout={() => {
            AsyncStorage.clear();
            navigation.replace('Login');
          }}
        />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.cardHeader}>SNMP Configuration</Text>
            
            {/* Site Selector */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Select Site <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowSitePicker(true)}>
                {loadingSites ? (
                  <ActivityIndicator color="#6366f1" size="small" />
                ) : (
                  <>
                    <Text style={[styles.pickerTriggerText, !selectedSite && { color: '#94a3b8' }]}>
                      {selectedSite ? `${selectedSite.imei} - ${selectedSite.name}` : '-- Select Site --'}
                    </Text>
                    <Icon name="chevron-down" size={20} color="#64748b" />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Parameter Selector */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Select Parameter <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={() => {
                if (selectedSite) setShowParamPicker(true);
                else Alert.alert('Notice', 'Please select a site first.');
              }}>
                {loadingParams ? (
                  <ActivityIndicator color="#6366f1" size="small" />
                ) : (
                  <>
                    <Text style={[styles.pickerTriggerText, !selectedParam && { color: '#94a3b8' }]}>
                      {selectedParam ? selectedParam.name : '-- Select Parameter --'}
                    </Text>
                    <Icon name="chevron-down" size={20} color="#64748b" />
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(16) }}>
               {/* Read Action */}
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10b981' }]} onPress={handleGet} disabled={loadingAction}>
                <Icon name="download" size={18} color="#fff" style={{ marginRight: moderateScale(8) }} />
                <Text style={styles.actionBtnText}>Read Value</Text>
              </TouchableOpacity>
            </View>

            {readValue !== null && (
              <View style={styles.resultContainer}>
                <Text style={styles.resultLabel}>Read Result:</Text>
                <Text style={styles.resultText}>{readValue}</Text>
              </View>
            )}

            {/* Write Section */}
            <View style={[styles.fieldContainer, { marginTop: verticalScale(16) }]}>
              <Text style={styles.label}>New Value (Write) <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Enter value to write"
                placeholderTextColor="#94a3b8"
                value={newValue}
                onChangeText={setNewValue}
              />
            </View>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} onPress={handleSet} disabled={loadingAction}>
              <Icon name="upload" size={18} color="#fff" style={{ marginRight: moderateScale(8) }} />
              <Text style={styles.actionBtnText}>Write Value</Text>
            </TouchableOpacity>

          </View>

          {/* Current Values Card */}
          {selectedSite && (
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Current Stored Values</Text>
              {renderCurrentValues()}
            </View>
          )}

        </ScrollView>

        {/* Site Picker Modal */}
        <Modal visible={showSitePicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Site</Text>
                <TouchableOpacity onPress={() => setShowSitePicker(false)}>
                  <Icon name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={sites}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => handleSiteSelect(item)}
                  >
                    <Text style={styles.modalItemText}>{item.imei} - {item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Param Picker Modal */}
        <Modal visible={showParamPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Parameter</Text>
                <TouchableOpacity onPress={() => setShowParamPicker(false)}>
                  <Icon name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={paramsList}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => handleParamSelect(item)}
                  >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    <Text style={{fontSize: responsiveFontSize(12), color:'#94a3b8'}}>{item.oid}</Text>
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
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: moderateScale(16) },
  card: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    padding: moderateScale(20),
    marginBottom: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(4) },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  cardHeader: {
    fontSize: responsiveFontSize(18),
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: moderateScale(16),
  },
  fieldContainer: { marginBottom: moderateScale(16) },
  label: { color: '#475569', fontSize: responsiveFontSize(14), fontWeight: '600', marginBottom: verticalScale(6) },
  required: { color: '#ef4444' },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: moderateScale(12),
  },
  pickerTriggerText: { fontSize: responsiveFontSize(14), color: '#1e293b' },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: moderateScale(12),
    fontSize: responsiveFontSize(14),
    color: '#1e293b',
  },
  actionBtn: {
    flexDirection: 'row',
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(20),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: responsiveFontSize(14) },
  resultContainer: {
    marginTop: verticalScale(10),
    padding: moderateScale(12),
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  resultLabel: { fontSize: responsiveFontSize(12), color: '#047857' },
  resultText: { fontSize: responsiveFontSize(16), fontWeight: 'bold', color: '#065f46' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
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
    padding: moderateScale(20),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemText: { fontSize: responsiveFontSize(16), color: '#475569', fontWeight: '500' },
  
  // Current values grid
  sectionContainer: { marginTop: verticalScale(16) },
  sectionTitle: { fontSize: responsiveFontSize(16), fontWeight: 'bold', color: '#334155', marginBottom: verticalScale(8), borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: verticalScale(4) },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: '48%', backgroundColor: '#f8fafc', padding: moderateScale(10), borderRadius: 8, marginBottom: verticalScale(8), borderWidth: 1, borderColor: '#e2e8f0' },
  gridKey: { fontSize: responsiveFontSize(11), color: '#64748b', textTransform: 'capitalize' },
  gridValue: { fontSize: responsiveFontSize(14), fontWeight: 'bold', color: '#0f172a', marginTop: verticalScale(4) },
});

export default SnmpToolScreen;
