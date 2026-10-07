const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "<Text style={LC.id}>Global ID: {row.global_id || row.globel_id || row.site_id}  A  SID: {row.site_id || '?\"'}  A  IMEI: {row.gsm_imei_no || '?\"'}</Text>",
    "<Text style={LC.globalId}>Global ID: {row.global_id || row.globel_id || row.site_id}</Text>\n                      <Text style={LC.id}>SID: {row.site_id || '?\"'}  A  IMEI: {row.gsm_imei_no || '?\"'}</Text>"
);

// Fallback if the A symbol failed
if (!code.includes("LC.globalId")) {
    code = code.replace(
        /<Text style=\{LC\.id\}>Global ID:.*?<\/Text>/,
        "<Text style={LC.globalId}>Global ID: {row.global_id || row.globel_id || row.site_id}</Text>\n                      <Text style={LC.id}>SID: {row.site_id || '—'}  •  IMEI: {row.gsm_imei_no || '—'}</Text>"
    );
}

code = code.replace(
    "id: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#334155', fontFamily: 'monospace', fontWeight: '500' },",
    "globalId: { fontSize: responsiveFontSize(13), flexShrink: 1, color: '#475569', fontWeight: '700', marginBottom: 2 },\n      id: { fontSize: responsiveFontSize(11), flexShrink: 1, color: '#334155', fontFamily: 'monospace', fontWeight: '500' },"
);

fs.writeFileSync(file, code);
console.log('Patched Global ID text specifically');
