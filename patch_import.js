const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import AsyncStorage')) {
    code = code.replace(
        "import React, { useState, useEffect } from 'react';", 
        "import React, { useState, useEffect } from 'react';\nimport AsyncStorage from '@react-native-async-storage/async-storage';"
    );
    fs.writeFileSync(file, code);
    console.log('Added AsyncStorage import');
} else {
    console.log('AsyncStorage import already exists');
}
