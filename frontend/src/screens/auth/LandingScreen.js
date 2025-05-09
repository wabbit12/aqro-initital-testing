import React from 'react';
import { 
  View, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  Image,
  StatusBar,
  Dimensions
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { 
  BoldText, 
  SemiBoldText,
  RegularText, 
  ThemedView, 
  PrimaryButton, 
  SecondaryButton 
} from '../../components/StyledComponents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';


//for debugging
const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
    alert('Storage cleared!');
  } catch (e) {
    alert('Failed to clear storage');
  }
};




const { width, height } = Dimensions.get('window');


const LandingScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  useEffect(() => {
    const setNavBarColor = async () => {
      await NavigationBar.setBackgroundColorAsync(theme.background); 
    };
    setNavBarColor();
  }, [theme.background]);

  return (
    <ThemedView style={styles.container}>
      <StatusBar 
        backgroundColor={theme.background} 
        barStyle={isDark ? "light-content" : "dark-content"} 
      />
      
      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <Image 
          source={isDark 
            ? require('../../../assets/images/aqro-logo-dark.png') 
            : require('../../../assets/images/aqro-logo.png')} 
          style={styles.logo} 
          resizeMode="contain" 
        />
      </View>
      
      {/* Main Content */}
      <View style={styles.contentContainer}>
        <View style={styles.headingContainer}>
          <BoldText style={styles.mainHeading}>Scan. Save. Sustain.</BoldText>
          <RegularText style={styles.subHeading}>
            Every scan leads to savings and sustainability
          </RegularText>
        </View>
        
        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <SecondaryButton 
            style={styles.signInButton} 
            onPress={() => navigation.navigate('Login')}
          >
            SIGN IN
          </SecondaryButton>
          
          <PrimaryButton 
            style={styles.signUpButton} 
            onPress={() => navigation.navigate('Register')}
          >
            SIGN UP
          </PrimaryButton>
        </View>

        {/* For debugging, clearing storage */}
        <TouchableOpacity 
          style={styles.debugButton} 
          onPress={clearStorage}
        >
          <RegularText>Clear Storage</RegularText>
        </TouchableOpacity>
        
        {/* Bottom Info */}
        <View style={styles.infoContainer}>

        <View style={styles.partnerContainer}>
                <RegularText style={styles.signupText}>Want to be an AQRO Partner? </RegularText>
                <TouchableOpacity onPress={() => navigation.navigate('RetailRegister')}>
                  <SemiBoldText style={styles.signupLinkText}>Sign-Up!</SemiBoldText>
                </TouchableOpacity>
          </View>

          <RegularText style={styles.infoText}>
            Join thousands of users making a difference with AQRO reusable containers
          </RegularText>
        </View>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20, // Reduce from 30 if needed
    paddingBottom: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: height * 0.1,
  },
  logo: {
    width: 240,
    height: 240,
  },
  headingContainer: {
    alignItems: 'center',
    marginTop: height * 0.02,
    width: '100%', // Add this to ensure full width
  },
  mainHeading: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 2,
    width: '100%', // Add this to ensure text takes full width
  },
  subHeading: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    width: '100%', // Add this to ensure text takes full width
  },
  buttonContainer: {
    width: '90%',
    marginTop: height * 0.05,
  },
  signInButton: {
    marginBottom: 16,
  },
  signUpButton: {},
  debugButton: {
    marginTop: 20,
    padding: 10,
  },
  infoContainer: {
    alignItems: 'center',
    marginTop: height * 0.03,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 10,
    opacity: 0.6,
    textAlign: 'center',
  },
  partnerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  signupText: {
    fontSize: 14,
    opacity: 0.8,
  },
  signupLinkText: {
    fontSize: 14,
    color: '#00df82',
  }
});

export default LandingScreen;