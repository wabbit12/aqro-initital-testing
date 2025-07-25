import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
  Animated,
  Dimensions,
  ScrollView as RNScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { markContainerStatus } from '../../services/activityService';

import { 
  RegularText, 
  MediumText, 
  BoldText, 
  SemiBoldText 
} from '../../components/StyledComponents';
import FilterTabs from '../../components/FilterTabs'; 
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavigationBar from 'expo-navigation-bar';
import { getApiUrl } from '../../services/apiConfig';
import SearchComponent from '../../components/SearchComponent';

const { width, height } = Dimensions.get('window');



const ContainerCard = ({ title, value, icon, backgroundColor, textColor, onPress, isSelected }) => {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        { backgroundColor },
        isSelected && styles.selectedCard
      ]}
      onPress={onPress}
    >
      <View style={styles.cardContent}>
        <Ionicons name={icon} size={24} color={textColor} style={styles.cardIcon} />
        <View style={styles.cardTextContainer}>
          <RegularText style={[styles.cardTitle, { color: textColor }]}>{title}</RegularText>
          <BoldText style={[styles.cardValue, { color: textColor }]}>{value}</BoldText>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ContainerItem = ({ container, onPress }) => {
  const { theme } = useTheme();
  const estimatedUsesLeft = container.containerTypeId.maxUses - container.usesCount; 
  const statusMessage = (() => {
    switch (container.status) {
      case 'active':
        return `${estimatedUsesLeft} uses left`;
      case 'returned':
        return 'Returned';
      case 'lost':
        return 'Lost';
      case 'damaged':
        return 'Damaged';
      default:
        return 'Unknown status'; 
    }
  })();

  const getContainerIcon = (status) => {
    switch (status) {
      case 'active':
        return { name: 'cube-outline', color: '#2e7d32' };
      case 'returned':
        return { name: 'archive-outline', color: '#0277bd' }; 
      case 'lost':
        return { name: 'help-circle-outline', color: '#ff9800' };
      case 'damaged':
        return { name: 'alert-circle-outline', color: '#d32f2f' }; 
      default:
        return { name: 'help-outline', color: '#9e9e9e' }; 
    }
  };
  
  const { name, color } = getContainerIcon(container.status);
  
  const getContainerBackground = (status) => {
    switch (status) {
      case 'active':
        return '#e8f5e9';
      case 'returned':
        return '#e3f2fd';
      case 'lost':
        return '#fff3e0';
      case 'damaged':
        return '#ffebee'; 
      default:
        return '#e0e0e0'; 
    }
  };
  
  const backgroundColor = getContainerBackground(container.status);
  
  return (
    <TouchableOpacity 
      style={[styles.containerItem, { backgroundColor: theme.card }]}
      onPress={() => onPress(container)}
    >
      <View style={styles.containerItemContent}>
        <View style={styles.containerItemLeft}>
          <View style={[styles.containerIcon, { backgroundColor }]}>
            <Ionicons name={name} size={24} color={color} />
          </View>
          <View style={styles.containerInfo}>
            <SemiBoldText style={{ fontSize: 16, color: theme.text }}>
              {container.containerTypeId.name}
            </SemiBoldText>
            <RegularText style={{ color: theme.text }}>
              {statusMessage}
            </RegularText>
            {container.restaurantId && (
              <RegularText style={{ color: theme.text, fontSize: 12, opacity: 0.7 }}>
                {container.restaurantId.name}
              </RegularText>
            )}
          </View>
        </View>
        <View style={styles.containerItemRight}>
          <Ionicons name="chevron-forward" size={20} color={theme.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const RebateSection = ({ container, theme }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [restaurantRebates, setRestaurantRebates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const animatedHeight = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchRestaurantRebates = async () => {
      if (!container || !container.containerTypeId) {
        console.error('Container or Container Type is missing');
        setIsLoading(false);
        return;
      }
    
      try {
        const token = await AsyncStorage.getItem('aqro_token');
        if (!token) {
          console.error('No auth token found');
          setIsLoading(false);
          return;
        }
    
        const containerTypeId = container.containerTypeId._id || container.containerTypeId;
    
        const response = await axios.get(
          `${getApiUrl('/containers/rebate-mappings-by-container-type')}/${containerTypeId}`, 
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
    
        if (response.data && response.data.length > 0) {
          // Filter out any mappings where restaurantId is null
          const rebatesWithNames = response.data
            .filter(mapping => mapping.restaurantId) // Only include mappings with restaurantId
            .map(mapping => ({
              restaurantName: mapping.restaurantId?.name || 'Unknown Restaurant',
              rebateValue: mapping.rebateValue
            }));
    
          setRestaurantRebates(rebatesWithNames);
        }
      } catch (error) {
        console.error('Error fetching restaurant rebates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRestaurantRebates();
  }, [container]); 

  const toggleExpand = () => {
    const dynamicHeight = isExpanded 
      ? 0 
      : Math.min(
          (restaurantRebates.length || 1) * 50, 
          250
        );

    Animated.timing(animatedHeight, {
      toValue: dynamicHeight,
      duration: 300,
      useNativeDriver: false
    }).start(() => {
      setIsExpanded(!isExpanded);
    });
  };

  if (isLoading && restaurantRebates.length === 0) {
    return (
      <View style={[styles.detailRow, { flexDirection: 'column' }]}>
        <RegularText style={[styles.detailLabel, { opacity: 0.7 }]}>
          Restaurant Rebates
        </RegularText>
        <RegularText style={[styles.detailLabel, { width: '100%', textAlign: 'center' }]}>
          Loading rebates...
        </RegularText>
      </View>
    );
  }

  if (restaurantRebates.length === 0) {
    return null;
  }

  return (
    <View style={[styles.detailRow, { 
      flexDirection: 'column', 
      borderBottomWidth: 0, 
      paddingVertical: 0,
    }]}>
      <TouchableOpacity 
        style={[
          styles.detailRow, 
          { 
            width: '100%', 
            paddingVertical: 6,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: 'rgba(0,0,0,0.05)'
          }
        ]}
        onPress={toggleExpand}
      >
        <RegularText style={[styles.detailLabel, { opacity: 0.7 }]}>
          Restaurant Rebates
        </RegularText>
        <Ionicons 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={theme.text} 
        />
      </TouchableOpacity>
  
      <Animated.View 
        style={{
          height: animatedHeight, 
          overflow: 'hidden',
          width: '100%'
        }}
      >
        {restaurantRebates.map((rebate, index) => (
          <View 
            key={index} 
            style={[
              styles.detailRow,
              { 
                paddingVertical: 8,
                borderBottomWidth: index < restaurantRebates.length - 1 
                  ? StyleSheet.hairlineWidth 
                  : 0,
                borderBottomColor: 'rgba(0,0,0,0.05)'
              }
            ]}
          >
            <RegularText style={{ opacity: 0.7 }}>{rebate.restaurantName}</RegularText>
            <RegularText style={{ color: theme.text }}>₱{rebate.rebateValue.toFixed(2)}</RegularText>
          </View>
        ))}
      </Animated.View>
    </View>
  );
};


const ContainerDetailModal = ({ container, animation, closeModal, fetchContainers  }) => {
  const { theme } = useTheme();
  const estimatedUsesLeft = container?.containerTypeId?.maxUses - (container?.usesCount || 0);
  
  if (!container) return null;
  
  const registrationDate = container.registrationDate 
    ? new Date(container.registrationDate).toLocaleDateString() 
    : 'N/A';
  
  const lastUsed = container.lastUsed 
    ? new Date(container.lastUsed).toLocaleDateString() 
    : 'N/A';
  
  const statusMessage = (() => {
    switch (container.status) {
      case 'active':
        return `${estimatedUsesLeft} uses left`;
      case 'returned':
        return 'Returned';
      case 'lost':
        return 'Lost';
      case 'damaged':
        return 'Damaged';
      default:
        return 'Unknown status'; 
    }
  })();
  
  // Add to ContainersList.js
// Add to ContainersList.js
const handleMarkStatus = async (containerId, status) => {
  // Show confirmation alert first
  Alert.alert(
    `Mark as ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    `Are you sure you want to mark this container as ${status}?`,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: async () => {
          closeModal(); // Close immediately
          try {
            await markContainerStatus(containerId, status);
            await fetchContainers();
            Alert.alert('Success', `Container marked as ${status} successfully`);
          } catch (error) {
            console.error('Error marking container status:', error);
            Alert.alert('Error', error.message || 'Failed to mark container status');
          }
        },
      },
    ]
  );
};

  const getContainerIcon = (status) => {
    switch (status) {
      case 'active':
        return { name: 'cube-outline', color: '#2e7d32' };
      case 'returned':
        return { name: 'archive-outline', color: '#0277bd' }; 
      case 'lost':
        return { name: 'help-circle-outline', color: '#ff9800' };
      case 'damaged':
        return { name: 'alert-circle-outline', color: '#d32f2f' }; 
      default:
        return { name: 'help-outline', color: '#9e9e9e' }; 
    }
  };
    
  const { name, color } = getContainerIcon(container.status);

  const getContainerBackground = (status) => {
    switch (status) {
      case 'active':
        return '#e8f5e9';
      case 'returned':
        return '#e3f2fd';
      case 'lost':
        return '#fff3e0';
      case 'damaged':
        return '#ffebee'; 
      default:
        return '#e0e0e0'; 
    }
  };
    
  const backgroundColor = getContainerBackground(container.status);

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'active':
        return '#2e7d32'; 
      case 'returned':
        return '#0277bd'; 
      case 'lost':
        return '#ff9800'; 
      case 'damaged':
        return '#d32f2f'; 
      default:
        return '#757575'; 
    }
  };
    
  const statusTextColor = getStatusTextColor(container.status);
    
  return (
    <Animated.View 
      style={[
        styles.modalContainer,
        {
          transform: [
            { translateY: -height * 0.33 },
            { scale: animation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1]
              })
            }
          ],
          opacity: animation,
          backgroundColor: theme.card,
        }
      ]}
    >
      <View style={styles.modalHeader}>
        <BoldText style={{ fontSize: 20, color: theme.text }}>
          Container Details
        </BoldText>
        <TouchableOpacity onPress={closeModal}>
          <Ionicons name="close-circle-outline" size={28} color={theme.text} />
        </TouchableOpacity>
      </View>
      
      {/* Wrap the modal body in a ScrollView */}
      <RNScrollView 
        contentContainerStyle={styles.modalBodyScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.modalBody}>
          <View style={[styles.containerIconLarge, { backgroundColor }]}>
            <Ionicons name={name} size={24} color={color} />
          </View>
          
          <BoldText style={{ fontSize: 24, marginVertical: 8, color: theme.text }}>
            {container.containerTypeId.name}
          </BoldText>
          
          <View style={styles.statusChip}>
            <RegularText style={{ color: statusTextColor, fontSize: 16 }}>
              {container.status.toUpperCase()}
            </RegularText>
          </View>
          
          <View style={styles.detailRow}>
            <RegularText style={styles.detailLabel}>Container Code:</RegularText>
            <RegularText style={{ color: theme.text, fontSize: 12 }}>{container.qrCode}</RegularText>
          </View>

          <RebateSection container={container} theme={theme} />
          
          {container.restaurantId && (
            <View style={styles.detailRow}>
              <RegularText style={styles.detailLabel}>Restaurant:</RegularText>
              <RegularText style={{ color: theme.text }}>{container.restaurantId.name}</RegularText>
            </View>
          )}
          
          {container.restaurantId && container.restaurantId.location && (
            <View style={styles.detailRow}>
              <RegularText style={styles.detailLabel}>Location:</RegularText>
              <RegularText style={{ color: theme.text }}>{container.restaurantId.location.city}</RegularText>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <RegularText style={styles.detailLabel}>Registered:</RegularText>
            <RegularText style={{ color: theme.text }}>{registrationDate}</RegularText>
          </View>
          
          <View style={styles.detailRow}>
            <RegularText style={styles.detailLabel}>Last Used:</RegularText>
            <RegularText style={{ color: theme.text }}>{lastUsed}</RegularText>
          </View>
          
          <View style={styles.detailRow}>
            <RegularText style={styles.detailLabel}>Usage Count:</RegularText>
            <RegularText style={{ color: theme.text }}>{container.usesCount}</RegularText>
          </View>
          
          {container.status === 'active' && (
            <View style={styles.detailRow}>
              <RegularText style={styles.detailLabel}>Uses Left:</RegularText>
              <RegularText style={{ color: theme.text }}>{estimatedUsesLeft}</RegularText>
            </View>
          )}
          {container.status === 'active' && (
  <View style={styles.statusButtonsContainer}>
    <TouchableOpacity 
      style={[styles.statusButton, { backgroundColor: '#ffebee' }]}
      onPress={() => handleMarkStatus(container._id, 'damaged')}
    >
      <Ionicons name="alert-circle-outline" size={20} color="#d32f2f" />
      <RegularText style={{ color: '#d32f2f', marginLeft: 8, fontSize: 10 }}>Mark as Damaged</RegularText>
    </TouchableOpacity>
    
    <TouchableOpacity 
      style={[styles.statusButton, { backgroundColor: '#fff3e0' }]}
      onPress={() => handleMarkStatus(container._id, 'lost')}
    >
      <Ionicons name="help-circle-outline" size={20} color="#ff9800" />
      <RegularText style={{ color: '#ff9800', marginLeft: 8, fontSize: 10 }}>Mark as Lost</RegularText>
    </TouchableOpacity>
  </View>
)}
        </View>
      </RNScrollView>
    </Animated.View>
  );
};

const ContainersList = ({ navigation, route }) => {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [containerStats, setContainerStats] = useState({
    activeContainers: 0,
    returnedContainers: 0,
    totalRebate: 0
  });
  const [containers, setContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [modalAnimation] = useState(new Animated.Value(0));
  const [modalVisible, setModalVisible] = useState(false);
  const [modalBackdrop] = useState(new Animated.Value(0));
  const [activeFilter, setActiveFilter] = useState(route.params?.filter || 'all');
  const [filteredContainers, setFilteredContainers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [sortBy, setSortBy] = useState('type'); // Changed from 'name' to 'type'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  // Update activeFilter when route.params.filter changes
  useEffect(() => {
    if (route.params?.filter) {
      setActiveFilter(route.params.filter);
      applyFilter(route.params.filter);
    }
  }, [route.params?.filter]);

  const fetchContainerStats = async () => {
    try {
      const token = await AsyncStorage.getItem('aqro_token');
      
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      const response = await axios.get(
        `${getApiUrl('/containers/stats')}`, 
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data) {
        setContainerStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching container stats:', error);
    }
  };

  
  const fetchContainers = async () => {
    try {
      const token = await AsyncStorage.getItem('aqro_token');
      
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      const response = await axios.get(
        `${getApiUrl('/containers')}`, 
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data) {
        setContainers(response.data);
        applyFilter(activeFilter, response.data); 
      }
    } catch (error) {
      console.error('Error fetching containers:', error);
    }
  };

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'returned', label: 'Returned' },
    { id: 'lost', label: 'Lost' },
    { id: 'damaged', label: 'Damaged' },
  ];
  
  const handleSearch = (query) => {
    if (!query.trim()) {

      applyFilter(activeFilter);
      return;
    }
    

    const filtered = activeFilter === 'all' 
      ? containers 
      : containers.filter(item => item.status === activeFilter);

    const results = filtered.filter(container => {
      const containerTypeName = container.containerTypeId.name.toLowerCase();
      const qrCode = container.qrCode.toLowerCase();
      const customerName = container.customerId 
        ? `${container.customerId.firstName} ${container.customerId.lastName}`.toLowerCase() 
        : '';

      const restaurantName = container.restaurantId 
        ? container.restaurantId.name.toLowerCase() 
        : '';
      
      const searchLower = query.toLowerCase();
      
      return containerTypeName.includes(searchLower) || 
             qrCode.includes(searchLower) || 
             customerName.includes(searchLower) ||
             restaurantName.includes(searchLower);
    });
    
    setFilteredContainers(results);
  };

  const handleSort = (criteria) => {
    if (sortBy === criteria) {
      // If clicking the same criteria, toggle order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking new criteria, set it and default to ascending
      setSortBy(criteria);
      setSortOrder('asc');
    }
    
    const sorted = [...filteredContainers].sort((a, b) => {
      let comparison = 0;
      
      switch (criteria) {
        case 'type':
          comparison = a.containerTypeId.name.localeCompare(b.containerTypeId.name);
          break;
        case 'date':
          comparison = new Date(a.registrationDate) - new Date(b.registrationDate);
          break;
        case 'usesLeft':
          const aUsesLeft = a.containerTypeId.maxUses - a.usesCount;
          const bUsesLeft = b.containerTypeId.maxUses - b.usesCount;
          comparison = aUsesLeft - bUsesLeft;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    setFilteredContainers(sorted);
  };

  const renderSortButtons = () => (
    <View style={[styles.sortContainer, { backgroundColor: theme.card }]}>
      <TouchableOpacity 
        style={[
          styles.sortButton, 
          sortBy === 'type' && { backgroundColor: theme.primary + '20' }
        ]} 
        onPress={() => handleSort('type')}
      >
        <RegularText style={{ color: sortBy === 'type' ? theme.primary : theme.text }}>
          Type {sortBy === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
        </RegularText>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[
          styles.sortButton, 
          sortBy === 'date' && { backgroundColor: theme.primary + '20' }
        ]} 
        onPress={() => handleSort('date')}
      >
        <RegularText style={{ color: sortBy === 'date' ? theme.primary : theme.text }}>
          Registration {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
        </RegularText>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[
          styles.sortButton, 
          sortBy === 'usesLeft' && { backgroundColor: theme.primary + '20' }
        ]} 
        onPress={() => handleSort('usesLeft')}
      >
        <RegularText style={{ color: sortBy === 'usesLeft' ? theme.primary : theme.text }}>
          Uses Left {sortBy === 'usesLeft' && (sortOrder === 'asc' ? '↑' : '↓')}
        </RegularText>
      </TouchableOpacity>
    </View>
  );

  const applyFilter = (filter, containerList = containers) => {
    if (searchQuery.trim()) {
      handleSearch(searchQuery);
      return;
    }
    
    let filtered = filter === 'all' 
      ? containerList 
      : containerList.filter(item => item.status === filter);
      
    // Apply current sort to filtered results
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'type':
          comparison = a.containerTypeId.name.localeCompare(b.containerTypeId.name);
          break;
        case 'date':
          comparison = new Date(a.registrationDate) - new Date(b.registrationDate);
          break;
        case 'usesLeft':
          const aUsesLeft = a.containerTypeId.maxUses - a.usesCount;
          const bUsesLeft = b.containerTypeId.maxUses - b.usesCount;
          comparison = aUsesLeft - bUsesLeft;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    setFilteredContainers(filtered);
  };
  

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    applyFilter(filter);
  };
  

  useEffect(() => {
    applyFilter(activeFilter);
  }, [containers]);
  

  useEffect(() => {
    const setNavBarColor = async () => {
      if (Platform.OS === 'android') {
        await NavigationBar.setBackgroundColorAsync(theme.background);
      }
    };
    setNavBarColor();
  }, [theme.background]);

  useEffect(() => {
    fetchContainerStats();
    fetchContainers();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchContainerStats(), fetchContainers()]);
    setRefreshing(false);
  };

  const openContainerDetail = (container) => {
    setSelectedContainer(container);
    setModalVisible(true);

    if (Platform.OS === 'android') {
      const navBarColor = isDark ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0.9)';
      NavigationBar.setBackgroundColorAsync(navBarColor);
    }

    Animated.parallel([
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(modalBackdrop, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();
  };

  const closeContainerDetail = () => {
    Animated.parallel([
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      }),
      Animated.timing(modalBackdrop, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      })
    ]).start(() => {
      setModalVisible(false);
      setSelectedContainer(null);

      if (Platform.OS === 'android') {
        NavigationBar.setBackgroundColorAsync(theme.background); 
      }
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        backgroundColor={theme.background} 
        barStyle={isDark ? "light-content" : "dark-content"} 
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <BoldText style={[styles.headerTitle, { color: theme.text }]}>My Containers</BoldText>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#00df82']}
            tintColor={isDark ? '#00df82' : '#2e7d32'}
          />
        }
      >
        {/* Container Stats */}
        <View style={styles.section}>
          <View style={styles.cardsContainer}>
            <ContainerCard 
              title="All" 
              value={containers.length}
              icon="apps-outline"
              backgroundColor="#f5f5f5"
              textColor="#757575"
              onPress={() => handleFilterChange('all')}
              isSelected={activeFilter === 'all'}
            />
            
            <ContainerCard 
              title="Active" 
              value={containerStats.activeContainers}
              icon="cube-outline"
              backgroundColor="#e8f5e9"
              textColor="#2e7d32"
              onPress={() => handleFilterChange('active')}
              isSelected={activeFilter === 'active'}
            />
            
            <ContainerCard 
              title="Returned" 
              value={containerStats.returnedContainers}
              icon="refresh-outline"
              backgroundColor="#e3f2fd"
              textColor="#0277bd"
              onPress={() => handleFilterChange('returned')}
              isSelected={activeFilter === 'returned'}
            />

            <ContainerCard 
              title="Lost" 
              value={containerStats.lostContainers || 0}
              icon="help-circle-outline"
              backgroundColor="#fff3e0"
              textColor="#ff9800"
              onPress={() => handleFilterChange('lost')}
              isSelected={activeFilter === 'lost'}
            />

            <ContainerCard 
              title="Damaged" 
              value={containerStats.damagedContainers || 0}
              icon="alert-circle-outline"
              backgroundColor="#ffebee"
              textColor="#d32f2f"
              onPress={() => handleFilterChange('damaged')}
              isSelected={activeFilter === 'damaged'}
            />
            
            <ContainerCard 
              title="Total Rebate" 
              value={`₱${containerStats.totalRebate.toFixed(2)}`}
              icon="cash-outline"
              backgroundColor="#fffde7"
              textColor="#f57f17"
              onPress={() => navigation.navigate('Activities', { filter: 'rebate' })}
            />
          </View>
        </View>
        
        {/* Containers List */}
        <View style={styles.section}>
          <SemiBoldText style={[styles.sectionTitle, { color: theme.text }]}>
            {searchQuery.trim() 
              ? `${filteredContainers.length} Search Results Found` 
              : activeFilter === 'all'
                ? `${filteredContainers.length} Containers Found`
                : `${filteredContainers.length} ${filterOptions.find(option => option.id === activeFilter)?.label} Containers Found`}
          </SemiBoldText>

          {/* <FilterTabs 
            options={filterOptions}
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            theme={theme}
          /> */}

          <SearchComponent 
            onSearch={handleSearch}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            theme={theme}
            placeholder="Search by type, QR code, or restaurant..."
          />
          
          {renderSortButtons()}
          
          {filteredContainers.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: isDark ? '#333' : '#f5f5f5' }]}>
              <Ionicons name="cube-outline" size={48} color={theme.text} style={{ opacity: 0.4 }} />
              <RegularText style={{ color: theme.text, textAlign: 'center', marginTop: 12 }}>
                {containers.length === 0 
                  ? "You don't have any containers yet." 
                  : "No containers match the selected filter."}
              </RegularText>
              <TouchableOpacity 
                style={styles.scanButton}
                onPress={() => navigation.navigate('Scanner')}
              >
                <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" style={styles.scanIcon} />
                <BoldText style={styles.scanButtonText}>Scan a Container</BoldText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.containersList}>
              {filteredContainers.map((container) => (
                <ContainerItem 
                  key={container._id} 
                  container={container} 
                  onPress={openContainerDetail}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Scan Button */}
      {containers.length > 0 && (
        <TouchableOpacity 
          style={styles.fabButton}
          onPress={() => navigation.navigate('Scanner')}
        >
          <Ionicons name="qr-code-outline" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
      
      {/* Modal Backdrop */}
      {modalVisible && (
        <TouchableOpacity 
          style={[styles.modalBackdrop, { opacity: modalBackdrop }]}
          activeOpacity={0.95}
          onPress={closeContainerDetail}
        />
      )}
      
      {/* Container Detail Modal */}
      {modalVisible && (
        <ContainerDetailModal 
  container={selectedContainer} 
  animation={modalAnimation} 
  closeModal={closeContainerDetail}
  fetchContainers={fetchContainers}
/>
      )}
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
  },
  headerTitle: {
    fontSize: 20,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  card: {
    width: width / 3 - 14,
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: '#00df82',
    borderWidth: 2,
  },
  cardContent: {
    alignItems: 'center',
  },
  cardIcon: {
    marginBottom: 8,
  },
  cardTextContainer: {
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  cardValue: {
    fontSize: 18,
    textAlign: 'center',
  },
  containersList: {
    marginTop: 8,
  },
  containerItem: {
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  containerItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  containerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  containerInfo: {
    flexShrink: 1,
  },
  containerItemRight: {
    paddingLeft: 8,
  },
  emptyState: {
    marginTop: 12,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00df82',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  scanIcon: {
    marginRight: 8,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00df82',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.90)', 
    opacity: 0.95,
    zIndex: 10,
  },
  modalContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: width * 0.85,
    marginLeft: -(width * 0.85) / 2,
    transform: [
      { translateY: -height * 0.3 }, 
    ],
    maxHeight: height * 0.75, 
    borderRadius: 16,
    zIndex: 11,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalBodyScrollContent: {
    flexGrow: 1,
  },
  modalBody: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 40, 
  },
  containerIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  statusChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(112, 111, 111, 0.05)',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 6, 
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: {
    opacity: 0.7,
    fontSize: 14,
  },
   rebateSectionContainer: {
    width: '100%',
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  rebateSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  rebateContentContainer: {
    paddingHorizontal: 20,
  },
  rebateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
statusButtonsContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  width: '100%',
  marginTop: 16,
},
statusButton: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 12,
  borderRadius: 8,
  width: '48%',
  justifyContent: 'center',
},
sortContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  padding: 8,
  borderRadius: 8,
  marginTop: 8,
  marginBottom: 12,
},
sortButton: {
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 6,
  flexDirection: 'row',
  alignItems: 'center',
},
});

export default ContainersList;