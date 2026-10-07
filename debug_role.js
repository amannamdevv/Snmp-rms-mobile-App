const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/Home/HomeScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "if (meData.role) await AsyncStorage.setItem('user_role', meData.role);",
    "if (meData.role) { await AsyncStorage.setItem('user_role', String(meData.role).trim()); console.log('Saved user_role:', String(meData.role).trim()); }"
);

fs.writeFileSync(file, code);
console.log('Added console.log for user_role');
