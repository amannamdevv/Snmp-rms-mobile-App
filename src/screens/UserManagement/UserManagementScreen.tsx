import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import AppHeader from '../../components/AppHeader';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { responsiveFontSize, moderateScale } from '../../utils/responsive';
import { pick, types } from '@react-native-documents/picker';
import { api } from '../../api';

const BASE_URL = 'https://snmp-rms.shrotitele.com';

// ─── Module definitions ─────────────────────────────────────
const MODULES = [
  { label: 'TT Tool & Support', value: 'tt-tool-support' },
  { label: 'DCEM Analytics', value: 'dcem-analytics' },
  { label: 'Quality Analytics', value: 'quality-analytics' },
  { label: 'LA (Lightning Arrestor) Analytics', value: 'la-analytics' },
  { label: 'PTW Credentials', value: 'ptw-credentials' },
];

const INPUT_METHODS = [
  { label: 'Manual Input', value: 'manual' },
  { label: 'Upload Excel / CSV', value: 'upload' },
];

// Y/N choices
const YN = ['Select', 'YES', 'NO'];

// Fields per module
type FieldDef = { key: string; label: string; type: 'text' | 'yn' | 'date' };
const MODULE_FIELDS: Record<string, FieldDef[]> = {
  'tt-tool-support': [
    { key: 'Site ID', label: 'Site ID', type: 'text' },
    { key: 'Critical Issue Raised (Y/N)', label: 'Critical Issue Raised (Y/N)', type: 'yn' },
    { key: 'Ticket ID', label: 'Ticket ID', type: 'text' },
    { key: 'Closure Status', label: 'Closure Status', type: 'text' },
    { key: 'Portal Issue Reported (Y/N)', label: 'Portal Issue Reported (Y/N)', type: 'yn' },
    { key: 'Correction Done (Y/N)', label: 'Correction Done (Y/N)', type: 'yn' },
    { key: 'Site Escalation Mapping Updated (Y/N)', label: 'Site Escalation Mapping Updated (Y/N)', type: 'yn' },
  ],
  'dcem-analytics': [
    { key: 'Site ID', label: 'Site ID', type: 'text' },
    { key: 'OpCo', label: 'OpCo', type: 'text' },
    { key: 'Tenant Count', label: 'Tenant Count', type: 'text' },
    { key: 'Load Ratio (Billing)', label: 'Load Ratio (Billing)', type: 'text' },
    { key: 'Load Ratio (Upgrade)', label: 'Load Ratio (Upgrade)', type: 'text' },
    { key: 'DCEM vs Billing RRH/RRU (kW)', label: 'DCEM vs Billing RRH/RRU (kW)', type: 'text' },
    { key: 'Per RRH Watt', label: 'Per RRH Watt', type: 'text' },
  ],
  'quality-analytics': [
    { key: 'Site ID', label: 'Site ID', type: 'text' },
    { key: 'Location', label: 'Location', type: 'text' },
    { key: 'Tower Maintenance Done (Y/N)', label: 'Tower Maintenance Done (Y/N)', type: 'yn' },
    { key: 'Tower Maintenance Date', label: 'Tower Maintenance Date (YYYY-MM-DD)', type: 'text' },
    { key: 'Tower Tightening Done (Y/N)', label: 'Tower Tightening Done (Y/N)', type: 'yn' },
    { key: 'Tower Tightening Date', label: 'Tower Tightening Date (YYYY-MM-DD)', type: 'text' },
    { key: 'Wind Zone', label: 'Wind Zone', type: 'text' },
    { key: 'Install Date', label: 'Install Date (YYYY-MM-DD)', type: 'text' },
    { key: 'Zone No', label: 'Zone No', type: 'text' },
    { key: 'Issues', label: 'Issues', type: 'text' },
    { key: 'Tower Truncation Needed (Y/N)', label: 'Tower Truncation Needed (Y/N)', type: 'yn' },
    { key: 'Closure Status', label: 'Closure Status', type: 'text' },
    { key: 'High Load Tower (Y/N)', label: 'High Load Tower (Y/N)', type: 'yn' },
    { key: 'Structural Defects Log (if any)', label: 'Structural Defects Log (if any)', type: 'text' },
    { key: 'Cleaning Photos Logged (Y/N)', label: 'Cleaning Photos Logged (Y/N)', type: 'yn' },
  ],
  'la-analytics': [
    { key: 'Site ID', label: 'Site ID', type: 'text' },
    { key: 'LA Present (Y/N)', label: 'LA Present (Y/N)', type: 'yn' },
    { key: 'Linked to PM Report (Y/N)', label: 'Linked to PM Report (Y/N)', type: 'yn' },
    { key: 'Tower Tightening Done (Y/N)', label: 'Tower Tightening Done (Y/N)', type: 'yn' },
    { key: 'TT Generated for Missing LA (Y/N)', label: 'TT Generated for Missing LA (Y/N)', type: 'yn' },
  ],
  'ptw-credentials': [
    { key: 'Site ID', label: 'Site ID', type: 'text' },
    { key: 'PTW Type', label: 'PTW Type', type: 'text' },
    { key: 'Permit ID', label: 'Permit ID', type: 'text' },
    { key: 'Issued Date', label: 'Issued Date (YYYY-MM-DD)', type: 'text' },
    { key: 'Valid Till', label: 'Valid Till (YYYY-MM-DD)', type: 'text' },
    { key: 'Status', label: 'Status', type: 'text' },
    { key: 'Safety Officer / Supervisor', label: 'Safety Officer / Supervisor', type: 'text' },
  ],
};

// ─── Mini Dropdown ──────────────────────────────────────────
function Dropdown({
  options, value, onChange, placeholder, open, onToggle, zIndex
}: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void; placeholder: string; open: boolean; onToggle: () => void; zIndex?: number }) {
  const selected = options.find(o => o.value === value);

  return (
    <View style={[dd.container, { zIndex: zIndex || 10, elevation: zIndex || 10 }]}>
      <TouchableOpacity style={dd.btn} onPress={onToggle} activeOpacity={0.8}>
        <Text style={[dd.btnText, !selected && dd.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={dd.arrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={dd.list}>
          <ScrollView style={{maxHeight: 250}} nestedScrollEnabled={true}>
          {options.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[dd.option, o.value === value && dd.optionActive]}
              onPress={() => { onChange(o.value); onToggle(); }}
            >
              <Text style={[dd.optionText, o.value === value && dd.optionTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Y/N mini picker ────────────────────────────────────────
function YNPicker({ value, onChange, open, onToggle, zIndex }: { value: string; onChange: (v: string) => void; open: boolean; onToggle: () => void; zIndex?: number }) {
  return (
    <View style={[dd.container, { zIndex: zIndex || 10, elevation: zIndex || 10 }]}>
      <TouchableOpacity style={[dd.btn, { paddingVertical: 8 }]} onPress={onToggle}>
        <Text style={[dd.btnText, !value || value === 'Select' ? dd.placeholder : {}]}>
          {value || 'Select'}
        </Text>
        <Text style={dd.arrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={dd.list}>
          {YN.map(yn => (
            <TouchableOpacity
              key={yn}
              style={[dd.option, yn === value && dd.optionActive]}
              onPress={() => { onChange(yn === 'Select' ? '' : yn); onToggle(); }}
            >
              <Text style={[dd.optionText, yn === value && dd.optionTextActive]}>{yn}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────
const UserManagementScreen = ({ navigation }: any) => {
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [fullname, setFullname] = useState('User');

  const [module, setModule] = useState('');
  const [method, setMethod] = useState('');
  const [rowCount, setRowCount] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [formGenerated, setFormGenerated] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [searchSiteId, setSearchSiteId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem('user_fullname').then(n => { if (n) setFullname(n); });
  }, []);

  const handleFilePick = async () => {
    try {
      const [res] = await pick({
        allowMultiSelection: false,
        type: [types.csv, types.xls, types.xlsx, types.allFiles],
      });
      setSelectedFile(res);
    } catch (err: any) {
      if (err?.code !== 'OPERATION_CANCELED') {
        Alert.alert('Error', 'Could not pick file.');
      }
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !module) return;
    setSubmitting(true);
    try {
      const session = await AsyncStorage.getItem('djangoSession');
      const formData = new FormData();
      formData.append('module', module);
      formData.append('method', 'upload');
      formData.append('import_file', {
        uri: selectedFile.uri,
        type: selectedFile.type,
        name: selectedFile.name,
      });

      const resp = await fetch(`${BASE_URL}/api/user-management-upload/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
          'Cookie': session ? `sessionid=${session}` : '',
        },
        body: formData,
      });
      
      if (resp.ok) {
        Alert.alert('Success', 'File uploaded successfully!', [
          { text: 'OK', onPress: () => { setSelectedFile(null); setMethod(''); } }
        ]);
      } else {
        Alert.alert('Server Error', 'Failed to upload file.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not upload file.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateRows = () => {
    const n = parseInt(rowCount, 10);
    if (isNaN(n) || n < 1 || n > 50) {
      Alert.alert('Invalid', 'Please enter a number between 1 and 50.');
      return;
    }
    const fields = MODULE_FIELDS[module] || [];
    const emptyRow: Record<string, string> = {};
    fields.forEach(f => { emptyRow[f.key] = ''; });
    setRows(Array.from({ length: n }, () => ({ ...emptyRow })));
    setFormGenerated(true);
  };

  const updateRow = (rowIdx: number, key: string, val: string) => {
    setRows(prev => {
      const updated = [...prev];
      updated[rowIdx] = { ...updated[rowIdx], [key]: val };
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!module || !method) return;
    // Validate all Site IDs filled
    const missing = rows.findIndex(r => !r['Site ID']?.trim());
    if (missing !== -1) {
      Alert.alert('Missing', `Row ${missing + 1}: Site ID is required.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        module,
        rows
      };

      const resp = await api.submitUserManagementData(payload);
      
      Alert.alert('Success', 'Data saved successfully!', [
        { text: 'OK', onPress: () => { setModule(''); setMethod(''); setRows([]); setRowCount(''); setFormGenerated(false); } }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not connect to server.');
    } finally {
      setSubmitting(false);
    }
  };

  const fields = MODULE_FIELDS[module] || [];

  return (
    <LinearGradient colors={['#0f2027', '#203a43', '#2c5364']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader
          title="User Management"
          leftAction="menu" onLeftPress={() => setSidebarVisible(true)}
        />
        <Sidebar
          isVisible={isSidebarVisible}
          onClose={() => setSidebarVisible(false)}
          navigation={navigation}
          fullname={fullname}
          activeRoute="UserManagement"
          handleLogout={() => { AsyncStorage.clear(); navigation.replace('Login'); }}
        />

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" onScroll={() => setActiveDropdown(null)} scrollEventThrottle={16}>

          {/* ── Module + Method selector card ── */}
          <View style={[s.card, { zIndex: 6000, elevation: 6000 }]}>
            <Text style={s.cardTitle}>User Management Input</Text>

            <Text style={s.label}>Select Module</Text>
            <Dropdown
              options={MODULES}
              value={module}
              onChange={v => { setModule(v); setMethod(''); setRows([]); setFormGenerated(false); }}
              placeholder="Select Module"
              open={activeDropdown === 'module'}
              onToggle={() => setActiveDropdown(activeDropdown === 'module' ? null : 'module')}
              zIndex={5000}
            />

            {module !== '' && (
              <>
                <Text style={[s.label, { marginTop: moderateScale(16) }]}>Select Input Method</Text>
                <Dropdown
                  options={INPUT_METHODS}
                  value={method}
                  onChange={v => { setMethod(v); setRows([]); setFormGenerated(false); }}
                  placeholder="Select Input Method"
                  open={activeDropdown === 'method'}
                  onToggle={() => setActiveDropdown(activeDropdown === 'method' ? null : 'method')}
                  zIndex={4000}
                />
                {method !== '' && (
                  <Text style={s.hint}>You can change module or method anytime.</Text>
                )}
              </>
            )}
          </View>

          {/* ── File Upload Box ── */}
          {module !== '' && method === 'upload' && (
            <View style={[s.uploadContainer, { zIndex: 1000 }]}>
              <View style={s.uploadHeader}>
                <Text style={s.uploadTitle}>User Management - {MODULES.find(m => m.value === module)?.label}</Text>
              </View>
              
              <View style={s.uploadRow}>
                <TouchableOpacity style={s.chooseBtn} onPress={handleFilePick}>
                  <Text style={s.chooseBtnText}>Choose File</Text>
                </TouchableOpacity>
                <Text style={s.fileName} numberOfLines={1}>
                  {selectedFile ? selectedFile.name : 'No file chosen'}
                </Text>
                <TouchableOpacity style={s.importBtn} onPress={handleFileUpload} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.importBtnText}>Import</Text>}
                </TouchableOpacity>

                <TextInput 
                  style={s.searchInput}
                  placeholder="Search Site ID..."
                  placeholderTextColor="#94a3b8"
                  value={searchSiteId}
                  onChangeText={setSearchSiteId}
                />
                <TouchableOpacity style={s.importBtn}>
                  <Text style={s.importBtnText}>Search</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.clearBtn} onPress={() => setSearchSiteId('')}>
                  <Text style={s.importBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={s.uploadHint}>Upload an Excel/CSV file to see the table here.</Text>
            </View>
          )}

          {/* ── Row count + Generate ── */}
          {module !== '' && method === 'manual' && (
            <View style={[s.card, { zIndex: 3000, elevation: 3000 }]}>
              <Text style={s.label}>How many rows to add?</Text>
              <View style={s.rowCountRow}>
                <TextInput
                  style={s.rowInput}
                  value={rowCount}
                  onChangeText={setRowCount}
                  placeholder="e.g., 5"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
                <TouchableOpacity style={s.genBtn} onPress={generateRows} activeOpacity={0.8}>
                  <Text style={s.genBtnText}>Generate Form</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Dynamic row forms ── */}
          {formGenerated && method === 'manual' && rows.map((row, rowIdx) => (
            <View key={rowIdx} style={[s.rowCard, { zIndex: 1000 - rowIdx, elevation: 1000 - rowIdx }]}>
              <Text style={s.rowTitle}>Row {rowIdx + 1}</Text>
              <View style={s.fieldsGrid}>
                {fields.map((field, fieldIdx) => (
                  <View key={field.key} style={[s.fieldBox, field.type === 'yn' ? s.fieldHalf : s.fieldFull, { zIndex: 100 - fieldIdx, elevation: 100 - fieldIdx }]}>
                    <Text style={s.fieldLabel}>{field.label}</Text>
                    {field.type === 'yn' ? (
                      <YNPicker
                        value={row[field.key]}
                        onChange={v => updateRow(rowIdx, field.key, v)}
                        open={activeDropdown === ('yn-' + rowIdx + '-' + field.key)}
                        onToggle={() => setActiveDropdown(activeDropdown === ('yn-' + rowIdx + '-' + field.key) ? null : ('yn-' + rowIdx + '-' + field.key))}
                      />
                    ) : (
                      <TextInput
                        style={s.textInput}
                        value={row[field.key]}
                        onChangeText={v => updateRow(rowIdx, field.key, v)}
                        placeholder={field.key === 'Site ID' ? 'Required' : ''}
                        placeholderTextColor="#94a3b8"
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* ── Submit button ── */}
          {formGenerated && method === 'manual' && rows.length > 0 && (
            <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>Submit All Rows</Text>}
            </TouchableOpacity>
          )}

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default UserManagementScreen;

// ─── Styles ─────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll: { padding: moderateScale(16), paddingBottom: moderateScale(60) },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: moderateScale(20),
    marginBottom: moderateScale(16),
  },
  cardTitle: {
    fontSize: responsiveFontSize(19), flexShrink: 1, fontWeight: '700',
    color: '#2563eb',
    textAlign: 'center',
    marginBottom: moderateScale(20),
  },
  label: { fontSize: responsiveFontSize(15), flexShrink: 1, fontWeight: '600', color: '#374151', marginBottom: 8 },
  hint: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#2563eb', marginTop: moderateScale(10), textAlign: 'center' },
  rowCountRow: { flexDirection: 'row', gap: moderateScale(12), alignItems: 'center' },
  rowInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(10),
    fontSize: responsiveFontSize(16), flexShrink: 1, color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  genBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: moderateScale(18),
    paddingVertical: moderateScale(12),
  },
  genBtnText: { color: '#fff', fontWeight: '700', fontSize: responsiveFontSize(15), flexShrink: 1, },
  rowCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: moderateScale(16),
    marginBottom: moderateScale(16),
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  rowTitle: {
    fontSize: responsiveFontSize(17), flexShrink: 1, fontWeight: '700',
    color: '#1e40af',
    marginBottom: moderateScale(14),
  },
  fieldsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(12) },
  fieldBox: {},
  fieldFull: { width: '100%' },
  fieldHalf: { width: '47%' },
  fieldLabel: { fontSize: responsiveFontSize(14), flexShrink: 1, color: '#2563eb', fontWeight: '600', marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 7,
    paddingHorizontal: moderateScale(10),
    paddingVertical: 9,
    fontSize: responsiveFontSize(15), flexShrink: 1, color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  submitBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: moderateScale(16),
    alignItems: 'center',
    marginTop: 8,
    elevation: 4,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: responsiveFontSize(17), flexShrink: 1, },
  uploadContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: moderateScale(16),
    overflow: 'hidden',
  },
  uploadHeader: {
    backgroundColor: '#0070a8',
    padding: moderateScale(12),
  },
  uploadTitle: {
    color: '#fff',
    fontSize: responsiveFontSize(16), flexShrink: 1, fontWeight: '700',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(12),
    backgroundColor: '#0083ca',
    gap: 8,
    flexWrap: 'wrap',
  },
  chooseBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: moderateScale(12),
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  chooseBtnText: {
    color: '#0f172a',
    fontSize: responsiveFontSize(14), flexShrink: 1, },
  fileName: {
    color: '#fff',
    fontSize: responsiveFontSize(14), flexShrink: 1, maxWidth: 100,
  },
  importBtn: {
    backgroundColor: '#005f90',
    paddingHorizontal: moderateScale(16),
    paddingVertical: 6,
    borderRadius: 4,
  },
  clearBtn: {
    backgroundColor: '#004a71',
    paddingHorizontal: moderateScale(16),
    paddingVertical: 6,
    borderRadius: 4,
  },
  importBtnText: {
    color: '#fff',
    fontSize: responsiveFontSize(14), flexShrink: 1, fontWeight: '600'
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: moderateScale(10),
    paddingVertical: 4,
    fontSize: responsiveFontSize(14), flexShrink: 1, minWidth: 120,
    color: '#1e293b'
  },
  uploadHint: {
    textAlign: 'center',
    padding: moderateScale(20),
    color: '#475569',
    fontSize: responsiveFontSize(14), flexShrink: 1, backgroundColor: '#f8fafc'
  },
});

const dd = StyleSheet.create({
  container: { position: 'relative' },
  btn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(12),
    backgroundColor: '#f8fafc',
  },
  btnText: { fontSize: responsiveFontSize(16), flexShrink: 1, color: '#1e293b', flex: 1 },
  placeholder: { color: '#94a3b8' },
  arrow: { color: '#64748b', fontSize: responsiveFontSize(11), flexShrink: 1, },
  list: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  option: { paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(13), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  optionActive: { backgroundColor: '#2563eb' },
  optionText: { fontSize: responsiveFontSize(16), flexShrink: 1, color: '#1e293b' },
  optionTextActive: { color: '#fff', fontWeight: '700' },
});
