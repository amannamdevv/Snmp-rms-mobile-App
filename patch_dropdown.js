const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Remove debugRole
code = code.replace("const [debugRole, setDebugRole] = useState('');", "");
code = code.replace("setDebugRole(String(userRole));", "");
code = code.replace("<Text style={styles.headerTitle}>Filters ({debugRole || 'null'})</Text>", "<Text style={styles.headerTitle}>Filters</Text>");

// 2. Dropdown Component Props
code = code.replace(
    "disabled?: boolean;",
    "disabled?: boolean;\n  isOpen?: boolean;\n  onToggle?: () => void;"
);

// 3. Dropdown Component State
code = code.replace(
    "const [open, setOpen] = useState(false);",
    "const [internalOpen, setInternalOpen] = useState(false);\n  const open = isOpen !== undefined ? isOpen : internalOpen;\n  const handleToggle = () => { if (disabled) return; if (onToggle) onToggle(); else setInternalOpen(!internalOpen); };"
);

// 4. Dropdown Toggle onPress
code = code.replace(
    "onPress={() => !disabled && setOpen(!open)}",
    "onPress={handleToggle}"
);

// 5. Dropdown Close onSelect
code = code.replace(
    "onPress={() => { onSelect('', ''); setOpen(false); }}",
    "onPress={() => { onSelect('', ''); if (onToggle) onToggle(); else setInternalOpen(false); }}"
);
code = code.replace(
    "onPress={() => { onSelect(String(o.id), o.name); setOpen(false); }}",
    "onPress={() => { onSelect(String(o.id), o.name); if (onToggle) onToggle(); else setInternalOpen(false); }}"
);

// 6. FilterModal state
code = code.replace(
    "const [isClientUser, setIsClientUser] = useState(false);",
    "const [isClientUser, setIsClientUser] = useState(false);\n  const [openDropdown, setOpenDropdown] = useState<string | null>(null);"
);

fs.writeFileSync(file, code);
console.log('Patched Dropdown implementation');
