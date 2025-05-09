import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
  Alert,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { 
  RegularText, 
  MediumText, 
  BoldText, 
  SemiBoldText 
} from '../../components/StyledComponents';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getApiUrl } from '../../services/apiConfig';
import RestaurantModal from '../../components/RestaurantModal';

const ProfileScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const { user, updateUserInfo } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    profilePicture: null
  });

  const [restaurant, setRestaurant] = useState(null);
  const [restaurantModalVisible, setRestaurantModalVisible] = useState(false);
  const [isRestaurantLoading, setIsRestaurantLoading] = useState(false);

  useEffect(() => {
    if (user?.userType === 'staff' && user?.restaurantId) {
      fetchRestaurantData();
    }
  }, [user]);
  
  // Add this function to fetch restaurant data
  const fetchRestaurantData = async () => {
    try {
      setIsRestaurantLoading(true);
      const token = await AsyncStorage.getItem('aqro_token');
      const response = await axios.get(
        `${getApiUrl()}/restaurants/${user.restaurantId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setRestaurant(response.data);
    } catch (error) {
      console.error('Error fetching restaurant data:', error);
    } finally {
      setIsRestaurantLoading(false);
    }
  };
  
  // Add this function to handle restaurant updates
  const handleRestaurantUpdate = async (updatedRestaurant) => {
    try {
      setIsRestaurantLoading(true);
      const token = await AsyncStorage.getItem('aqro_token');
      const response = await axios.put(
        `${getApiUrl()}/restaurants/${updatedRestaurant._id}`,
        updatedRestaurant,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setRestaurant(response.data);
      Alert.alert('Success', 'Restaurant updated successfully');
      setRestaurantModalVisible(false);
    } catch (error) {
      console.error('Error updating restaurant:', error);
      Alert.alert('Error', 'Failed to update restaurant');
    } finally {
      setIsRestaurantLoading(false);
    }
  };
  // Set theme loaded after initial render
  useEffect(() => {
    if (theme) {
      setThemeLoaded(true);
    }
  }, [theme]);

  useEffect(() => {
    if (user) {
      setUserData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        profilePicture: user.profilePicture || null
      });
    }
    fetchUserData();
  }, [user]);

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('aqro_token');
      
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      const response = await axios.get(
        `${getApiUrl('/users/profile')}`, 
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data) {
        setUserData({
          firstName: response.data.firstName || '',
          lastName: response.data.lastName || '',
          email: response.data.email || '',
          profilePicture: response.data.profilePicture || null
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setUserData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const pickImage = async () => {
    try {
      Alert.alert('Select Image Option', '', [
        {
          text: 'Take Photo',
          onPress: async () => {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (permission.status !== 'granted') {
              Alert.alert('Permission Denied', 'Camera access is required to take a photo.');
              return;
            }
            let result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 1,
            });
  
            if (!result.canceled && result.assets.length > 0) {
              processImage(result.assets[0]);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            let result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 1,
            });
  
            if (!result.canceled && result.assets.length > 0) {
              processImage(result.assets[0]);
            }
          },
        },
        {
          text: 'Remove Photo',
          onPress: () => {
            setUserData(prev => ({ ...prev, profilePicture: null }));
          },
          style: 'destructive',
        },
        {
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => console.log('Cancelled'),
        },
      ]);
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };
  
  
  
  // Function to resize and update profile picture
  const processImage = async (selectedAsset) => {
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      selectedAsset.uri,
      [{ resize: { width: 300, height: 300 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
  
    const base64Image = `data:image/jpeg;base64,${manipulatedImage.base64}`;
    setUserData(prev => ({ ...prev, profilePicture: base64Image }));
  };
  

  const saveProfile = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('aqro_token');
      
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      // Optimize profile picture size if it's new
      let optimizedData = {...userData};
      if (userData.profilePicture && 
          userData.profilePicture !== user?.profilePicture && 
          userData.profilePicture.startsWith('data:image')) {
        // Reduce quality for large images
        // This is a simple size check, you might want to implement better compression
        const estimated_size = userData.profilePicture.length * 0.75; // rough estimate
        if (estimated_size > 1000000) { // If > ~1MB
          Alert.alert('Notice', 'Optimizing image size for upload...');
          // In a real app, you would implement image compression here
          // For now, we'll just truncate the base64 string as an example
          // But you should implement proper image resizing
        }
      }
      
      const response = await axios.put(
        `${getApiUrl('/users/profile')}`,
        optimizedData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data) {
        // Update AuthContext with new user info
        updateUserInfo(response.data);
        Alert.alert('Success', 'Profile updated successfully');
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      if (error.response && error.response.data) {
        Alert.alert('Error', error.response.data.message || 'Failed to update profile');
      } else {
        Alert.alert('Error', 'Failed to update profile. Check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const ProfileItem = ({ label, value, editable, field }) => {
    return (
      <View style={styles.profileItem}>
        <RegularText style={{ color: theme ? theme.text : '#000', opacity: 0.7 }}>
          {label || ''}
        </RegularText>
        {isEditing && editable ? (
          <TextInput
            style={[styles.input, { 
              color: theme ? theme.text : '#000',
              borderColor: theme ? theme.border : '#ccc',
              backgroundColor: isDark ? '#2c2c2c' : '#f5f5f5' 
            }]}
            value={value || ''}
            onChangeText={(text) => handleInputChange(field, text)}
            placeholderTextColor={theme ? theme.text + '60' : '#00000060'}
          />
        ) : (
          <SemiBoldText style={{ color: theme ? theme.text : '#000' }}>
            {value || ''}
          </SemiBoldText>
        )}
      </View>
    );
  };

  // Show loading state if theme is not loaded yet
  if (!themeLoaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#fff' }]}>
        <ActivityIndicator size="large" color="#00df82" style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        backgroundColor={theme.background} 
        barStyle={isDark ? "light-content" : "dark-content"} 
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back-outline" size={24} color={theme.text} />
        </TouchableOpacity>
        <BoldText style={[styles.headerTitle, { color: theme.text }]}>
          Profile
        </BoldText>
        <View style={{width: 24}} />
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
        ) : (
          <>
            {/* Profile Picture */}
            <View style={styles.profileImageContainer}>
              <TouchableOpacity 
                onPress={isEditing ? pickImage : null}
                disabled={!isEditing}
                style={styles.profileImageWrapper}
              >
                {userData.profilePicture ? (
                  <Image 
                    source={{ uri: userData.profilePicture }} 
                    style={styles.profileImage} 
                  />
                ) : (
                  <View style={[styles.profileImagePlaceholder, { backgroundColor: theme.primary + '20' }]}>
                    <Ionicons name="person" size={60} color={theme.primary} />
                  </View>
                )}
                
                {isEditing && (
                  <View style={styles.editIconContainer}>
                    <Ionicons name="camera" size={18} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
              
              <BoldText style={[styles.userName, { color: theme.text }]}>
                {`${userData.firstName || ''} ${userData.lastName || ''}`}
              </BoldText>
              <RegularText style={{ color: theme.text, opacity: 0.7 }}>
                {user?.userType || 'customer'}
              </RegularText>
            </View>
            
            {/* Profile Info */}
            <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <ProfileItem 
                label="First Name" 
                value={userData.firstName} 
                editable={true}
                field="firstName"
              />
              <ProfileItem 
                label="Last Name" 
                value={userData.lastName} 
                editable={true}
                field="lastName"
              />
              <ProfileItem 
                label="Email" 
                value={userData.email} 
                editable={true}
                field="email"
              />
            </View>
            
            {/* Buttons */}
            <View style={styles.buttonsContainer}>
              {isEditing ? (
                <>
                  <TouchableOpacity 
                    style={[styles.button, styles.cancelButton]} 
                    onPress={() => {
                      setIsEditing(false);
                      fetchUserData(); 
                    }}
                  >
                    <RegularText style={styles.buttonText}>
                      Cancel
                    </RegularText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.button, styles.saveButton, { backgroundColor: theme.primary }]} 
                    onPress={saveProfile}
                  >
                    <RegularText style={styles.saveButtonText}>
                      Save Changes
                    </RegularText>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity 
                  style={[styles.button, styles.editButton, { borderColor: theme.primary }]} 
                  onPress={() => setIsEditing(true)}
                >
                  <RegularText style={[styles.editButtonText, { color: theme.primary }]}>
                    Edit Profile
                  </RegularText>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
              {user?.userType === 'staff' && restaurant && (
  <>
    <View style={styles.restaurantButtonContainer}>
    <TouchableOpacity 
      style={[styles.button, styles.editButton, { borderColor: theme.primary }]} 
      onPress={() => setRestaurantModalVisible(true)}
    >
      <RegularText style={[styles.editButtonText, { color: theme.primary }]}>
        Edit Restaurant
      </RegularText>
    </TouchableOpacity>
  </View>
    
    <RestaurantModal
      visible={restaurantModalVisible}
      onClose={() => setRestaurantModalVisible(false)}
      restaurant={restaurant}
      onSave={handleRestaurantUpdate}
      isLoading={isRestaurantLoading}
      isStaff={true}
      theme={theme}
    />
  </>
)}
      </ScrollView>



    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 2 : 10,
  },
  headerTitle: {
    fontSize: 24,
  },
  content: {
    padding: 16,
  },
  loader: {
    marginTop: 50,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#00df82',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  userName: {
    fontSize: 22,
    marginBottom: 4,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  profileItem: {
    marginBottom: 16,
  },
  input: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    fontSize: 16,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    minWidth: 140,
    alignItems: 'center',
  },
  editButton: {
    borderWidth: 2,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    marginRight: 12,
  },
  saveButton: {
    marginLeft: 12,
  },
  buttonText: {
    fontSize: 16,
    color: '#757575',
  },
  editButtonText: {
    fontSize: 16,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFF',
  },
  sectionHeader: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 16,
    marginTop: 24,
  },
  restaurantCard: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 24,
    padding: 12,
  },
  restaurantCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantLogoContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 12,
  },
  restaurantLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  restaurantLogoInitials: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantLogoInitialsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  restaurantDetails: {
    flex: 1,
  },
  restaurantButtonContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
});

export default ProfileScreen;