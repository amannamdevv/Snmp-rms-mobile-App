import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity
} from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { INDIA_STATES, INDIA_MAP_VIEWBOX } from '../data/IndiaPaths';
import { responsiveFontSize, moderateScale } from '../utils/responsive';

let SCREEN_W = 375;
try { const _d = Dimensions.get('window'); if (_d && typeof _d.width === 'number') SCREEN_W = _d.width; } catch(_) {}

interface MapProps {
  mappingData: Array<[string, number]>;
  width?: number;
}

// API state name → IndiaPaths canonical name
const NAME_MAP: Record<string, string> = {
  'UP East':            'Uttar Pradesh',
  'UP West':            'Uttar Pradesh',
  'Mumbai':             'Maharashtra',
  'J&K':                'Jammu and Kashmir',
  'Jammu & Kashmir':    'Jammu and Kashmir',
  'Orissa':             'Odisha',
  'Uttaranchal':        'Uttarakhand',
  'Pondicherry':        'Puducherry',
  'Arunanchal Pradesh': 'Arunachal Pradesh',
  // Delhi is already "Delhi" in @svg-maps/india — no mapping needed!
};

// Colour: 0 → very light blue, 1 → deep navy
function getColor(ratio: number): string {
  if (ratio <= 0) return '#e8f4fd';
  const stops = [
    { at: 0,    r: 219, g: 234, b: 254 }, // #dbeafe
    { at: 0.25, r: 147, g: 197, b: 253 }, // #93c5fd
    { at: 0.5,  r: 59,  g: 130, b: 246 }, // #3b82f6
    { at: 0.75, r: 29,  g: 78,  b: 216 }, // #1d4ed8
    { at: 1,    r: 15,  g: 45,  b: 107 }, // #0f2d6b
  ];
  const clamped = Math.min(1, Math.max(0, ratio));
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].at && clamped <= stops[i + 1].at) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const t = (hi.at - lo.at) === 0 ? 0 : (clamped - lo.at) / (hi.at - lo.at);
  const r = Math.round(lo.r + (hi.r - lo.r) * t);
  const g = Math.round(lo.g + (hi.g - lo.g) * t);
  const b = Math.round(lo.b + (hi.b - lo.b) * t);
  return `rgb(${r},${g},${b})`;
}


export default function IndiaMap({ mappingData, width }: MapProps) {
  const [selected, setSelected] = useState<{ name: string; count: number } | null>(null);

  // Build countMap using canonical state names
  const countMap = useMemo(() => {
    const m: Record<string, number> = {};
    (mappingData || []).forEach(([rawName, count]) => {
      const name = NAME_MAP[rawName] || rawName;
      m[name] = (m[name] || 0) + count;
    });
    return m;
  }, [mappingData]);

  const maxCount = useMemo(
    () => Math.max(1, ...Object.values(countMap)),
    [countMap]
  );

  // Parse viewBox
  const [, , vbW, vbH] = INDIA_MAP_VIEWBOX.split(' ').map(Number);
  const mapWidth = width ?? SCREEN_W - 32;
  const mapHeight = (vbH / vbW) * mapWidth;

  return (
    <View style={{ width: mapWidth }}>

      {/* Tooltip panel */}
      {selected ? (
        <View style={styles.tooltip}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipState}>{selected.name}</Text>
            <Text style={styles.tipCount}>
              {selected.count} Site{selected.count !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.tipClose}>
            <Text style={styles.tipCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.hint}>Tap any state to see site count</Text>
      )}

      {/* SVG Map */}
      <Svg
        width={mapWidth}
        height={mapHeight}
        viewBox={INDIA_MAP_VIEWBOX}
      >
        <G>
          {INDIA_STATES.map(state => {
            const count = countMap[state.name] || 0;
            const ratio = count / maxCount;
            const isSelected = selected?.name === state.name;
            const fill = isSelected ? '#f59e0b' : getColor(ratio);
            const stroke = isSelected ? '#78350f' : '#ffffff';
            const strokeW = isSelected ? 1.5 : 0.5;

            return (
              <G
                key={state.id}
                onPress={() =>
                  setSelected(isSelected ? null : { name: state.name, count })
                }
              >
                <Path
                  d={state.path}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeW}
                />

              </G>
            );
          })}
        </G>
      </Svg>

      {/* Colour legend */}
      <View style={styles.legendRow}>
        <Text style={styles.legendLbl}>0</Text>
        <View style={styles.legendBar}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={String(i)}
              style={[styles.legendSeg, { backgroundColor: getColor(i / 11) }]}
            />
          ))}
        </View>
        <Text style={styles.legendLbl}>{maxCount}+</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: responsiveFontSize(11), flexShrink: 1, color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 6,
  },
  tooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3c72',
    borderRadius: 10,
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(10),
    marginBottom: 8,
    elevation: 4,
  },
  tipState: { color: '#fff', fontWeight: '700', fontSize: responsiveFontSize(14), flexShrink: 1, },
  tipCount: { color: '#93c5fd', fontSize: responsiveFontSize(12), flexShrink: 1, marginTop: 2 },
  tipClose: { padding: 6 },
  tipCloseText: { color: 'rgba(255,255,255,0.7)', fontSize: responsiveFontSize(18), flexShrink: 1, },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  legendLbl: {
    fontSize: responsiveFontSize(10), flexShrink: 1, color: '#64748b',
    minWidth: 20,
    textAlign: 'center',
  },
  legendBar: {
    flex: 1,
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  legendSeg: { flex: 1 },
});
