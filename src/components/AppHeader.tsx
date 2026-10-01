import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { responsiveFontSize, moderateScale, scale, verticalScale } from '../utils/responsive';

/** Fixed brand color used across all headers */
export const HEADER_BG = '#1e3c72';

interface AppHeaderProps {
  /** Screen title shown in the centre */
  title: string;
  /** Optional sub-title / badge below the title */
  subtitle?: string;
  /** Left icon action. Pass 'menu' for sidebar toggle, 'back' for goBack */
  leftAction?: 'menu' | 'back';
  onLeftPress?: () => void;
  /** Right-side icon buttons [{icon, onPress}] */
  rightActions?: Array<{ icon: string; onPress: () => void; badge?: boolean }>;
}

export default function AppHeader({
  title,
  subtitle,
  leftAction = 'back',
  onLeftPress,
  rightActions = [],
}: AppHeaderProps) {
  return (
    <View style={styles.header}>
      {/* Left button */}
      <TouchableOpacity
        onPress={onLeftPress}
        style={styles.sideBtn}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      >
        <Icon
          name={leftAction === 'menu' ? 'menu' : 'arrow-left'}
          size={24}
          color="#fff"
        />
      </TouchableOpacity>

      {/* Title */}
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>

      {/* Right buttons */}
      <View style={styles.rightWrap}>
        {rightActions.length > 0 ? (
          rightActions.map((a, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={a.onPress}
              style={styles.sideBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Icon name={a.icon} size={22} color="#fff" />
              {a.badge && <View style={styles.badgeDot} />}
            </TouchableOpacity>
          ))
        ) : (
          /* Spacer so title stays centred */
          <View style={{ width: 40 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: HEADER_BG,
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(10),
    paddingHorizontal: moderateScale(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
  },
  sideBtn: {
    width: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: moderateScale(4),
  },
  title: {
    color: '#fff',
    fontSize: responsiveFontSize(17), flexShrink: 1, fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: responsiveFontSize(10), flexShrink: 1, fontWeight: '600',
    marginTop: verticalScale(2),
  },
  rightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(2),
  },
  badgeDot: {
    position: 'absolute',
    top: verticalScale(2),
    right: scale(2),
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: '#fbbf24',
    borderWidth: 1,
    borderColor: '#fff',
  },
});

