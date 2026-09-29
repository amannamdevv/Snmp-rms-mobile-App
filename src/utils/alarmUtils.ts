/**
 * alarmUtils.ts
 * Shared alarm helpers — import in BOTH HomeScreen and LiveAlarmsScreen
 * so counts are always identical.
 */

// ─────────────────────────────────────────────────────────────────
// Field → display name (mirrors backend alarm_field_mapping)
// ─────────────────────────────────────────────────────────────────
export const smpsAlarmFieldMapping: Record<string, string> = {
    DOOR_ALARM: 'Door Alarm',
    MAINS_FAIL: 'Mains Fail',
    DG_ON: 'DG On',
    DG_Failed_to_start: 'DG Failed to Start',
    DG_FUEL_LEVEL_LOW1: 'DG Fuel Level Low 1',
    SITE_ON_BATTERY: 'Site On Battery',
    HIGH_TEMPERATURE: 'High Temperature',
    FIRE_and_SMOKE: 'Fire and Smoke',
    LOW_BATTERY_VOLTAGE: 'Low Battery Voltage',
    EMERGENCY_FAULT: 'Emergency Fault',
    LLOP_FAULT: 'LLOP Fault',
    DG_OVERLOAD: 'DG Overload',
    DG_FUEL_LEVEL_LOW2: 'DG Fuel Level Low 2',
    ALTERNATOR_FAULT: 'Alternator Fault',
    DG_Failed_to_stop: 'DG Failed to Stop',
    reserve: 'Reserve',
};

// ─────────────────────────────────────────────────────────────────
// Severity maps
// ─────────────────────────────────────────────────────────────────
export const smpsAlarmSeverityMap: Record<string, string> = {
    HIGH_TEMPERATURE: 'Major',
    FIRE_and_SMOKE: 'Fire',
    LOW_BATTERY_VOLTAGE: 'Major',
    MAINS_FAIL: 'Major',
    DG_ON: 'Major',
    DG_Failed_to_start: 'Major',
    SITE_ON_BATTERY: 'Major',
    EMERGENCY_FAULT: 'Minor',
    ALTERNATOR_FAULT: 'Minor',
    DG_OVERLOAD: 'Minor',
    DG_FUEL_LEVEL_LOW1: 'Minor',
    DG_FUEL_LEVEL_LOW2: 'Minor',
    LLOP_FAULT: 'Minor',
    DG_Failed_to_stop: 'Minor',
    DOOR_ALARM: 'Minor',
    reserve: 'Minor',
};

export const tpmsAlarmSeverityMap: Record<string, string> = {
    'BB Loop Break': 'Major', 'BB1 DisConnect': 'Major', 'BB2 Disconnect': 'Major',
    'BB3 Disconnect': 'Major', 'BB4 Disconnect': 'Major', 'Rectifier Fail': 'Major',
    'RRU Disconnect': 'Major', 'BTS Open': 'Major', 'RTN Open': 'Major',
    'Shelter Loop Break': 'Major', 'Fiber cut': 'Major', 'camera alarm': 'Major',
    'BTS CABLE CUT': 'Major', 'cable loop break': 'Major', 'Fiber Cabinet open': 'Major',
    'DG Battery Disconnected': 'Major', 'RTN cabinet open': 'Major',
    'Idea BTS Cabinet': 'Major', 'Airtel BTS Cabinet': 'Major',
    'Solar Voltage Sensing': 'Major', 'Solar Loop Break': 'Major',
    'AC 1 Fail': 'Major', 'AC 2 Fail': 'Major', 'AC 3 Fail': 'Major', 'AC 4 Fail': 'Major',
    'High Temperature': 'Major', 'DC Battery low': 'Major', 'Mains Failed': 'Major',
    'Moter 1 Loop Break': 'Major', 'Moter 2 Loop Break': 'Major',
    'Starter Cabinet Open': 'Major', 'Site Battery Low': 'Major',
    'DG Common Fault': 'Major', 'Site On Battery': 'Major',
    'BB Cabinet Door Open': 'Major', 'OAD Shelter Loop Break': 'Major',
    'OAD RRU Disconnect': 'Major', 'OAD BTS Open': 'Major',
    'OAD BTS 1 Open': 'Major', 'OAD BTS 2 Open': 'Major',
    'B LVD Cut': 'Major', 'L LVD Cut': 'Major', 'DG BATTERY LOOPING': 'Major',
    'RF CABLE DISCONNECT': 'Major', 'Servo cabinet open': 'Major',
    'mains voltage trip': 'Major', 'DG Faild to start': 'Major', 'DG Faild to OFF': 'Major',
    'TPMS Battery Low': 'Major', 'Hooter': 'Major', 'FSMK': 'Major', 'MOTN': 'Major',
    'AM MNSF': 'Major', 'BTLV': 'Major',
    'Extra Alarm': 'Minor', 'SOBT': 'Minor', 'Door-Open': 'Minor', 'Door Open': 'Minor',
    'Dg door open': 'Minor', 'DOPN': 'Minor', 'DG on Load': 'Minor',
    'Motion 1': 'Minor', 'Motion 2': 'Minor', 'Motion 3': 'Minor', 'Motion 4': 'Minor',
    'Vibration sensor 1': 'Minor', 'Vibration sensor2': 'Minor',
    'Vibration Sensor 3': 'Minor', 'Vibration sensor 4': 'Minor', 'Vibration sensor 5': 'Minor',
    'PUMP 1': 'Minor', 'Pump 2': 'Minor', 'Pump 3': 'Minor',
    'OAD BB Cabinet Door Open': 'Minor', 'Door-Open 2': 'Minor',
    'airtel odc rack': 'Minor', 'idea odc rack': 'Minor', 'TPMS Supply Failed': 'Minor',
    'Fire and smoke 1': 'Fire', 'fire and smoke 2': 'Fire',
};

// ─────────────────────────────────────────────────────────────────
// Core helpers
// ─────────────────────────────────────────────────────────────────
export function isNightTime(timestamp: string | null | undefined): boolean {
    if (!timestamp) return false;
    const hr = new Date(timestamp).getHours();
    return hr >= 22 || hr < 6;
}

export function isDoorAlarm(field: string, name: string): boolean {
    if (field === 'DOOR_ALARM') return true;
    const patterns = ['door-open', 'door open', 'dopn', 'door_open'];
    return patterns.some(p => (name || '').toLowerCase().includes(p));
}

/** Returns true for noise alarms that should be hidden (LLOP, MAINS_AVAILABLE) */
export function shouldFilterOut(alarm: any): boolean {
    return false; // Return false to ensure parity with backend API counts
}

// ─────────────────────────────────────────────────────────────────
// getSeverity  ← THE single source of truth used everywhere
// ─────────────────────────────────────────────────────────────────
export function getSeverity(alarm: any): 'Fire' | 'NightDoor' | 'Major' | 'Minor' {
    const source = alarm._alarmSource || 'smps';
    const timestamp = alarm.start_time || alarm.create_dt || alarm.created_dt || '';

    if (source === 'tpms') {
        const name = alarm.alarm_name || alarm.alarm_desc || '';
        const upper = name.toUpperCase();
        if (upper.includes('FIRE') || upper.includes('SMOKE') || upper.includes('FSMK')) return 'Fire';
        if (isDoorAlarm('', name) && isNightTime(timestamp)) return 'NightDoor';
        return (tpmsAlarmSeverityMap[name] as any) || 'Minor';
    }

    // SMPS — use active_alarms / closed_alarms arrays
    const allAlarms = [
        ...(alarm.active_alarms || []),
        ...(alarm.closed_alarms || []),
    ];

    if (allAlarms.length === 0) {
        // Fallback to raw alarm_desc field
        const field = alarm.alarm_desc || '';
        if (field === 'FIRE_and_SMOKE') return 'Fire';
        if (isDoorAlarm(field, '') && isNightTime(timestamp)) return 'NightDoor';
        return (smpsAlarmSeverityMap[field] as any) || 'Minor';
    }

    for (const a of allAlarms) {
        if (a.field === 'FIRE_and_SMOKE') return 'Fire';
        if (isDoorAlarm(a.field, a.name) && isNightTime(timestamp)) return 'NightDoor';
    }
    for (const a of allAlarms) {
        if (smpsAlarmSeverityMap[a.field] === 'Major') return 'Major';
    }
    return 'Minor';
}

// ─────────────────────────────────────────────────────────────────
// getAlarmStatus
// ─────────────────────────────────────────────────────────────────
export function getAlarmStatus(alarm: any): 'Open' | 'Closed' {
    // Direct status field - SMPS API sends 'OPEN'/'CLOSED' uppercase
    if (alarm.status) {
        const s = String(alarm.status).toUpperCase();
        if (s === 'OPEN' || s === 'ACTIVE') return 'Open';
        if (s === 'CLOSED' || s === 'CLOSE') return 'Closed';
    }
    if (alarm.alarm_status) {
        const s = String(alarm.alarm_status).toUpperCase();
        if (s === 'OPEN' || s === 'ACTIVE') return 'Open';
        if (s === 'CLOSED' || s === 'CLOSE') return 'Closed';
    }
    if (alarm.current_status) return alarm.current_status as 'Open' | 'Closed';
    return alarm.end_time ? 'Closed' : 'Open';
}

// ─────────────────────────────────────────────────────────────────
// getAlarmName
// ─────────────────────────────────────────────────────────────────
export function getAlarmName(alarm: any): string {
    const source = alarm._alarmSource || 'smps';
    if (source === 'tpms') {
        let name = alarm.alarm_name || alarm.alarm_desc || 'Unknown';
        if (
            (name.toLowerCase().includes('high temperature') || name.toLowerCase().includes('high temp'))
            && alarm.room_temperature_display
        ) name += ` (${alarm.room_temperature_display})`;
        return name;
    }
    // SNMP API: alarm_name returned directly on the record
    if (alarm.alarm_name && alarm.alarm_name !== 'Unknown') {
        return alarm.alarm_name;
    }
    const allAlarms = [...(alarm.active_alarms || []), ...(alarm.closed_alarms || [])];
    if (allAlarms.length > 0) {
        return allAlarms.map((a: any) => {
            let n = a.name || smpsAlarmFieldMapping[a.field] || a.field || 'Unknown';
            if (a.field === 'HIGH_TEMPERATURE' && alarm.room_temperature_display) {
                n += ` (${alarm.room_temperature_display})`;
            }
            return n;
        }).join(', ');
    }
    const field = alarm.alarm_desc || alarm.alarm_type || alarm.trap_name || alarm.trap_type || '';
    return smpsAlarmFieldMapping[field] || field || 'Unknown';
}

// ─────────────────────────────────────────────────────────────────
// getAlarmKey  (dedup)
// ─────────────────────────────────────────────────────────────────
export function getAlarmKey(alarm: any): string {
    const source = alarm._alarmSource || 'smps';
    const siteId = alarm.site_id || '';
    const imei = alarm.imei || '';
    const ts = alarm.start_time || alarm.create_dt || alarm.created_dt || '';

    if (source === 'tpms') {
        if (alarm.alarm_id) return `tpms-${alarm.alarm_id}`;
        return `tpms-${siteId}-${imei}-${alarm.alarm_name || alarm.alarm_desc}-${ts}`;
    }

    // Use backend unique ID first (prevents any merging of distinct records)
    if (alarm.id) return `smps-${alarm.id}`;

    const allAlarms = [...(alarm.active_alarms || []), ...(alarm.closed_alarms || [])];
    const fields = allAlarms.map((a: any) => a.field).sort().join(',');
    if (alarm.event_id && fields) return `smps-${alarm.event_id}-${fields}`;
    if (getAlarmStatus(alarm) === 'Closed') return `smps-${siteId}-${imei}-${fields}-${ts}`;
    return `smps-${siteId}-${imei}-${fields}`;
}

// ─────────────────────────────────────────────────────────────────
// normaliseAndMerge
//   Pass raw API responses; get back a clean, deduped, sorted array
//   with _alarmSource tagged on each item.
//   Used by BOTH HomeScreen and LiveAlarmsScreen.
// ─────────────────────────────────────────────────────────────────
export function normaliseAndMerge(smpsRes: any, rmsRes: any): any[] {
    // ── Normalise SMPS ──
    let smpsRaw: any[] = [];
    if (Array.isArray(smpsRes)) smpsRaw = smpsRes;
    else if (Array.isArray(smpsRes?.data)) smpsRaw = smpsRes.data;
    else if (Array.isArray(smpsRes?.alarms)) smpsRaw = smpsRes.alarms;

    // ── Normalise RMS ──
    let rmsRaw: any[] = [];
    if (Array.isArray(rmsRes)) rmsRaw = rmsRes;
    else if (Array.isArray(rmsRes?.data)) rmsRaw = rmsRes.data;
    else if (rmsRes?.status === 'success' && Array.isArray(rmsRes?.data)) rmsRaw = rmsRes.data;
    else if (Array.isArray(rmsRes?.alarms)) rmsRaw = rmsRes.alarms;

    const smpsTagged = smpsRaw.map(a => ({ ...a, _alarmSource: 'smps' }));
    const rmsTagged = rmsRaw.map(a => ({ ...a, _alarmSource: 'tpms' }));

    // ── Dedup ──
    const uniqueMap = new Map<string, any>();
    [...smpsTagged, ...rmsTagged].forEach(alarm => {
        if (shouldFilterOut(alarm)) return;
        const key = getAlarmKey(alarm);
        const existing = uniqueMap.get(key);
        if (!existing) {
            uniqueMap.set(key, alarm);
        } else {
            const existTs = new Date(existing.start_time || existing.create_dt || 0).getTime();
            const newTs = new Date(alarm.start_time || alarm.create_dt || 0).getTime();
            if (newTs > existTs) uniqueMap.set(key, alarm);
        }
    });

    // ── Sort: open first → newest first ──
    return Array.from(uniqueMap.values()).sort((a, b) => {
        const aOpen = getAlarmStatus(a) === 'Open' ? 0 : 1;
        const bOpen = getAlarmStatus(b) === 'Open' ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        const tA = new Date(a.start_time || a.create_dt || 0).getTime();
        const tB = new Date(b.start_time || b.create_dt || 0).getTime();
        return tB - tA;
    });
}

// ─────────────────────────────────────────────────────────────────
// calcAlarmKpi  ← used on HomeScreen for the 4 KPI counts
// ─────────────────────────────────────────────────────────────────
export function calcAlarmKpi(mergedAlarms: any[]) {
    const counts = { major: 0, minor: 0, fire: 0, nightDoor: 0, open: 0, closed: 0 };
    mergedAlarms.forEach(alarm => {
        const st = getAlarmStatus(alarm);
        const sv = getSeverity(alarm);

        if (st === 'Open') counts.open++; else counts.closed++;

        // Count categories (following internal feed logic: counts all in categories)
        if (sv === 'Fire') counts.fire++;
        else if (sv === 'NightDoor') counts.nightDoor++;
        else if (sv === 'Major') counts.major++;
        else counts.minor++;
    });
    return counts;
}


