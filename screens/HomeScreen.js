import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { ActivityIndicator, Text, Card, Title, Paragraph, FAB } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { hoardings as hoardingsApi } from '../services/api';
import Map from '../components/Map';

const HomeScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [initialRegion, setInitialRegion] = useState(null);
  const [currentHoardings, setCurrentHoardings] = useState([]);
  const [selectedHoarding, setSelectedHoarding] = useState(null);
  const bottomSheetRef = useRef(null);
  const snapPoints = useCallback(['25%', '50%'], []);

  const fetchHoardings = async () => {
    try {
      console.log('Fetching all hoardings from API...');
      const response = await hoardingsApi.getAll();
      
      if (!Array.isArray(response)) {
        console.error('Invalid API response format:', response);
        throw new Error('Invalid response format from API');
      }

      // Validate and format hoarding data
      const validHoardings = response.filter(hoarding => {
        // Check basic hoarding structure
        if (!hoarding?._id || !hoarding?.location?.coordinates) {
          console.debug('Invalid hoarding structure:', hoarding);
          return false;
        }

        // Ensure coordinates array has exactly 2 elements
        if (!Array.isArray(hoarding.location.coordinates) || 
            hoarding.location.coordinates.length !== 2) {
          console.debug('Invalid coordinates array:', hoarding._id);
          return false;
        }

        // Extract and validate coordinates
        const [longitude, latitude] = hoarding.location.coordinates.map(Number);
        
        if (typeof latitude !== 'number' || 
            typeof longitude !== 'number' ||
            isNaN(latitude) || 
            isNaN(longitude) ||
            latitude < -90 || 
            latitude > 90 ||
            longitude < -180 || 
            longitude > 180) {
          console.debug('Invalid coordinate values:', {
            id: hoarding._id,
            latitude,
            longitude
          });
          return false;
        }

        return true;
      });

      console.debug(`Found ${validHoardings.length} valid hoardings out of ${response.length} total`);
      setCurrentHoardings(validHoardings);
      return validHoardings;
    } catch (error) {
      console.error('Error fetching hoardings:', error);
      throw error;
    }
  };

  useFocusEffect(
    useCallback(() => {
      const setupHomeScreen = async () => {
        try {
          setLoading(true);
          setErrorMsg(null);

          // Get location permission and current position
          let { status } = await Location.requestForegroundPermissionsAsync();
          
          const defaultRegion = {
            latitude: 20.5937,  // Center of India
            longitude: 78.9629,
            latitudeDelta: 20,
            longitudeDelta: 20,
          };

          if (status !== 'granted') {
            console.log('Location permission denied, using default region');
            setInitialRegion(defaultRegion);
          } else {
            try {
              const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced
              });
              
              if (location?.coords) {
                setInitialRegion({
                  latitude: Number(location.coords.latitude),
                  longitude: Number(location.coords.longitude),
                  latitudeDelta: 0.0922,
                  longitudeDelta: 0.0421,
                });
              } else {
                console.warn('Invalid location data, using default region');
                setInitialRegion(defaultRegion);
              }
            } catch (locationError) {
              console.error('Error getting location:', locationError);
              setInitialRegion(defaultRegion);
            }
          }

          // Fetch all hoardings
          await fetchHoardings();
        } catch (error) {
          console.error('Error setting up HomeScreen:', error);
          setErrorMsg('Failed to load data. Please try again.');
        } finally {
          setLoading(false);
        }
      };

      setupHomeScreen();
    }, [])
  );

  const handleRegionChange = useCallback((region) => {
    if (!region || typeof region.latitude !== 'number' || typeof region.longitude !== 'number') {
      console.warn('Invalid region:', region);
      return;
    }
    console.log('Region changed:', region);
  }, []);

  const handleMarkerPress = (hoarding) => {
    console.log('Marker pressed:', hoarding);
    setSelectedHoarding(hoarding);
    bottomSheetRef.current?.expand();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.centered}>
        <Text>{errorMsg}</Text>
      </View>
    );
  }

  console.log('Rendering HomeScreen with:', {
    initialRegion,
    hoardingsCount: currentHoardings.length
  });

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {initialRegion && (
          <Map 
            initialRegion={initialRegion}
            onRegionChange={handleRegionChange}
            hoardings={currentHoardings}
            onMarkerPress={handleMarkerPress}
          />
        )}

        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          enableOverDrag={false}
          style={styles.bottomSheet}
        >
          {selectedHoarding && (
            <View style={styles.bottomSheetContent}>
              <Card>
                <Card.Content>
                  <Title>{selectedHoarding.title}</Title>
                  <Paragraph>{selectedHoarding.description}</Paragraph>
                  <Text>Size: {selectedHoarding.size}</Text>
                  <Text>Price: ₹{selectedHoarding.price}</Text>
                  <Text>Status: {selectedHoarding.availability ? 'Available' : 'Not Available'}</Text>
                </Card.Content>
              </Card>
            </View>
          )}
        </BottomSheet>
      </View>
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate('AddHoarding')}
      />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetContent: {
    flex: 1,
    padding: 16,
  },
  bottomSheet: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default HomeScreen; 