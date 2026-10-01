import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useGlobalFilter } from '../context/FilterContext';
import { responsiveFontSize, moderateScale, verticalScale } from '../utils/responsive';

const GlobalFilterBanner = () => {
  const { hasActiveFilters, getFilterLabel, clearGlobalFilters, activeFilterCount } = useGlobalFilter();

  if (!hasActiveFilters) return null;

  return (
    <View style={styles.banner}>
      <Icon name="filter" size={moderateScale(13)} color="#fff" />
      <Text style={styles.label} numberOfLines={1}>
        {getFilterLabel() || 'Filters Active'}
      </Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{activeFilterCount}</Text>
      </View>
      <TouchableOpacity onPress={clearGlobalFilters} style={styles.clearBtn}>
        <Icon name="x" size={moderateScale(12)} color="#fff" />
        <Text style={styles.clearText}>Clear</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3c72',
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(6),
    gap: moderateScale(6),
  },
  label: {
    flex: 1,
    fontSize: responsiveFontSize(11), flexShrink: 1, color: '#e0e7ff',
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(1),
  },
  badgeText: {
    fontSize: responsiveFontSize(10), flexShrink: 1, color: '#fff',
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: moderateScale(10),
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    gap: 3,
  },
  clearText: {
    fontSize: responsiveFontSize(10), flexShrink: 1, color: '#fff',
    fontWeight: '700',
  },
});

export default GlobalFilterBanner;