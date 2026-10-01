import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Feather';
import { api } from '../api';
import { responsiveFontSize, moderateScale, verticalScale } from '../utils/responsive';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: any) => void;
  initialFilters?: any;
}

type Option = { id: string; name: string };

// Local date -> YYYY-MM-DD (avoids the toISOString timezone shift)
const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Inline Dropdown to avoid nested Modals on Android
const Dropdown = ({ label, value, options, onSelect, placeholder, disabled }: {
  label: string;
  value: string;
  options: Option[];
  onSelect: (id: string, name: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(o => String(o.id) === String(value))?.name || '';

  return (
    <View style={ddStyles.container}>
      <Text style={ddStyles.label}>{label}</Text>
      <TouchableOpacity
        style={[ddStyles.trigger, disabled && ddStyles.triggerDisabled]}
        onPress={() => !disabled && setOpen(!open)}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <Text style={[ddStyles.triggerText, !selectedLabel && ddStyles.placeholder]}>
          {selectedLabel || placeholder || 'Select ' + label}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={disabled ? '#bbb' : '#1e3c72'} />
      </TouchableOpacity>

      {open && !disabled && (
        <View style={ddStyles.listContainer}>
          {/* ScrollView so long lists (states/clients) can scroll */}
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            <TouchableOpacity
              style={[ddStyles.option, !value && ddStyles.optionActive]}
              onPress={() => { onSelect('', ''); setOpen(false); }}
            >
              <Text style={[ddStyles.optionText, !value && ddStyles.optionTextActive]}>All {label}s</Text>
            </TouchableOpacity>

            {options.length === 0 && (
              <View style={ddStyles.option}>
                <Text style={ddStyles.emptyText}>No options available</Text>
              </View>
            )}

            {options.map(o => (
              <TouchableOpacity
                key={o.id}
                style={[ddStyles.option, String(value) === String(o.id) && ddStyles.optionActive]}
                onPress={() => { onSelect(String(o.id), o.name); setOpen(false); }}
              >
                <Text style={[ddStyles.optionText, String(value) === String(o.id) && ddStyles.optionTextActive]}>
                  {o.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const ddStyles = StyleSheet.create({
  container: { marginBottom: verticalScale(14) },
  label: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#475569', marginBottom: verticalScale(6), textTransform: 'uppercase' },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: moderateScale(10),
    paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(11),
    backgroundColor: '#f8fafc',
  },
  triggerDisabled: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  triggerText: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b', fontWeight: '500', flex: 1 },
  placeholder: { color: '#94a3b8' },
  listContainer: {
    marginTop: verticalScale(4),
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: moderateScale(10),
    backgroundColor: '#fff',
    maxHeight: verticalScale(200),
    overflow: 'hidden',
  },
  option: { paddingVertical: verticalScale(12), paddingHorizontal: moderateScale(16), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  optionActive: { backgroundColor: '#eff6ff' },
  optionText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#334155' },
  optionTextActive: { color: '#1e3c72', fontWeight: '700' },
  emptyText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#94a3b8', fontStyle: 'italic' },
});

const FilterModal = ({ visible, onClose, onApply, initialFilters = {} }: FilterModalProps) => {
  const [states, setStates] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [clusters, setClusters] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);

  const [loading, setLoading] = useState(false);
  const [distLoading, setDistLoading] = useState(false);
  const [clustLoading, setClustLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [selectedState, setSelectedState] = useState(initialFilters?.state_id || '');
  const [selectedStateName, setSelectedStateName] = useState(initialFilters?.state_name || '');
  const [selectedDistrict, setSelectedDistrict] = useState(initialFilters?.district_id || '');
  const [selectedDistrictName, setSelectedDistrictName] = useState(initialFilters?.district_name || '');
  const [selectedCluster, setSelectedCluster] = useState(initialFilters?.cluster_id || '');
  const [selectedClusterName, setSelectedClusterName] = useState(initialFilters?.cluster_name || '');

  const [selectedClient, setSelectedClient] = useState(initialFilters?.customer_id || '');

  const [searchBy, setSearchBy] = useState(initialFilters?.search_type || 'imei');
  const [searchValue, setSearchValue] = useState(
    initialFilters?.imei || initialFilters?.site_id || initialFilters?.global_id || initialFilters?.site_name || ''
  );

  const [fromDate, setFromDate] = useState<Date | null>(initialFilters?.date_from ? new Date(initialFilters.date_from) : null);
  const [toDate, setToDate] = useState<Date | null>(initialFilters?.date_to ? new Date(initialFilters.date_to) : null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      loadInitialData();
      if (initialFilters?.state_id) loadDistricts(initialFilters.state_id);
      if (initialFilters?.district_id) loadClusters(initialFilters.district_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const loadInitialData = async () => {
    setLoading(true);
    setErrorMsg('');

    const [stateRes, clientRes] = await Promise.all([
      api.getStates().catch((e: any) => {
        console.error('[FilterModal] getStates failed:', e?.response?.status, e?.message);
        return null;
      }),
      api.getClients().catch((e: any) => {
        console.error('[FilterModal] getClients failed:', e?.response?.status, e?.message);
        return null;
      }),
    ]);

    if (stateRes?.data) {
      const mapped = stateRes.data
        .map((s: any) => ({ id: String(s.state_id ?? s.id), name: s.state_name ?? s.name }))
        .filter((s: Option) => s.id !== 'undefined' && s.name);
      console.log('[FilterModal] states loaded:', mapped.length);
      setStates(mapped);
    } else {
      setErrorMsg('Failed to load filters. Please verify your session.');
    }

    if (clientRes?.data) {
      const mapped = clientRes.data
        .map((c: any) => ({ id: String(c.client_id ?? c.id), name: c.client_name ?? c.name }))
        .filter((c: Option) => c.id !== 'undefined' && c.name);
      console.log('[FilterModal] clients loaded:', mapped.length);
      setClients(mapped);
    }

    setLoading(false);
  };

  const loadDistricts = async (stateId: string) => {
    try {
      setDistLoading(true);
      setDistricts([]);
      setClusters([]);
      const res = await api.getDistricts(stateId);
      const data = (res?.data || [])
        .map((d: any) => ({ id: String(d.district_id), name: d.district_name }))
        .filter((d: Option) => d.id !== 'undefined' && d.name);
      console.log('[FilterModal] districts loaded:', data.length);
      setDistricts(data);
    } catch (e: any) {
      console.error('[FilterModal] getDistricts failed:', e?.response?.status, e?.message);
    } finally {
      setDistLoading(false);
    }
  };

  const loadClusters = async (distId: string) => {
    try {
      setClustLoading(true);
      setClusters([]);
      const res = await api.getClusters(distId);
      const data = (res?.data || [])
        .map((c: any) => ({ id: String(c.cluster_id), name: c.cluster_name }))
        .filter((c: Option) => c.id !== 'undefined' && c.name);
      console.log('[FilterModal] clusters loaded:', data.length);
      setClusters(data);
    } catch (e: any) {
      console.error('[FilterModal] getClusters failed:', e?.response?.status, e?.message);
    } finally {
      setClustLoading(false);
    }
  };

  const handleStateChange = (id: string, name: string) => {
    setSelectedState(id);
    setSelectedStateName(name);
    setSelectedDistrict('');
    setSelectedDistrictName('');
    setSelectedCluster('');
    setSelectedClusterName('');
    setDistricts([]);
    setClusters([]);
    if (id) loadDistricts(id);
  };

  const handleDistrictChange = (id: string, name: string) => {
    setSelectedDistrict(id);
    setSelectedDistrictName(name);
    setSelectedCluster('');
    setSelectedClusterName('');
    setClusters([]);
    if (id) loadClusters(id);
  };

  const handleApply = () => {
    const filters: any = {
      state_id: selectedState,
      state_name: selectedStateName,
      district_id: selectedDistrict,
      district_name: selectedDistrictName,
      cluster_id: selectedCluster,
      cluster_name: selectedClusterName,
      customer_id: selectedClient,
      date_from: fromDate ? formatDate(fromDate) : '',
      date_to: toDate ? formatDate(toDate) : '',
      search_type: searchValue ? searchBy : '',
    };
    if (searchValue) {
      filters[searchBy] = searchValue;
    }
    onApply(filters);
  };

  const handleReset = () => {
    setSelectedState(''); setSelectedStateName('');
    setSelectedDistrict(''); setSelectedDistrictName('');
    setSelectedCluster(''); setSelectedClusterName('');
    setDistricts([]); setClusters([]);
    setSelectedClient('');
    setFromDate(null); setToDate(null);
    setSearchBy('imei');
    setSearchValue('');
    onApply({});
  };

  const searchOptions = [
    { type: 'imei', label: 'IMEI', placeholder: 'Enter IMEI number', keyboardType: 'numeric' },
    { type: 'site_id', label: 'Site ID', placeholder: 'Enter Site ID', keyboardType: 'default' },
    { type: 'global_id', label: 'Global ID', placeholder: 'Enter Global ID', keyboardType: 'default' },
    { type: 'site_name', label: 'Site Name', placeholder: 'Enter site name', keyboardType: 'default' },
  ];
  const currentSearch = searchOptions.find(s => s.type === searchBy) || searchOptions[0];

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Icon name="sliders" size={18} color="#1e3c72" />
            <Text style={styles.headerTitle}>Filters</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={styles.loadRow}>
                <ActivityIndicator size="small" color="#1e3c72" />
                <Text style={styles.loadText}>Loading options...</Text>
              </View>
            ) : (
              <>
                {!!errorMsg && (
                  <TouchableOpacity onPress={loadInitialData} style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMsg} (Tap to retry)</Text>
                  </TouchableOpacity>
                )}
                <Dropdown
                  label="State"
                  value={selectedState}
                  options={states}
                  onSelect={handleStateChange}
                  placeholder="Select State"
                />
              </>
            )}

            {selectedState ? (
              distLoading ? (
                <View style={styles.loadRow}><ActivityIndicator size="small" color="#1e3c72" /></View>
              ) : (
                <Dropdown label="District" value={selectedDistrict} options={districts} onSelect={handleDistrictChange} placeholder="Select District" />
              )
            ) : null}

            {selectedDistrict ? (
              clustLoading ? (
                <View style={styles.loadRow}><ActivityIndicator size="small" color="#1e3c72" /></View>
              ) : (
                <Dropdown
                  label="Cluster"
                  value={selectedCluster}
                  options={clusters}
                  onSelect={(id, name) => { setSelectedCluster(id); setSelectedClusterName(name); }}
                  placeholder="Select Cluster"
                />
              )
            ) : null}

            {/* Client */}
            <Dropdown
              label="Client Name"
              value={selectedClient}
              options={clients}
              onSelect={(id) => setSelectedClient(id)}
              placeholder="All"
            />

            {/* Search By */}
            <Text style={styles.sectionLabel}>SEARCH BY</Text>
            <View style={styles.searchTypeRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {searchOptions.map(s => (
                  <TouchableOpacity
                    key={s.type}
                    style={[styles.searchChip, searchBy === s.type && styles.searchChipActive]}
                    onPress={() => { setSearchBy(s.type); setSearchValue(''); }}
                  >
                    <Text style={[styles.searchChipText, searchBy === s.type && styles.searchChipTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder={currentSearch.placeholder}
              value={searchValue}
              onChangeText={setSearchValue}
              keyboardType={currentSearch.keyboardType as any}
              placeholderTextColor="#94a3b8"
              autoCorrect={false}
            />

            {/* Dates */}
            <View style={styles.dateRow}>
              <View style={styles.dateGroup}>
                <Text style={ddStyles.label}>From Date</Text>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFromPicker(true)}>
                  <Text style={styles.dateBtnText}>{fromDate ? fromDate.toLocaleDateString() : 'mm/dd/yyyy'}</Text>
                  <Icon name="calendar" size={14} color="#64748b" />
                </TouchableOpacity>
              </View>
              <View style={styles.dateGroup}>
                <Text style={ddStyles.label}>To Date</Text>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowToPicker(true)}>
                  <Text style={styles.dateBtnText}>{toDate ? toDate.toLocaleDateString() : 'mm/dd/yyyy'}</Text>
                  <Icon name="calendar" size={14} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            {showFromPicker && (
              <DateTimePicker
                value={fromDate || new Date()}
                mode="date"
                display="default"
                onChange={(_, date) => { setShowFromPicker(false); if (date) setFromDate(date); }}
              />
            )}
            {showToPicker && (
              <DateTimePicker
                value={toDate || new Date()}
                mode="date"
                display="default"
                onChange={(_, date) => { setShowToPicker(false); if (date) setToDate(date); }}
              />
            )}

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: moderateScale(22), borderTopRightRadius: moderateScale(22), maxHeight: '85%', paddingBottom: verticalScale(10) },
  header: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(8), padding: moderateScale(16), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { flex: 1, fontSize: responsiveFontSize(17), flexShrink: 1, fontWeight: '700', color: '#1e3c72' },
  closeBtn: { padding: moderateScale(6), backgroundColor: '#f1f5f9', borderRadius: 20 },
  body: { paddingHorizontal: moderateScale(16), paddingTop: verticalScale(16) },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: verticalScale(14) },
  loadText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b' },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: moderateScale(8), padding: moderateScale(10), marginBottom: verticalScale(12) },
  errorText: { fontSize: responsiveFontSize(12), flexShrink: 1, color: '#b91c1c' },
  sectionLabel: { fontSize: responsiveFontSize(12), flexShrink: 1, fontWeight: '700', color: '#475569', marginBottom: verticalScale(8), marginTop: verticalScale(8) },
  searchTypeRow: { flexDirection: 'row', gap: moderateScale(8), marginBottom: verticalScale(12) },
  searchChip: { paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(8), borderRadius: moderateScale(8), backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', marginRight: moderateScale(8) },
  searchChipActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
  searchChipText: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '600' },
  searchChipTextActive: { color: '#fff' },
  searchInput: { borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: moderateScale(10), paddingHorizontal: moderateScale(14), paddingVertical: verticalScale(11), fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b', backgroundColor: '#f8fafc', marginBottom: verticalScale(16) },
  dateRow: { flexDirection: 'row', gap: moderateScale(16), marginBottom: verticalScale(16) },
  dateGroup: { flex: 1 },
  dateBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: moderateScale(10), paddingHorizontal: moderateScale(12), paddingVertical: verticalScale(11), backgroundColor: '#f8fafc' },
  dateBtnText: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#1e293b' },
  footer: { flexDirection: 'row', gap: moderateScale(12), paddingHorizontal: moderateScale(16), paddingTop: verticalScale(12), borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  resetBtn: { flex: 1, paddingVertical: verticalScale(14), borderRadius: moderateScale(12), backgroundColor: '#f1f5f9', alignItems: 'center' },
  resetText: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '700', color: '#64748b' },
  applyBtn: { flex: 1, paddingVertical: verticalScale(14), borderRadius: moderateScale(12), backgroundColor: '#1e3c72', alignItems: 'center' },
  applyText: { fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '700', color: '#fff' },
});

export default FilterModal;