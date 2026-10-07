const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace Dropdowns
code = code.replace(
    "<Dropdown\n                  label=\"State\"",
    "<Dropdown\n                  isOpen={openDropdown === 'State'}\n                  onToggle={() => setOpenDropdown(openDropdown === 'State' ? null : 'State')}\n                  label=\"State\""
);

code = code.replace(
    "<Dropdown label=\"District\"",
    "<Dropdown isOpen={openDropdown === 'District'} onToggle={() => setOpenDropdown(openDropdown === 'District' ? null : 'District')} label=\"District\""
);

code = code.replace(
    "<Dropdown label=\"Cluster\"",
    "<Dropdown isOpen={openDropdown === 'Cluster'} onToggle={() => setOpenDropdown(openDropdown === 'Cluster' ? null : 'Cluster')} label=\"Cluster\""
);

code = code.replace(
    "<Dropdown\n                  label=\"Client Name\"",
    "<Dropdown\n                  isOpen={openDropdown === 'Client Name'}\n                  onToggle={() => setOpenDropdown(openDropdown === 'Client Name' ? null : 'Client Name')}\n                  label=\"Client Name\""
);

// Replace TextInputs to close dropdown on focus
code = code.replace(
    /onChangeText=\{(.*?)\}/g,
    "onChangeText={$1} onFocus={() => setOpenDropdown(null)}"
);

fs.writeFileSync(file, code);
console.log('Patched Dropdown usages');
