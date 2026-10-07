import { useGlobalFilter } from '../../context/FilterContext';
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
  SectionList,
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

  const [sites, setSites] = useState<any[]>([]); // Will hold sections
  const [selectedSite, setSelectedSite] = useState<any>(null);
  
  const [paramsList, setParamsList] = useState<any[]>([]);
  const [selectedParam, setSelectedParam] = useState<any>(null);

  const [currentValues, setCurrentValues] = useState<any[]>([]);
  const [readValue, setReadValue] = useState<any>(null);
  
  
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
      if (response.success && response.sites) {
        // Group by make
        const grouped = response.sites.reduce((acc: any, site: any) => {
          const make = site.make ? site.make.toUpperCase() : 'UNKNOWN';
          if (!acc[make]) acc[make] = [];
          acc[make].push(site);
          return acc;
        }, {});
        
        const sections = Object.keys(grouped).map(make => ({
          title: make,
          data: grouped[make]
        }));
        setSites(sections);
      } else {
        setSites([]);
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
    // if (param) { handleGet(param); } // Disabled to prevent 500 error
  };

  const handleGet = async (targetParam = selectedParam) => {
    if (!selectedSite || !targetParam) {
      return;
    }
    setLoadingAction(true);
    try {
      const formData = new FormData();
      formData.append('imei', selectedSite.imei);
      formData.append('oid', targetParam.oid);
      formData.append('type', targetParam.type || 'string'); // ensure type fallback

      const response = await api.sendSnmpGet(formData);
      if (response.success) {
        setReadValue(response.value);
      } else {
        Alert.alert('Read Error', response.error || 'Failed to read value');
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to perform GET operation: ' + (error.message || 'Network error'));
    } finally {
      setLoadingAction(false);
    }
  };

  const renderCurrentValues = () => {
    if (loadingValues) return <ActivityIndicator color="#6366f1" style={{ marginTop: verticalScale(20) }} />;
    if (!currentValues || currentValues.length === 0) return (
        <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: moderateScale(20) }}>No values stored or loaded</Text>
    );

    return (
      <View style={{ marginTop: verticalScale(10) }}>
        {currentValues.map((section: any, index: number) => (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{section.table}</Text>
            <View style={styles.gridContainer}>
              {Object.entries(section.values).map(([key, val]: any, idx) => {
                if (key.toLowerCase().includes('id') && key !== 'site_id') return null;
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
          title="SNMP RMS"
          leftAction="menu" onLeftPress={() => setSidebarVisible(true)}
          hideGlobalFilter={true}
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
            <Text style={styles.cardHeader}>Select Parameter</Text>
            
            {/* Site Selector */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Select Site <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowSitePicker(true)}>
                {loadingSites ? (
                  <ActivityIndicator color="#6366f1" size="small" />
                ) : (
                  <>
                    <Text style={[styles.pickerTriggerText, !selectedSite && { color: '#94a3b8' }]}>
                      {selectedSite ? `${selectedSite.site_name} (${selectedSite.global_id})` : '-- Select Site --'}
                    </Text>
                    <Icon name="chevron-down" size={20} color="#64748b" />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Parameter Selector */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Choose a Parameter <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.pickerTrigger} onPress={() => {
                if (selectedSite) setShowParamPicker(true);
                else Alert.alert('Notice', 'Please select a site first.');
              }}>
                {loadingParams ? (
                  <ActivityIndicator color="#6366f1" size="small" />
                ) : (
                  <>
                    <Text style={[styles.pickerTriggerText, !selectedParam && { color: '#94a3b8' }]}>
                      {selectedParam ? selectedParam.name : '-- Choose a Parameter --'}
                    </Text>
                    <Icon name="chevron-down" size={20} color="#64748b" />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {selectedParam && (
              <View style={{ marginTop: verticalScale(16) }}>
                {/* READ CARD */}
                <View style={styles.actionCard}>
                  <Text style={styles.actionCardTitle}>Read Current Value</Text>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Parameter</Text>
                    <Text style={styles.detailValue}>{selectedParam.name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>{selectedParam.category || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Device</Text>
                    <Text style={styles.detailValue}>{selectedSite.make ? selectedSite.make.toUpperCase() : 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>IP</Text>
                    <Text style={styles.detailValue}>{selectedSite.ip || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>OID</Text>
                    <Text style={styles.detailValue}>{selectedParam.oid}</Text>
                  </View>

                  {loadingAction && !readValue && (
                    <View style={{ marginTop: 16, alignItems: 'center' }}>
                       <ActivityIndicator color="#10b981" size="small" />
                       <Text style={{ color: '#64748b', marginTop: 4, fontSize: 12 }}>Fetching value...</Text>
                    </View>
                  )}

                  {readValue !== null && (
                    <View style={styles.resultBox}>
                      <View style={styles.statusHeader}>
                        <Icon name="check-circle" size={18} color="#10b981" />
                        <Text style={[styles.statusText, {color: '#10b981'}]}>Read Success</Text>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Value</Text>
                        <Text style={[styles.detailValue, {color: '#1e3a8a', fontWeight: 'bold'}]}>{readValue}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Type</Text>
                        <Text style={styles.detailValue}>{selectedParam.type || 'OctetString'}</Text>
                      </View>
                    </View>
                  )}
                </View>

                              </View>
            )}
          </View>

          {/* Current Values Card */}
          {selectedSite && (
            <View style={styles.card}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(10)}}>
                <Text style={styles.cardHeader}>Current Stored Values</Text>
                <TouchableOpacity onPress={() => loadCurrentValues(selectedSite)} style={{padding: 4}}>
                    <Icon name="refresh" size={20} color="#6366f1" />
                </TouchableOpacity>
              </View>
              {renderCurrentValues()}
            </View>
          )}

        </ScrollView>

        {/* Site Picker Modal */}
        <Modal visible={showSitePicker} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Site</Text>
                <TouchableOpacity onPress={() => setShowSitePicker(false)}>
                  <Icon name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <SectionList
                sections={sites}
                keyExtractor={(item, index) => index.toString()}
                ListHeaderComponent={() => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => handleSiteSelect(null)}
                  >
                    <Text style={[styles.modalItemText, { color: '#94a3b8', fontStyle: 'italic' }]}>-- Select Site (Clear) --</Text>
                  </TouchableOpacity>
                )}
                renderSectionHeader={({ section: { title } }) => (
                  <View style={{ backgroundColor: '#f1f5f9', padding: moderateScale(10), paddingHorizontal: moderateScale(20) }}>
                    <Text style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: responsiveFontSize(14), flexShrink: 1, }}>- {title} -</Text>
                  </View>
                )}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => handleSiteSelect(item)}
                  >
                    <Text style={styles.modalItemText}>{item.site_name}</Text>
                    <Text style={styles.modalItemSubText}>{item.global_id}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Param Picker Modal */}
        <Modal visible={showParamPicker} transparent animationType="fade">
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
                ListHeaderComponent={() => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => handleParamSelect(null)}
                  >
                    <Text style={[styles.modalItemText, { color: '#94a3b8', fontStyle: 'italic' }]}>-- Choose Parameter (Clear) --</Text>
                  </TouchableOpacity>
                )}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => handleParamSelect(item)}
                  >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    <Text style={styles.modalItemSubText}>{item.oid}</Text>
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
    fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '800',
    color: '#1e3a8a',
  },
  fieldContainer: { marginBottom: moderateScale(16) },
  label: { color: '#64748b', fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '700', marginBottom: verticalScale(6) },
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
  pickerTriggerText: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#0f172a', fontWeight: '600' },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: moderateScale(12),
    fontSize: responsiveFontSize(14), flexShrink: 1, color: '#0f172a',
    fontWeight: '600'
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
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: responsiveFontSize(14), flexShrink: 1, },

  actionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionCardTitle: {
    fontSize: responsiveFontSize(14),
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: moderateScale(12),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: moderateScale(6),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: {
    fontSize: responsiveFontSize(13),
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: responsiveFontSize(13),
    color: '#334155',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  actionBtnRead: {
    backgroundColor: '#10b981',
    paddingVertical: moderateScale(12),
    borderRadius: 8,
    alignItems: 'center',
    marginTop: moderateScale(16),
  },
  actionBtnWrite: {
    backgroundColor: '#3b82f6',
    paddingVertical: moderateScale(12),
    borderRadius: 8,
    alignItems: 'center',
    marginTop: moderateScale(16),
  },
  resultBox: {
    marginTop: moderateScale(16),
    padding: moderateScale(12),
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(10),
  },
  statusText: {
    fontSize: responsiveFontSize(14),
    fontWeight: 'bold',
    marginLeft: moderateScale(6),
  },
  resultContainer: {
    marginTop: verticalScale(10),
    padding: moderateScale(12),
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  resultLabel: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#047857', fontWeight: '600' },
  resultText: { fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: 'bold', color: '#065f46', marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
  modalTitle: { fontSize: responsiveFontSize(18), flexShrink: 1, fontWeight: '800', color: '#1e293b' },
  modalItem: {
    padding: moderateScale(16),
    paddingHorizontal: moderateScale(20),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemText: { fontSize: responsiveFontSize(15), flexShrink: 1, color: '#334155', fontWeight: '600' },
  modalItemSubText: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#94a3b8', marginTop: 2 },
  
  // Current values grid
  sectionContainer: { marginTop: verticalScale(10), marginBottom: verticalScale(10) },
  sectionTitle: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#8b5cf6', marginBottom: verticalScale(10), textTransform: 'uppercase' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: '48%', backgroundColor: '#f8fafc', padding: moderateScale(12), borderRadius: 8, marginBottom: verticalScale(10), borderWidth: 1, borderColor: '#e2e8f0' },
  gridKey: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', textTransform: 'uppercase', fontWeight: '700' },
  gridValue: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '800', color: '#0f172a', marginTop: verticalScale(6) },
});

export default SnmpToolScreen;
