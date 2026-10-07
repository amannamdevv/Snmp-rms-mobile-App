const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/screens/Home/HomeScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `      const manageFullname = async () => {`;
const injectStr = `      const fetchAndSaveProfile = async () => {
        try {
          const meData = await api.getMe();
          if (meData?.status === 'success') {
            if (meData.role) await AsyncStorage.setItem('user_role', meData.role);
            if (meData.ptye) await AsyncStorage.setItem('user_ptye', String(meData.ptye));
          }
        } catch (e) {
          console.log('Failed to fetch profile', e);
        }
      };
      fetchAndSaveProfile();
`;

if (!code.includes('fetchAndSaveProfile')) {
    code = code.replace(targetStr, injectStr + '\n' + targetStr);
    fs.writeFileSync(file, code);
    console.log('Patched HomeScreen to fetch profile');
} else {
    console.log('HomeScreen already fetches profile');
}
