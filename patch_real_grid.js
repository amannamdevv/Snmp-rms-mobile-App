const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /\{columns\.map\(col => \{\s*if \(\['site_name', 'site_id', 'global_id', 'globel_id', 'gsm_imei_no'\]\.includes\(col\)\) return null;\s*return \(\s*<View key=\{col\} style=\{LC\.detailRow\}>\s*<Text style=\{LC\.detailLabel\}>\{colLabel\(col\)\}<\/Text>\s*<Text style=\{LC\.detailValue\}>\{col === 'state_id' && globalFilters\?\.state_name && globalFilters\.state_name !== 'All' \? globalFilters\.state_name : col === 'dist_id' && globalFilters\?\.district_name && !globalFilters\.district_name\.includes\('Select'\) \? globalFilters\.district_name : col === 'cluster_id' && globalFilters\?\.cluster_name && !globalFilters\.cluster_name\.includes\('Select'\) \? globalFilters\.cluster_name : fmtVal\(col, row\[col\]\)\}<\/Text>\s*<\/View>\s*\);\s*\}\)\}/;

const gridLayout = `
<View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 }}>
                      {columns.map(col => {
                          if (['site_name', 'site_id', 'global_id', 'globel_id', 'gsm_imei_no'].includes(col)) return null;
                          return (
                              <View key={col} style={{ width: '48%', backgroundColor: '#f8fafc', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                                  <Text style={[LC.detailLabel, { fontSize: 11, marginBottom: 2, color: '#64748b' }]}>{colLabel(col)}</Text>
                                  <Text style={[LC.detailValue, { fontSize: 13, color: '#0f172a', textAlign: 'left', maxWidth: '100%' }]}>{col === 'state_id' && globalFilters?.state_name && globalFilters.state_name !== 'All' ? globalFilters.state_name : col === 'dist_id' && globalFilters?.district_name && !globalFilters.district_name.includes('Select') ? globalFilters.district_name : col === 'cluster_id' && globalFilters?.cluster_name && !globalFilters.cluster_name.includes('Select') ? globalFilters.cluster_name : fmtVal(col, row[col])}</Text>
                              </View>
                          );
                      })}
</View>
`.trim();

if (regex.test(code)) {
    code = code.replace(regex, gridLayout);
    fs.writeFileSync(file, code);
    console.log('Successfully patched grid layout');
} else {
    console.log('Regex did not match');
}
