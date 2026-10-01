const fs = require('fs');

const file = 'c:/Aman/SNMP-RMSApp/src/screens/AssetHealth/Assethealthdashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Filter imports if missing
if (!content.includes('FilterModal')) {
    content = content.replace(
        "import AppHeader from '../../components/AppHeader';",
        "import AppHeader from '../../components/AppHeader';\nimport FilterModal from '../../components/FilterModal';\nimport GlobalFilterBanner from '../../components/GlobalFilterBanner';\nimport { useGlobalFilter } from '../../context/FilterContext';"
    );
}

// 2. Add Overview Tab
if (!content.includes("{ key: 'overview', label: 'Overview'")) {
    content = content.replace(
        "const TABS = [",
        "const TABS = [\n    { key: 'overview', label: 'Overview', icon: 'pie-chart', api: 'getAssetHealthOverview' },"
    );
}

// 3. Update resolveTabKey
if (!content.includes("if (s === 'overview') return 'overview';")) {
    content = content.replace(
        "if (s === 'la' || s.includes('lightning')) return 'lightning';",
        "if (s === 'overview') return 'overview';\n    if (s === 'la' || s.includes('lightning')) return 'lightning';"
    );
}

// 4. Add OverviewScreen component
if (!content.includes('function OverviewScreen(')) {
    const overviewCode = `
function OverviewScreen({ data, refreshing, onRefresh }: ScreenProps) {
    const o = data?.overview;
    if (!o) return <Empty msg="No overview data available" />;
    
    return (
        <ScrollView
            contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3c72']} />}
        >
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 14, elevation: 3, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 10 }}>Overall Health Score</Text>
                <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 8, borderColor: o.health_percentage > 80 ? '#10b981' : o.health_percentage > 50 ? '#f59e0b' : '#ef4444', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, fontWeight: '900', color: '#0f172a' }}>{o.health_percentage}%</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 10, fontWeight: '600' }}>{o.sites_with_issues} sites have issues</Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                    { label: 'Total Sites', value: o.total_sites, color: '#3b82f6', icon: 'globe' },
                    { label: 'Healthy', value: o.total_healthy, color: '#10b981', icon: 'check-circle' },
                    { label: 'Warning', value: o.total_warning, color: '#f59e0b', icon: 'alert-triangle' },
                    { label: 'Critical', value: o.total_critical, color: '#ef4444', icon: 'alert-octagon' },
                    { label: 'Overloaded', value: o.total_overloaded, color: '#dc2626', icon: 'zap-off' },
                ].map(c => (
                    <View key={c.label} style={{ width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, elevation: 2, borderLeftWidth: 4, borderLeftColor: c.color }}>
                        <Icon name={c.icon} size={20} color={c.color} style={{ marginBottom: 8 }} />
                        <Text style={{ fontSize: 24, fontWeight: '800', color: '#1e293b' }}>{c.value}</Text>
                        <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700', marginTop: 2 }}>{c.label}</Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}
`;
    content = content.replace('// ─────────────────────────────────────────────────────────────\n// SCREENS\n// ─────────────────────────────────────────────────────────────', '// ─────────────────────────────────────────────────────────────\n// SCREENS\n// ─────────────────────────────────────────────────────────────\n' + overviewCode);
}

// 5. Update switch statement
if (!content.includes("case 'overview': return <OverviewScreen")) {
    content = content.replace(
        "case 'battery': return <BatteryScreen {...props} />;",
        "case 'overview': return <OverviewScreen {...props} />;\n            case 'battery': return <BatteryScreen {...props} />;"
    );
}

// 6. Global Filters Injection
if (!content.includes('const { globalFilters')) {
    content = content.replace(
        "const [searchQuery, setSearchQuery] = useState('');",
        "const [searchQuery, setSearchQuery] = useState('');\n    const { globalFilters, setGlobalFilters } = useGlobalFilter();\n    const [filterVisible, setFilterVisible] = useState(false);"
    );
}

if (!content.includes('const res = await fn(globalFilters);')) {
    content = content.replace(
        "const res = await fn();",
        "const res = await fn(globalFilters);"
    );
}

// 7. Re-fetch when global filters change
if (!content.includes('fetchTab(activeTab);')) {
    // Actually the existing code has:
    /*
    useEffect(() => {
        if (!tabData[activeTab] && !tabLoading[activeTab]) {
            fetchTab(activeTab);
        }
    }, [activeTab]);
    */
    // We should make it fetch on filter change too
    content = content.replace(
        "useEffect(() => {\n        if (!tabData[activeTab] && !tabLoading[activeTab]) {\n            fetchTab(activeTab);\n        }\n    }, [activeTab]);",
        "useEffect(() => {\n        fetchTab(activeTab);\n    }, [activeTab, globalFilters]);"
    );
}

// 8. Add Filter Icon in Header and FilterModal & Banner
if (!content.includes('<GlobalFilterBanner />')) {
    content = content.replace(
        "onLeftPress={() => setSidebarVisible(true)}\n                />",
        "onLeftPress={() => setSidebarVisible(true)}\n                    rightActions={[\n                        { icon: 'sliders', onPress: () => setFilterVisible(true) },\n                    ]}\n                />\n\n                <GlobalFilterBanner />"
    );
}

if (!content.includes('<FilterModal')) {
    content = content.replace(
        "<Sidebar",
        "<FilterModal\n                    visible={filterVisible}\n                    onClose={() => setFilterVisible(false)}\n                    initialFilters={globalFilters}\n                    onApply={(f) => {\n                        setGlobalFilters(f);\n                        setFilterVisible(false);\n                        setTabData({}); // clear data to force reload\n                    }}\n                />\n                <Sidebar"
    );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed Assethealthdashboard');
