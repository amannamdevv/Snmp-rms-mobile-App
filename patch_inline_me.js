const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "const userRole = await AsyncStorage.getItem('user_role');",
    "let userRole = await AsyncStorage.getItem('user_role');\n      if (!userRole) {\n        try {\n          const meRes = await api.getMe();\n          if (meRes?.status === 'success' && meRes.role) {\n            userRole = String(meRes.role).trim();\n            await AsyncStorage.setItem('user_role', userRole);\n          }\n        } catch(e) { console.log('getMe error', e); }\n      }"
);

fs.writeFileSync(file, code);
console.log('Patched FilterModal to fetch getMe inline if user_role is missing');
