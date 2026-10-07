const fs = require('fs');
const file = 'C:/Aman/SNMP-RMSApp/src/components/FilterModal.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace useEffect to also reset local state when initialFilters is empty (banner clear was pressed)
const oldEffect = `  useEffect(() => {
    if (visible) {
      loadInitialData();
      if (initialFilters?.state_id) loadDistricts(initialFilters.state_id);
      if (initialFilters?.district_id) loadClusters(initialFilters.district_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);`;

const newEffect = `  // Sync local state whenever modal opens — ensures banner "Clear" is fully reflected
  useEffect(() => {
    if (visible) {
      loadInitialData();
      // If global filters were cleared externally (e.g. banner Clear button), reset all local selections
      const isEmpty = !initialFilters || Object.keys(initialFilters).length === 0;
      if (isEmpty) {
        setSelectedState(''); setSelectedStateName('');
        setSelectedDistrict(''); setSelectedDistrictName('');
        setSelectedCluster(''); setSelectedClusterName('');
        setDistricts([]); setClusters([]);
        setSelectedClient(''); setSelectedClientName('');
        setFromDate(null); setToDate(null);
        setSearchBy('imei'); setSearchValue('');
      } else {
        // Sync selections with current initialFilters
        setSelectedState(initialFilters?.state_id || '');
        setSelectedStateName(initialFilters?.state_name || '');
        setSelectedDistrict(initialFilters?.district_id || '');
        setSelectedDistrictName(initialFilters?.district_name || '');
        setSelectedCluster(initialFilters?.cluster_id || '');
        setSelectedClusterName(initialFilters?.cluster_name || '');
        setSelectedClient(initialFilters?.customer_id || '');
        setSelectedClientName(initialFilters?.customer_name || '');
        setSearchBy(initialFilters?.search_type || 'imei');
        setSearchValue(
          initialFilters?.imei || initialFilters?.site_id || initialFilters?.global_id || initialFilters?.site_name || ''
        );
        setFromDate(initialFilters?.date_from ? new Date(initialFilters.date_from) : null);
        setToDate(initialFilters?.date_to ? new Date(initialFilters.date_to) : null);
        if (initialFilters?.state_id) loadDistricts(initialFilters.state_id);
        if (initialFilters?.district_id) loadClusters(initialFilters.district_id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, JSON.stringify(initialFilters)]);`;

if (code.includes(oldEffect)) {
    code = code.replace(oldEffect, newEffect);
    fs.writeFileSync(file, code);
    console.log('Patched FilterModal useEffect successfully');
} else {
    console.log('Target string not found. Existing code may have changed.');
}
