import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Linking, AppState } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const PACKAGE_NAME = 'com.shroti.snmprms';
const MARKET_URL = `market://details?id=${PACKAGE_NAME}`;
const WEB_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`;

export default function CustomUpdateModal({ currentRoute }: { currentRoute?: string }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  const openPlayStore = async () => {
    try {
      const supported = await Linking.canOpenURL(MARKET_URL);
      if (supported) {
        await Linking.openURL(MARKET_URL);
      } else {
        await Linking.openURL(WEB_URL);
      }
    } catch (error) {
      Linking.openURL(WEB_URL).catch(() => console.log('Unable to open Play Store'));
    }
  };

  const checkForUpdate = async () => {
    try {
      const currentVersion = DeviceInfo.getVersion();
      let latestVersion = null;

      try {
        const response = await fetch(`https://play.google.com/store/apps/details?id=${PACKAGE_NAME}&hl=en&gl=US`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        const text = await response.text();
        const match = text.match(/\[\[\["([\d.]+)"\]/);
        if (match && match[1]) {
          latestVersion = match[1];
        }
      } catch (e) {
        console.log('Manual scrape error:', e);
      }

      console.log('Current App Version:', currentVersion);
      console.log('Latest Store Version:', latestVersion);

      let isNeeded = false;
      if (currentVersion && latestVersion) {
        const v1 = currentVersion.split('.').map(Number);
        const v2 = latestVersion.split('.').map(Number);
        for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
          const p1 = v1[i] || 0;
          const p2 = v2[i] || 0;
          if (p2 > p1) {
            isNeeded = true;
            break;
          }
          if (p1 > p2) {
            break;
          }
        }
      }

      if (isNeeded) {
        setUpdateAvailable(true);
        setShowModal(true);
      }
    } catch (error) {
      console.log('Error checking for update:', error);
    }
  };

  useEffect(() => {
    checkForUpdate();

    const subscription = AppState.addEventListener('change', nextState => {
      if (appState.match(/inactive|background/) && nextState === 'active') {
        checkForUpdate();
      }
      setAppState(nextState);
    });

    return () => subscription.remove();
  }, [appState]);

  useEffect(() => {
    if (updateAvailable) {
      setShowModal(true);
    }
  }, [currentRoute, updateAvailable]);

  if (!showModal) return null;

  return (
    <Modal transparent visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
      <View style={styles.overlay}>
        <View style={styles.popup}>
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.desc}>
            A new version of SNMP-RMS is available on the Play Store. Please update the app for the best experience and new features.
          </Text>
          
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.laterBtn} onPress={() => setShowModal(false)} activeOpacity={0.7}>
              <Text style={styles.laterTxt}>Later</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.updateBtn} activeOpacity={0.7} onPress={openPlayStore}>
              <Text style={styles.updateTxt}>Update</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  popup: { backgroundColor: '#ffffff', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 20 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0f203c', marginBottom: 10 },
  desc: { fontSize: 14, color: '#475569', marginBottom: 24, lineHeight: 20 },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between' },
  laterBtn: { flex: 1, paddingVertical: 14, backgroundColor: '#f1f5f9', borderRadius: 12, marginRight: 12, alignItems: 'center' },
  laterTxt: { color: '#64748b', fontWeight: '700', fontSize: 15 },
  updateBtn: { flex: 1, paddingVertical: 14, backgroundColor: '#0f203c', borderRadius: 12, alignItems: 'center' },
  updateTxt: { color: '#ffffff', fontWeight: '700', fontSize: 15 }
});
