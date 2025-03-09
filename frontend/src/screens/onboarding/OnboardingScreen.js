// OnboardingScreen.js
import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Dimensions, SafeAreaView, Platform, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { 
  useSharedValue, 
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolateColor,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import SplashView from './SplashView';
import TopBackSkipView from './TopBackSkipView';
import CenterNextButton from './CenterNextButton';
import RenderItem from './components/RenderItem';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Define onboarding data with different background colors
const onboardingData = [
  {
    id: 1,
    title: 'Scan with aQRo',
    description: 'Scan, save, and make a difference with our simple QR code solution. Join our community in making sustainable choices easier.',
    backgroundColor: '#C5E8D5', // Light green
    textColor: '#25AF90',
    animationSource: require('../../../assets/animations/scan.json')
  },
  {
    id: 2,
    title: 'Save With aQRo',
    description: 'Save time, money, and resources with our innovative QR system. Track your savings and see the impact of your sustainable choices.',
    backgroundColor: '#C5E1E8', // Light blue
    textColor: '#2591AF',
    animationSource: require('../../../assets/animations/save.json')
  },
  {
    id: 3,
    title: 'Sustain With aQRo',
    description: 'Join our mission to create a cleaner planet. Reusable containers have never been easier or more rewarding. Start making a difference today!',
    backgroundColor: '#E8D5C5', // Light orange/brown
    textColor: '#AF7725',
    animationSource: require('../../../assets/animations/sustain.json'),
  },
];

const OnboardingScreen = ({ navigation, onComplete, skipSplash = false }) => {
  const [showSplash, setShowSplash] = useState(!skipSplash);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);
  const x = useSharedValue(0);
  const flatListIndex = useSharedValue(0);
  const scrollDirection = useSharedValue(0);

  // Handle platform-specific layout adjustments
  const isWeb = Platform.OS === 'web';
  const isIOS = Platform.OS === 'ios';

  // Create an animated background style using interpolateColor
  const animatedBackgroundStyle = useAnimatedStyle(() => {
    // Create input and output arrays for color interpolation
    const inputRange = onboardingData.map((_, index) => index * SCREEN_WIDTH);
    const outputRange = onboardingData.map((item) => item.backgroundColor);
    
    const backgroundColor = interpolateColor(
      x.value,
      inputRange,
      outputRange
    );
    
    return {
      backgroundColor,
    };
  });

  // Get current page text color
  const getCurrentPageColor = () => {
    const index = Math.min(Math.max(Math.round(activeIndex), 0), onboardingData.length - 1);
    return onboardingData[index].textColor;
  };

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@has_seen_onboarding', 'true');
      console.log('Onboarding completed, token saved');
      if (onComplete) {
        console.log('Calling onComplete callback');
        onComplete();
      } else {
        // If no onComplete callback, navigate directly
        navigation.navigate('Landing');
      }
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  const onNextClick = () => {
    if (showSplash) {
      setShowSplash(false);
      return;
    }
    
    if (flatListIndex.value < onboardingData.length - 1) {
      scrollDirection.value = 1; // Going right
      const nextIndex = flatListIndex.value + 1;
      setActiveIndex(nextIndex);
      
      // Ensure smooth scrolling to the correct page
      flatListRef.current?.scrollToOffset({ 
        offset: nextIndex * SCREEN_WIDTH,
        animated: true 
      });
      
      // Force update flatListIndex in case the scroll event doesn't trigger properly
      setTimeout(() => {
        flatListIndex.value = nextIndex;
      }, 100);
      
    } else {
      finishOnboarding();
    }
  };

  const onBackClick = () => {
    if (flatListIndex.value > 0) {
      scrollDirection.value = -1; // Going left
      const prevIndex = flatListIndex.value - 1;
      setActiveIndex(prevIndex);
      
      flatListRef.current?.scrollToOffset({ 
        offset: prevIndex * SCREEN_WIDTH, 
        animated: true 
      });
      
      // Force update flatListIndex in case the scroll event doesn't trigger properly
      setTimeout(() => {
        flatListIndex.value = prevIndex;
      }, 100);
      
    } else if (!skipSplash) {
      setShowSplash(true);
    }
  };

  const onSkipClick = () => {
    console.log('Skip button clicked');
    finishOnboarding();
  };

  // Improved scroll handler
  const onScroll = useAnimatedScrollHandler({
    onScroll: event => {
      // Track direction
      if (event.contentOffset.x > x.value) {
        scrollDirection.value = 1; // Going right
      } else if (event.contentOffset.x < x.value) {
        scrollDirection.value = -1; // Going left
      }
      
      x.value = event.contentOffset.x;
      
      // Update index during scrolling for smoother transitions
      flatListIndex.value = event.contentOffset.x / SCREEN_WIDTH;
    },
    onMomentumEnd: event => {
      const index = Math.round(event.contentOffset.x / SCREEN_WIDTH);
      flatListIndex.value = index;
    },
  });

  // Update the active index for UI color changes
  useEffect(() => {
    const updateIndex = () => {
      const newIndex = Math.round(flatListIndex.value);
      if (newIndex !== activeIndex) {
        setActiveIndex(newIndex);
      }
    };
    
    const interval = setInterval(updateIndex, 100);
    return () => clearInterval(interval);
  }, [flatListIndex.value, activeIndex]);

  // Manually ensure FlatList is properly sized for web
  useEffect(() => {
    if (isWeb) {
      const timer = setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToOffset({ offset: 0, animated: false });
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isWeb]);

  if (showSplash) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <SplashView onNextClick={onNextClick} />
      </SafeAreaView>
    );
  }

  const textColor = getCurrentPageColor();

  return (
    <Animated.View style={[styles.container, animatedBackgroundStyle]}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar 
          barStyle="dark-content" 
          backgroundColor="transparent" 
          translucent={true} 
        />
        
        <TopBackSkipView
          onBackClick={onBackClick}
          onSkipClick={onSkipClick}
          flatListIndex={flatListIndex}
          dataLength={onboardingData.length}
          x={x}
          color={textColor}
        />

        <Animated.FlatList
          ref={flatListRef}
          data={onboardingData}
          renderItem={({ item, index }) => (
            <RenderItem 
              item={item} 
              index={index} 
              x={x} 
              isWeb={isWeb}
              isIOS={isIOS}
              screenHeight={SCREEN_HEIGHT}
              // Pass a flag to disable individual background colors in items
              useTransparentBackground={true}
            />
          )}
          keyExtractor={item => item.id.toString()}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          snapToInterval={SCREEN_WIDTH}
          decelerationRate="fast"
          snapToAlignment="center"
          contentContainerStyle={styles.flatListContent}
        />
        
        <CenterNextButton
          onNextClick={onNextClick}
          flatListIndex={flatListIndex}
          dataLength={onboardingData.length}
          x={x}
          color={textColor}
        />
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flatListContent: {
    // Adjust to move content higher
    paddingTop: 0,
  },
});

export default OnboardingScreen;