const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/api/index.js';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('getMe: async')) {
    code = code.replace(
        "export const api = {", 
        "export const api = {\n  getMe: async () => {\n    const response = await djangoApi.get('/api/auth/me/');\n    return response.data;\n  },"
    );
    fs.writeFileSync(file, code);
    console.log('Added getMe API');
} else {
    console.log('getMe API already exists');
}
