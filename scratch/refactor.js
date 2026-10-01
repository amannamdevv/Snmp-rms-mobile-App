const fs = require('fs');
const path = require('path');

const fileNames = [
  'c:/Aman/SNMP-RMSApp/src/screens/History/SiteLogsScreen.tsx',
  'c:/Aman/SNMP-RMSApp/src/screens/History/HistoricalAlarmsScreen.tsx',
  'c:/Aman/SNMP-RMSApp/src/screens/GridBilling/GridBillingScreen.tsx'
];

fileNames.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Add imports
  if (!content.includes('FilterModal')) {
    content = content.replace(/import AppIcon from '[^']+';/, match => match + "\nimport FilterModal from '../../components/FilterModal';\nimport GlobalFilterBanner from '../../components/GlobalFilterBanner';\nimport { useGlobalFilter } from '../../context/FilterContext';");
  }

  // 2. Remove function FilterDrawer(...) { ... } and const FD = StyleSheet.create(...)
  const filterDrawerStart = content.indexOf('// ─── Filter Drawer');
  const mainStart = content.indexOf('// ─── MAIN');
  if (filterDrawerStart !== -1 && mainStart !== -1) {
    content = content.substring(0, filterDrawerStart) + '\n' + content.substring(mainStart);
  }

  // 3. Replace state
  content = content.replace(/const \[filters, setFilters\] = useState\(\{[^}]+\}\);/m, 'const { globalFilters, setGlobalFilters } = useGlobalFilter();');

  // 4. Update fetchData dependencies
  content = content.replace(/}, \[filters\]\);/g, '}, [globalFilters]);');

  // 5. Replace <FilterDrawer ... /> with <FilterModal ... />
  const replacement = '<FilterModal\\n                visible={filterVisible}\\n                onClose={() => setFilterVisible(false)}\\n                initialFilters={globalFilters}\\n                onApply={(f) => {\\n                    setGlobalFilters(f);\\n                    setFilterVisible(false);\\n                    onApply();\\n                }}\\n            />'.replace(/\\n/g, '\n');
  content = content.replace(/<FilterDrawer[\s\S]*?onApply=\{onApply\}\s*\/>/, replacement);

  // 6. Insert <GlobalFilterBanner />
  if (!content.includes('<GlobalFilterBanner />')) {
      content = content.replace(/(\/>\s*)({\s*hasLoaded)/, '$1<GlobalFilterBanner />\n            $2');
      content = content.replace(/(\/>\s*)({\s*loading)/, '$1<GlobalFilterBanner />\n            $2');
      content = content.replace(/(\/>\s*)(<ScrollView)/, '$1<GlobalFilterBanner />\n            $2');
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated ' + file);
});
