const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldClientDropdown = `            {/* Client */}
            <Dropdown
              label="Client Name"
              value={selectedClient}
              options={clients}
              onSelect={(id, name) => { setSelectedClient(id); setSelectedClientName(name); }}
              placeholder="All"
            />`;

const newClientDropdown = `            {/* Client - Only show if user has more than 1 client (hides for normal clients, shows for Superadmin) */}
            {clients.length > 1 && (
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
    fs.writeFileSync(file, code);
    console.log('Patched FilterModal to hide client dropdown for normal users');
} else {
    console.log('Could not find Client dropdown string in FilterModal');
}
