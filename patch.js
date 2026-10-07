const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import AsyncStorage from')) {
    code = code.replace("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef } from 'react';\nimport AsyncStorage from '@react-native-async-storage/async-storage';");
}

if (!code.includes('const [isClientUser, setIsClientUser]')) {
    code = code.replace("const [errorMsg, setErrorMsg] = useState('');", "const [errorMsg, setErrorMsg] = useState('');\n  const [isClientUser, setIsClientUser] = useState(false);");
    
    // Add check in loadInitialData
    const initDataStr = "const loadInitialData = async () => {";
    code = code.replace(initDataStr, initDataStr + "\n    const userCtmid = await AsyncStorage.getItem('user_ctmid');\n    if (userCtmid) setIsClientUser(true);");
}

const oldClientDropdown = `{clients.length > 1 && (
                <Dropdown
                  label="Client Name"
                  value={selectedClient}
                  options={clients}
                  onSelect={(id, name) => { setSelectedClient(id); setSelectedClientName(name); }}
                  placeholder="All"
                />
              )}`;

const newClientDropdown = `{(!isClientUser) && (
                <Dropdown
                  label="Client Name"
                  value={selectedClient}
                  options={clients}
                  onSelect={(id, name) => { setSelectedClient(id); setSelectedClientName(name); }}
                  placeholder="All"
                />
              )}`;

if (code.includes(oldClientDropdown)) {
    code = code.replace(oldClientDropdown, newClientDropdown);
} else {
    console.log("Could not find the client dropdown block to replace.");
}

fs.writeFileSync(file, code);
console.log('Patched FilterModal with isClientUser logic');
