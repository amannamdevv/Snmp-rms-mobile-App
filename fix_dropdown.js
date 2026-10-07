const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "const Dropdown = ({ label, value, options, onSelect, placeholder, disabled }: {",
    "const Dropdown = ({ label, value, options, onSelect, placeholder, disabled, isOpen, onToggle }: {"
);

fs.writeFileSync(file, code);
console.log('Fixed Dropdown destructuring');
