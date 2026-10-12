import { StyleSheet, Text, View } from 'react-native';
import { responsiveFontSize, moderateScale, verticalScale } from '../../utils/responsive';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect } from 'react';
import * as Animatable from 'react-native-animatable';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const SplashScreen = ({ navigation }: Props) => {
  useEffect(() => {
    let isMounted = true;

    const checkSessionAndNavigate = async () => {
      try {
        const [session, fullname] = await Promise.all([
          AsyncStorage.getItem('djangoSession'),
          AsyncStorage.getItem('user_fullname'),
        ]);

        // Keep the splash animation visible for 2.5 to 3 seconds
        await new Promise((resolve) => setTimeout(resolve, 2500));

        if (!isMounted) return;

        if (session) {
          navigation.replace('Home', { fullname: fullname || 'User' });
        } else {
          navigation.replace('Login');
        }
      } catch (e) {
        if (!isMounted) return;
        navigation.replace('Login');
      }
    };

    checkSessionAndNavigate();

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Animatable.Image
        source={require('../../assets/splash.png')}
        style={styles.logo}
        resizeMode="contain"
        duration={2000}
        animation="zoomIn"
      />
      <Animatable.Text
        style={styles.text}
        duration={2000}
        animation="bounceInDown"
      >
        {'Welcome to Shroti Telecom \nPvt Ltd'}
      </Animatable.Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#c5d4eeff',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    height: verticalScale(150),
    width: moderateScale(150),
  },
  text: {
    color: '#02006B',
    fontSize: responsiveFontSize(24), flexShrink: 1, fontWeight: 'bold',
    textAlign: 'center',
    marginTop: verticalScale(20),
  },
});

export default SplashScreen;
