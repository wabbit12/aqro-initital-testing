import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { 
  View, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  TextInput,
  Alert,
  FlatList,
  Image,
  Modal as RNModal,
  Platform,
  Animated,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { 
  RegularText, 
  SemiBoldText
} from '../../components/StyledComponents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getApiUrl } from '../../services/apiConfig';

const { width } = Dimensions.get('window');

const AdminRestaurantsScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const { user, userToken } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fadeIn = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const fadeOut = useCallback((callback) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (callback) callback();
    });
  }, [fadeAnim]);

  const openRestaurantModal = (restaurant = null) => {
    setSelectedRestaurant(restaurant);
    setModalVisible(true);
    fadeIn();
  };
 
  // Fetch restaurants
  const fetchRestaurants = async () => {
    try {
      setRefreshing(true);
      const storedToken = await AsyncStorage.getItem('aqro_token');
      const response = await axios.get(`${getApiUrl()}/restaurants`, {
        headers: { 
          Authorization: `Bearer ${storedToken}`,
          'Content-Type': 'application/json'
        }
      });
      setRestaurants(response.data);
    } catch (error) {
      console.error('Error fetching restaurants:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Failed to fetch restaurants');
    } finally {
      setRefreshing(false);
    }
  };

  // Pick Logo Image
  const pickLogoImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setLocalRestaurant(prev => ({ ...prev, logo: result.assets[0].uri }));
    }
  };

  // Create/Update Restaurant
  const handleSaveRestaurant = async (restaurantData) => {
    try {
      const storedToken = await AsyncStorage.getItem('aqro_token');
      
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append('name', restaurantData.name);
      formData.append('description', restaurantData.description);
      formData.append('contactNumber', restaurantData.contactNumber);
      formData.append('location[address]', restaurantData.location.address);
      formData.append('location[city]', restaurantData.location.city);
      formData.append('isActive', restaurantData.isActive);

      // Add logo if it exists and is a URI (new upload)
      if (restaurantData.logo && restaurantData.logo.startsWith('file:')) {
        const logoFile = {
          uri: restaurantData.logo,
          type: 'image/jpeg',
          name: 'logo.jpg'
        };
        formData.append('logo', logoFile);
      }
  
      if (selectedRestaurant) {
        // Update existing restaurant
        await axios.put(
          `${getApiUrl()}/restaurants/${selectedRestaurant._id}`, 
          formData, 
          { 
            headers: { 
              Authorization: `Bearer ${storedToken}`,
              'Content-Type': 'multipart/form-data'
            } 
          }
        );
      } else {
        // Create new restaurant
        await axios.post(
          `${getApiUrl()}/restaurants`, 
          formData, 
          { 
            headers: { 
              Authorization: `Bearer ${storedToken}`,
              'Content-Type': 'multipart/form-data'
            } 
          }
        );
      }
      
      // Reset form and close modal
      fetchRestaurants();
      setModalVisible(false);
      setSelectedRestaurant(null);
    } catch (error) {
      console.error('Error saving restaurant:', error.response?.data || error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save restaurant');
    }
  };

  // Delete restaurant
  const handleDeleteRestaurant = async (restaurantId) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this restaurant? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const storedToken = await AsyncStorage.getItem('aqro_token');
              await axios.delete(
                `${getApiUrl()}/restaurants/${restaurantId}`,
                {
                  headers: { 
                    Authorization: `Bearer ${storedToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              fetchRestaurants();
            } catch (error) {
              console.error('Error deleting restaurant:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message || 'Failed to delete restaurant'
              );
            }
          },
        },
      ]
    );
  };

  // Handle viewing containers or other related items
  const handleViewContainers = (restaurantId) => {
    setActionModalVisible(false);
    navigation.navigate('AdminContainerScreen', { restaurantId });
  };

  // Helper function for email validation
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Helper function for phone number validation
  const isValidPhoneNumber = (phoneNumber) => {
    // Basic validation for Philippine phone numbers
    const phoneRegex = /^(\+?63|0)9\d{9}$/;
    return phoneRegex.test(phoneNumber);
  };

  const renderRestaurantItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.restaurantCard, 
        { 
          backgroundColor: theme?.card || '#FFFFFF', 
          borderColor: theme?.border || '#E0E0E0' 
        }
      ]}
      onPress={() => {
        setSelectedRestaurant(item);
        setActionModalVisible(true);
        fadeIn();
      }}
    >
      <View style={styles.restaurantCardContent}>
        {/* Logo Image or Initials */}
        <View style={styles.logoContainer}>
          {item.logo ? (
            <Image 
            source={{ uri: item.logo }} 
              style={styles.logoImage} 
            />
          ) : (
            <View style={[
              styles.logoInitials, 
              { backgroundColor: theme?.primary || '#007BFF' }
            ]}>
              <RegularText style={styles.logoInitialsText}>
                {item.name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2)}
              </RegularText>
            </View>
          )}
        </View>

        {/* Restaurant Details */}
        <View style={styles.restaurantDetails}>
          <SemiBoldText style={{ color: theme?.text || '#000000' }}>
            {item.name}
          </SemiBoldText>
          <RegularText style={{ color: theme?.textMuted || '#666666' }}>
            {item.location.city}
          </RegularText>
          <RegularText style={{ color: theme?.textMuted || '#666666', fontSize: 12 }}>
            {item.contactNumber}
          </RegularText>
        </View>

        {/* Status Badge */}
        <View style={[
          styles.statusBadge, 
          { 
            backgroundColor: item.isActive 
              ? (theme?.success + '20' || 'rgba(40,167,69,0.1)') 
              : (theme?.danger + '20' || 'rgba(220,53,69,0.1)') 
          }
        ]}>
          <RegularText style={[
            styles.statusText, 
            { 
              color: item.isActive 
                ? (theme?.success || '#28A745') 
                : (theme?.danger || '#DC3545') 
            }
          ]}>
            {item.isActive ? 'Active' : 'Inactive'}
          </RegularText>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Restaurant Management Modal
  const RestaurantModal = () => {
    const [localRestaurant, setLocalRestaurant] = useState({
      name: selectedRestaurant?.name || '',
      description: selectedRestaurant?.description || '',
      contactNumber: selectedRestaurant?.contactNumber || '',
      location: {
        address: selectedRestaurant?.location?.address || '',
        city: selectedRestaurant?.location?.city || '',
      },
      logo: selectedRestaurant?.logo || null,
      isActive: selectedRestaurant?.isActive || false
    });
    const [localError, setLocalError] = useState('');

    const validateForm = () => {
      if (!localRestaurant.name.trim()) {
        setLocalError('Restaurant name is required');
        return false;
      }
      if (!localRestaurant.contactNumber.trim()) {
        setLocalError('Contact number is required');
        return false;
      }
      if (!isValidPhoneNumber(localRestaurant.contactNumber)) {
        setLocalError('Please enter a valid Philippine phone number (e.g., 09123456789)');
        return false;
      }
      if (!localRestaurant.location.address.trim()) {
        setLocalError('Address is required');
        return false;
      }
      if (!localRestaurant.location.city.trim()) {
        setLocalError('City is required');
        return false;
      }
      
      return true;
    };

    return (
      <RNModal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          fadeOut(() => setModalVisible(false));
        }}
      >
        <Animated.View 
          style={[
            styles.modalOverlay,
            { opacity: fadeAnim }
          ]}
        >
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[
              styles.modalContent, 
              { 
                backgroundColor: theme?.background || '#FFFFFF',
                minWidth: width * 0.85,
                maxWidth: width * 0.95
              }
            ]}>
              {/* Title */}
              <SemiBoldText style={[
                styles.modalTitle, 
                { color: theme?.text || '#000000' }
              ]}>
                {selectedRestaurant ? 'Edit Restaurant' : 'Add New Restaurant'}
              </SemiBoldText>
              
              {/* Logo Image Picker */}
              <TouchableOpacity 
                style={styles.logoPickerContainer}
                onPress={pickLogoImage}
              >
                {localRestaurant.logo ? (
                  <Image 
                    source={{ 
                      uri: localRestaurant.logo.startsWith('file:') 
                        ? localRestaurant.logo 
                        : `${getApiUrl()}/${localRestaurant.logo}`.replace('http://localhost:3000/', getApiUrl())
                    }} 
                    style={styles.logoPicker} 
                  />
                ) : (
                  <View style={[
                    styles.logoInitialsLarge,
                    { backgroundColor: theme?.primary || '#007BFF' }
                  ]}>
                    <RegularText style={styles.logoInitialsTextLarge}>
                      {localRestaurant.name 
                        ? localRestaurant.name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2)
                        : 'RS'}
                    </RegularText>
                  </View>
                )}
                <RegularText style={[styles.logoHint, { color: theme?.textMuted || '#888888' }]}>
                  Tap to change logo
                </RegularText>
              </TouchableOpacity>

              {/* Error Message */}
              {localError ? (
                <View style={styles.errorContainer}>
                  <RegularText style={styles.errorText}>
                    {localError}
                  </RegularText>
                </View>
              ) : null}

              {/* Input Fields */}
              <TextInput
                style={[
                  styles.input, 
                  { 
                    backgroundColor: theme?.input || '#F5F5F5', 
                    color: theme?.text || '#000000',
                    borderColor: theme?.border || '#E0E0E0'
                  }
                ]}
                placeholder="Restaurant Name"
                value={localRestaurant.name}
                onChangeText={(text) => {
                  setLocalRestaurant(prev => ({ ...prev, name: text }));
                  setLocalError('');
                }}
                placeholderTextColor={theme?.textMuted || '#888888'}
              />

              <TextInput
                style={[
                  styles.input, 
                  { 
                    backgroundColor: theme?.input || '#F5F5F5', 
                    color: theme?.text || '#000000',
                    borderColor: theme?.border || '#E0E0E0'
                  }
                ]}
                placeholder="Description (optional)"
                value={localRestaurant.description}
                onChangeText={(text) => {
                  setLocalRestaurant(prev => ({ ...prev, description: text }));
                }}
                multiline={true}
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor={theme?.textMuted || '#888888'}
              />

              <TextInput
                style={[
                  styles.input, 
                  { 
                    backgroundColor: theme?.input || '#F5F5F5', 
                    color: theme?.text || '#000000',
                    borderColor: theme?.border || '#E0E0E0'
                  }
                ]}
                placeholder="Contact Number (PH)"
                value={localRestaurant.contactNumber}
                onChangeText={(text) => {
                  setLocalRestaurant(prev => ({ ...prev, contactNumber: text }));
                  setLocalError('');
                }}
                keyboardType="phone-pad"
                placeholderTextColor={theme?.textMuted || '#888888'}
              />

              <TextInput
                style={[
                  styles.input, 
                  { 
                    backgroundColor: theme?.input || '#F5F5F5', 
                    color: theme?.text || '#000000',
                    borderColor: theme?.border || '#E0E0E0'
                  }
                ]}
                placeholder="Address"
                value={localRestaurant.location.address}
                onChangeText={(text) => {
                  setLocalRestaurant(prev => ({ 
                    ...prev, 
                    location: { ...prev.location, address: text } 
                  }));
                  setLocalError('');
                }}
                placeholderTextColor={theme?.textMuted || '#888888'}
              />

              <TextInput
                style={[
                  styles.input, 
                  { 
                    backgroundColor: theme?.input || '#F5F5F5', 
                    color: theme?.text || '#000000',
                    borderColor: theme?.border || '#E0E0E0'
                  }
                ]}
                placeholder="City"
                value={localRestaurant.location.city}
                onChangeText={(text) => {
                  setLocalRestaurant(prev => ({ 
                    ...prev, 
                    location: { ...prev.location, city: text } 
                  }));
                  setLocalError('');
                }}
                placeholderTextColor={theme?.textMuted || '#888888'}
              />

              {/* Active Status Toggle */}
              <TouchableOpacity
                style={styles.activeToggleContainer}
                onPress={() => {
                  setLocalRestaurant(prev => ({ 
                    ...prev, 
                    isActive: !prev.isActive 
                  }));
                }}
              >
                <View style={[
                  styles.radioOuterCircle,
                  { 
                    borderColor: localRestaurant.isActive 
                      ? (theme?.success || '#28A745')
                      : (theme?.border || '#E0E0E0')
                  }
                ]}>
                  {localRestaurant.isActive && (
                    <View 
                      style={[
                        styles.radioInnerCircle,
                        { backgroundColor: theme?.success || '#28A745' }
                      ]} 
                    />
                  )}
                </View>
                <RegularText style={{ color: theme?.text || '#000000', marginLeft: 8 }}>
                  Restaurant is active
                </RegularText>
              </TouchableOpacity>

              {/* Action Buttons */}
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={[
                    styles.modalButton, 
                    styles.cancelButton,
                    { borderColor: theme?.border || '#E0E0E0' }
                  ]}
                  onPress={() => {
                    fadeOut(() => setModalVisible(false));
                  }}
                >
                  <RegularText style={{ color: theme?.text || '#000000' }}>
                    Cancel
                  </RegularText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.modalButton, 
                    styles.saveButton,
                    { backgroundColor: theme?.primary || '#007BFF' }
                  ]}
                  onPress={() => {
                    if (validateForm()) {
                      handleSaveRestaurant(localRestaurant);
                    }
                  }}
                >
                  <RegularText style={{ color: 'white' }}>
                    {selectedRestaurant ? 'Update' : 'Create'}
                  </RegularText>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </RNModal>
    );
  };

  // Action Modal
  const ActionModal = () => {
    const [staffMembers, setStaffMembers] = useState([]);
    const [staffModalVisible, setStaffModalVisible] = useState(false);
    const [availableStaff, setAvailableStaff] = useState([]);
    const [isLoadingStaff, setIsLoadingStaff] = useState(false);
    

    const openStaffModal = (restaurant) => {
        setActionModalVisible(false); // Close the action modal first
        setTimeout(() => {
            setSelectedRestaurant(restaurant);
            setStaffModalVisible(true); // This should trigger the RNModal
        }, 300); // Short delay to allow action modal to close first
    };

      const fetchStaffMembers = async () => {
        try {
          if (!selectedRestaurant?._id) return; // Add this guard clause
          
          const storedToken = await AsyncStorage.getItem('aqro_token');
          const response = await axios.get(
            `${getApiUrl()}/users/restaurant/${selectedRestaurant._id}`, 
            {
              headers: { 
                Authorization: `Bearer ${storedToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          setStaffMembers(response.data);
        } catch (error) {
          console.error('Error fetching staff:', error);
          Alert.alert('Error', 'Failed to fetch staff members');
        }
      };

    const fetchAvailableStaff = async () => {
        try {
            setIsLoadingStaff(true);
            const storedToken = await AsyncStorage.getItem('aqro_token');
            const response = await axios.get(
                `${getApiUrl()}/users?userType=staff&available=true`, 
                {
                    headers: { 
                        Authorization: `Bearer ${storedToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            setAvailableStaff(response.data);
        } catch (error) {
            console.error('Error fetching available staff:', error);
            Alert.alert('Error', 'Failed to fetch available staff');
        } finally {
            setIsLoadingStaff(false);
        }
    };

    const handleDeleteStaff = async (staffId) => {
        Alert.alert(
            'Confirm Delete',
            'Are you sure you want to remove this staff member?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const storedToken = await AsyncStorage.getItem('aqro_token');
                            await axios.patch(
                                `${getApiUrl()}/users/${staffId}`,
                                { restaurantId: null },
                                {
                                    headers: { 
                                        Authorization: `Bearer ${storedToken}`,
                                        'Content-Type': 'application/json'
                                    }
                                }
                            );
                            fetchStaffMembers();
                            fetchAvailableStaff();
                        } catch (error) {
                            console.error('Error deleting staff:', error);
                            Alert.alert('Error', error.response?.data?.message || 'Failed to remove staff');
                        }
                    },
                },
            ]
        );
    };

    const handleAddStaff = async (staffId) => {
        try {
            const storedToken = await AsyncStorage.getItem('aqro_token');
            await axios.patch(
                `${getApiUrl()}/users/${staffId}`,
                { restaurantId: selectedRestaurant._id },
                {
                    headers: { 
                        Authorization: `Bearer ${storedToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            fetchStaffMembers();
            fetchAvailableStaff();
            Alert.alert('Success', 'Staff member added successfully');
        } catch (error) {
            console.error('Error adding staff:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to add staff');
        }
    };

    useFocusEffect(
        useCallback(() => {
          if (staffModalVisible && selectedRestaurant) {
            fetchStaffMembers();
            fetchAvailableStaff();
          }
        }, [staffModalVisible, selectedRestaurant?._id]) // Add _id to dependencies
      );

      useEffect(() => {
        if (staffModalVisible && selectedRestaurant) {
            fetchStaffMembers();
            fetchAvailableStaff();
        }
    }, [staffModalVisible, selectedRestaurant]);

    return (
        <>
         <RNModal
                animationType="fade"
                transparent={true}
                visible={actionModalVisible}
                onRequestClose={() => {
                    fadeOut(() => setActionModalVisible(false));
                }}
            >
                <Animated.View 
                    style={[
                        styles.actionModalOverlay,
                        { opacity: fadeAnim }
                    ]} 
                >
                    <TouchableOpacity 
                        style={styles.actionModalOverlayTouch} 
                        activeOpacity={1} 
                        onPressOut={() => {
                            fadeOut(() => setActionModalVisible(false));
                        }}
                    >
                        <View style={[
                            styles.actionModalContent, 
                            { 
                                backgroundColor: theme?.card || '#FFFFFF',
                                minWidth: width * 0.7,
                                position: 'absolute',
                                bottom: 20,
                                left: 20,
                                right: 20
                            }
                        ]}>
                <TouchableOpacity 
                    style={styles.actionModalButton}
                    onPress={() => {
                    handleViewContainers(selectedRestaurant._id);
                    }}
                >
                    <Ionicons 
                    name="cube-outline" 
                    size={24} 
                    color={theme?.primary || '#007BFF'} 
                    />
                    <RegularText style={{ marginLeft: 10, color: theme?.primary || '#007BFF' }}>
                    View Containers
                    </RegularText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={styles.actionModalButton}
                    onPress={() => {
                        setActionModalVisible(false);
                        openStaffModal(selectedRestaurant);
                    }}
                    >
                    <Ionicons 
                        name="people-outline" 
                        size={24} 
                        color={theme?.text || '#000000'} 
                    />
                    <RegularText style={{ marginLeft: 10, color: theme?.text || '#000000' }}>
                        View Staff
                    </RegularText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={styles.actionModalButton}
                    onPress={() => {
                    setActionModalVisible(false);
                    openRestaurantModal(selectedRestaurant);
                    }}
                >
                    <Ionicons 
                    name="create-outline" 
                    size={24} 
                    color={theme?.text || '#000000'} 
                    />
                    <RegularText style={{ marginLeft: 10, color: theme?.text || '#000000' }}>
                    Edit Restaurant
                    </RegularText>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.actionModalButton}
                    onPress={() => {
                    setActionModalVisible(false);
                    handleDeleteRestaurant(selectedRestaurant._id);
                    }}
                >
                    <Ionicons 
                    name="trash-outline" 
                    size={24} 
                    color="red" 
                    />
                    <RegularText style={{ marginLeft: 10, color: 'red' }}>
                    Delete Restaurant
                    </RegularText>
                </TouchableOpacity>
                </View>
            </TouchableOpacity>
            </Animated.View>
        </RNModal>

        {/* Staff Modal */}
        <RNModal
                animationType="slide"
                transparent={true}
                visible={staffModalVisible}
                onRequestClose={() => {
                    setStaffModalVisible(false);
                }}
            >
                <View style={styles.staffModalContainer}>
                    <View style={[
                        styles.staffModalContent,
                        { backgroundColor: theme?.background || '#FFFFFF' }
                    ]}>
                        <View style={styles.staffModalHeader}>
                            <SemiBoldText style={{ color: theme?.text || '#000000', fontSize: 18 }}>
                                {selectedRestaurant?.name} Staff
                            </SemiBoldText>
                            <TouchableOpacity onPress={() => setStaffModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme?.text || '#000000'} />
                            </TouchableOpacity>
                        </View>
                        {/* Current Staff Members */}
                        <SemiBoldText style={{ color: theme?.text || '#000000', marginBottom: 8 }}>
                            Current Staff
                        </SemiBoldText>
                        <FlatList
                            data={staffMembers}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => (
                                <View style={[
                                    styles.staffItem,
                                    { borderBottomColor: theme?.border || '#E0E0E0' }
                                ]}>
                                    <View style={styles.staffInfo}>
                                        {item.profilePicture ? (
                                            <Image 
                                                source={{ uri: item.profilePicture }} 
                                                style={styles.staffImage} 
                                            />
                                        ) : (
                                            <View style={[
                                                styles.staffInitials,
                                                { backgroundColor: theme?.primary || '#007BFF' }
                                            ]}>
                                                <RegularText style={styles.staffInitialsText}>
                                                    {item.firstName[0]}{item.lastName[0]}
                                                </RegularText>
                                            </View>
                                        )}
                                        <View style={styles.staffDetails}>
                                            <SemiBoldText style={{ color: theme?.text || '#000000' }}>
                                                {item.firstName} {item.lastName}
                                            </SemiBoldText>
                                            <RegularText style={{ color: theme?.textMuted || '#666666' }}>
                                                {item.email}
                                            </RegularText>
                                        </View>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => handleDeleteStaff(item._id)}
                                        style={styles.deleteStaffButton}
                                    >
                                        <Ionicons name="trash-outline" size={20} color="red" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            ListEmptyComponent={() => (
                                <View style={styles.noStaffContainer}>
                                    <RegularText style={{ color: theme?.textMuted || '#666666' }}>
                                        No staff members assigned
                                    </RegularText>
                                </View>
                            )}
                        />

                        {/* Available Staff Members */}
                        <SemiBoldText style={{ color: theme?.text || '#000000', marginTop: 16, marginBottom: 8 }}>
                            Available Staff
                        </SemiBoldText>
                        {isLoadingStaff ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color={theme?.primary || '#007BFF'} />
                            </View>
                        ) : (
                            <FlatList
                                data={availableStaff}
                                keyExtractor={(item) => item._id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.staffItem,
                                            { borderBottomColor: theme?.border || '#E0E0E0' }
                                        ]}
                                        onPress={() => handleAddStaff(item._id)}
                                    >
                                        <View style={styles.staffInfo}>
                                            {item.profilePicture ? (
                                                <Image 
                                                    source={{ uri: item.profilePicture }} 
                                                    style={styles.staffImage} 
                                                />
                                            ) : (
                                                <View style={[
                                                    styles.staffInitials,
                                                    { backgroundColor: theme?.success || '#28A745' }
                                                ]}>
                                                    <RegularText style={styles.staffInitialsText}>
                                                        {item.firstName[0]}{item.lastName[0]}
                                                    </RegularText>
                                                </View>
                                            )}
                                            <View style={styles.staffDetails}>
                                                <SemiBoldText style={{ color: theme?.text || '#000000' }}>
                                                    {item.firstName} {item.lastName}
                                                </SemiBoldText>
                                                <RegularText style={{ color: theme?.textMuted || '#666666' }}>
                                                    {item.email}
                                                </RegularText>
                                            </View>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => handleAddStaff(item._id)}
                                            style={styles.addStaffButtonSmall}
                                        >
                                            <Ionicons name="add" size={20} color={theme?.success || '#28A745'} />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={() => (
                                    <View style={styles.noStaffContainer}>
                                        <RegularText style={{ color: theme?.textMuted || '#666666' }}>
                                            No available staff members
                                        </RegularText>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </RNModal>
        </>
    );
};

  return (
    <SafeAreaView style={[
      styles.container, 
      { backgroundColor: theme?.background || '#FFFFFF' }
    ]}>
      <StatusBar 
        backgroundColor={theme?.background || '#FFFFFF'} 
        barStyle={isDark ? "light-content" : "dark-content"} 
      />
      
      {/* Header */}
      <View style={[
        styles.header, 
        { backgroundColor: theme?.background || '#FFFFFF' }
      ]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={theme?.text || '#000000'} 
          />
        </TouchableOpacity>
        
        <SemiBoldText style={[
          styles.headerTitle, 
          { color: theme?.text || '#000000' }
        ]}>
          Restaurant Management
        </SemiBoldText>
        
        <TouchableOpacity 
          onPress={() => openRestaurantModal()}
        >
          <Ionicons 
            name="add-circle-outline" 
            size={24} 
            color={theme?.primary || '#007BFF'} 
          />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={restaurants}
        renderItem={renderRestaurantItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchRestaurants}
            colors={[theme?.primary || '#007BFF']}
            tintColor={theme?.primary || '#007BFF'}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <RegularText style={{ color: theme?.text || '#000000' }}>
              No restaurants found
            </RegularText>
          </View>
        )}
      />

      <RestaurantModal />
      <ActionModal />
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 2 : 10,
    height: Platform.OS === 'android' ? 76 : 56,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  restaurantCard: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    padding: 12,
  },
  restaurantCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 12,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  logoInitials: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitialsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  restaurantDetails: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 10,
    padding: 16,
    elevation: 5,
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  logoPickerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoPicker: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  logoInitialsLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitialsTextLarge: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoHint: {
    marginTop: 8,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(220,53,69,0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#DC3545',
    fontSize: 14,
  },
  activeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  radioOuterCircle: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInnerCircle: {
    height: 10,
    width: 10,
    borderRadius: 5,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 8,
    borderWidth: 1,
  },
  saveButton: {
    marginLeft: 8,
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionModalOverlayTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionModalContent: {
    borderRadius: 10,
    padding: 8,
    elevation: 5,
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  actionModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  staffModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  staffModalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  staffModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  staffItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  staffInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  staffImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  staffInitials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  staffInitialsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  staffDetails: {
    flex: 1,
  },
  deleteStaffButton: {
    padding: 8,
  },
  noStaffContainer: {
    padding: 20,
    alignItems: 'center',
  },
  addStaffButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStaffButtonSmall: {
    padding: 8,
  },
});

export default AdminRestaurantsScreen;