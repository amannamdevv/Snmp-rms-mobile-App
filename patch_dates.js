const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "onPress={() => setShowFromPicker(true)}",
    "onPress={() => { setOpenDropdown(null); setShowFromPicker(true); }}"
);

code = code.replace(
    "onPress={() => setShowToPicker(true)}",
    "onPress={() => { setOpenDropdown(null); setShowToPicker(true); }}"
);

code = code.replace(
    /onPress=\{\(\) => setSearchBy\((.*?)\)\}/g,
    "onPress={() => { setOpenDropdown(null); setSearchBy($1); }}"
);

fs.writeFileSync(file, code);
console.log('Patched Date Pickers and Search By chips to close dropdowns');
