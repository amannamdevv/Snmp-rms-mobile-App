import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AppIcon from './AppIcon';

export default function NetworkHandler({ children }: { children: React.ReactNode }) {
    const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            // isInternetReachable can be null initially, we only show offline screen if it's explicitly false
            // but for safety in some networks, if isConnected is false, we definitely have no internet
            if (state.isConnected === false) {
                setIsInternetReachable(false);
            } else if (state.isInternetReachable === false) {
                setIsInternetReachable(false);
            } else {
                setIsInternetReachable(true);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleRetry = () => {
        NetInfo.fetch().then(state => {
            if (state.isConnected === false) {
                setIsInternetReachable(false);
            } else if (state.isInternetReachable === false) {
                setIsInternetReachable(false);
            } else {
                setIsInternetReachable(true);
            }
        });
    };

    if (isInternetReachable === false) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <AppIcon name="wifi-off" size={64} color="#94a3b8" />
                    <Text style={styles.title}>No Internet Connection</Text>
                    <Text style={styles.subtitle}>Please check your internet connection and try again.</Text>
                    <TouchableOpacity style={styles.btn} onPress={handleRetry} activeOpacity={0.8}>
                        <Text style={styles.btnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return <>{children}</>;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    title: { fontSize: 22, fontWeight: '700', color: '#1e293b', marginTop: 24, marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
    btn: { backgroundColor: '#5da3fa', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
