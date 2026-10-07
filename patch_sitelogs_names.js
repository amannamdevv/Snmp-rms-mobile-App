const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Update COL_LABELS
code = code.replace(
    /const COL_LABELS: Record<string, string> = \{[\s\S]*?\};/m,
    `const COL_LABELS: Record<string, string> = {
    state_id: 'State', dist_id: 'District', cluster_id: 'Cluster',
    gsm_imei_no: 'IMEI', site_name: 'Site Name', globel_id: 'Globel ID',
    companyName: 'Company', mainsVoltR: 'Mains Volt R', mainsVoltY: 'Mains Volt Y',
    mainsVoltB: 'Mains Volt B', dgVoltR: 'DG Volt R', dgVoltY: 'DG Volt Y', dgVoltB: 'DG Volt B',
    dgBattVolt: 'DG Battery Volt', btsBattVolt: 'BTS Battery Volt', site_id: 'Site ID',
    kwhMains: 'KWH Mains', kwhDG1: 'KWH DG1', kwhDG2: 'KWH DG2',
    kwhOperator1: 'KWH Operator 1', kwhOperator2: 'KWH Operator 2',
    kwhOperator3: 'KWH Operator 3', kwhOperator4: 'KWH Operator 4',
    room_temp: 'Room Temp', Mains_Frequency: 'Mains Frequency',
    dgFreq: 'DG Frequency', updated_dt: 'Last Updated',
};`
);

// 2. Pass globalFilters to LogCard and use it in fmtVal
code = code.replace(
    "function LogCard({ row, columns }: { row: any; columns: string[] }) {",
    "function LogCard({ row, columns, globalFilters }: { row: any; columns: string[]; globalFilters?: any }) {"
);
code = code.replace(
    "<Text style={LC.detailValue}>{fmtVal(col, row[col])}</Text>",
    "<Text style={LC.detailValue}>{col === 'state_id' && globalFilters?.state_name && globalFilters.state_name !== 'All' ? globalFilters.state_name : col === 'dist_id' && globalFilters?.district_name && !globalFilters.district_name.includes('Select') ? globalFilters.district_name : col === 'cluster_id' && globalFilters?.cluster_name && !globalFilters.cluster_name.includes('Select') ? globalFilters.cluster_name : fmtVal(col, row[col])}</Text>"
);
code = code.replace(
    "<LogCard key={item.gsm_imei_no + i} row={item} columns={columns} />",
    "<LogCard key={item.gsm_imei_no + i} row={item} columns={columns} globalFilters={globalFilters} />"
);

// 3. Increase text sizes
code = code.replace(
    "detailLabel: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#64748b', fontWeight: '600' },",
    "detailLabel: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#64748b', fontWeight: '600' },"
);
code = code.replace(
    "detailValue: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#1e293b', fontWeight: '700', maxWidth: '55%', textAlign: 'right' },",
    "detailValue: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#1e293b', fontWeight: '700', maxWidth: '55%', textAlign: 'right' },"
);
code = code.replace(
    "quickVal: { fontSize: responsiveFontSize(11), flexShrink: 1, fontWeight: '800', color: '#0f172a' },",
    "quickVal: { fontSize: responsiveFontSize(13), flexShrink: 1, fontWeight: '800', color: '#0f172a' },"
);
code = code.replace(
    "quickLab: { fontSize: responsiveFontSize(8), flexShrink: 1, color: '#64748b', fontWeight: '600', marginTop: verticalScale(1) },",
    "quickLab: { fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b', fontWeight: '600', marginTop: verticalScale(1) },"
);

fs.writeFileSync(file, code);
console.log('Patched SiteLogsScreen');
