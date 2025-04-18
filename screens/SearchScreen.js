import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Alert, FlatList, TouchableOpacity } from 'react-native';
import { ActivityIndicator, Text, Searchbar, FAB } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { hoardings as hoardingsApi } from '../services/api';
import Map from '../components/Map';

const SearchScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [initialRegion, setInitialRegion] = useState(null);
  const [currentHoardings, setCurrentHoardings] = useState([]);
  const [filteredHoardings, setFilteredHoardings] = useState([]);
  const [selectedHoarding, setSelectedHoarding] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [placeResults, setPlaceResults] = useState([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const bottomSheetRef = useRef(null);
  const snapPoints = useCallback(['25%', '50%'], []);
  const searchTimeout = useRef(null);

  const fetchHoardings = async () => {
    try {
      console.log('Fetching all hoardings from API...');
      const response = await hoardingsApi.getAll();
      console.log('API Response:', response);
      if (Array.isArray(response)) {
        console.log('Setting hoardings:', response.length);
        setCurrentHoardings(response);
        setFilteredHoardings(response);
        return response;
      } else {
        console.error('Invalid response format:', response);
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error('Error fetching hoardings:', error);
      throw error;
    }
  };

  useFocusEffect(
    useCallback(() => {
      const setupSearchScreen = async () => {
        try {
          setLoading(true);
          setErrorMsg(null);

          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            console.log('Location permission denied');
            setInitialRegion({
              latitude: 20.5937,
              longitude: 78.9629,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            });
          } else {
            const location = await Location.getCurrentPositionAsync({});
            console.log('Current location:', location);
            setInitialRegion({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            });
          }

          await fetchHoardings();
        } catch (error) {
          console.error('Error setting up SearchScreen:', error);
          setErrorMsg('Failed to load data. Please try again.');
        } finally {
          setLoading(false);
        }
      };

      setupSearchScreen();
    }, [])
  );

  const searchPlaces = async (query) => {
    if (!query.trim()) {
      setPlaceResults([]);
      return;
    }

    try {
      setIsSearchingPlace(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&countrycodes=in&limit=5`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'HoardingApp/1.0',
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch places');

      const data = await response.json();
      setPlaceResults(data);
    } catch (error) {
      console.error('Error searching places:', error);
      Alert.alert('Error', 'Failed to search places. Please try again.');
    } finally {
      setIsSearchingPlace(false);
    }
  };

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      searchPlaces(searchQuery);
    }, 500);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredHoardings(currentHoardings);
      setPlaceResults([]);
      return;
    }

    const searchLower = query.toLowerCase();
    const filtered = currentHoardings.filter(hoarding => 
      hoarding.title?.toLowerCase().includes(searchLower) ||
      hoarding.description?.toLowerCase().includes(searchLower) ||
      hoarding.address?.toLowerCase().includes(searchLower) ||
      hoarding.size?.toLowerCase().includes(searchLower)
    );

    console.log('Filtered hoardings:', filtered.length);
    setFilteredHoardings(filtered);
  };

  const handlePlaceSelect = (place) => {
    // Calculate zoom level based on the place type and importance
    let zoomLevel;
    if (place.type === 'city' || place.type === 'administrative') {
      zoomLevel = 0.05; // City level zoom - slightly zoomed out
    } else if (place.type === 'suburb' || place.type === 'neighbourhood') {
      zoomLevel = 0.02; // Suburb level zoom - moderately zoomed
    } else if (place.type === 'building' || place.type === 'amenity') {
      zoomLevel = 0.008; // Building level zoom - closer but not too close
    } else {
      zoomLevel = 0.02; // Default zoom level - moderate zoom
    }

    // Set region based on the selected place
    const newRegion = {
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
      latitudeDelta: zoomLevel,
      longitudeDelta: zoomLevel,
    };

    // If place has a bounding box, use it to calculate the zoom level
    if (place.boundingbox) {
      const [southLat, northLat, westLng, eastLng] = place.boundingbox.map(parseFloat);
      const latDelta = Math.abs(northLat - southLat);
      const lngDelta = Math.abs(eastLng - westLng);
      
      // Use bounding box for zoom if it's smaller than our default zoom
      if (latDelta < zoomLevel && lngDelta < zoomLevel) {
        newRegion.latitudeDelta = Math.max(latDelta * 1.5, 0.008); // More padding, minimum zoom level increased
        newRegion.longitudeDelta = Math.max(lngDelta * 1.5, 0.008); // More padding, minimum zoom level increased
      }
    }

    console.log('Moving to new region:', newRegion);
    
    // Force a re-render of the map with new region
    setInitialRegion(null);
    setTimeout(() => {
      setInitialRegion(newRegion);
    }, 10);

    setPlaceResults([]);
    setSearchQuery(place.display_name.split(',')[0]);
    
    // Check for hoardings in the visible region
    const nearbyHoardings = currentHoardings.filter(hoarding => {
      if (!hoarding.location?.coordinates) return false;
      
      const [longitude, latitude] = hoarding.location.coordinates;
      const latDelta = newRegion.latitudeDelta;
      const lngDelta = newRegion.longitudeDelta;
      
      return (
        latitude >= (newRegion.latitude - latDelta) &&
        latitude <= (newRegion.latitude + latDelta) &&
        longitude >= (newRegion.longitude - lngDelta) &&
        longitude <= (newRegion.longitude + lngDelta)
      );
    });

    // Update filtered hoardings - if none found in the area, that's okay
    setFilteredHoardings(nearbyHoardings);
    console.log(`Found ${nearbyHoardings.length} hoardings in the selected area`);
  };

  const handleRegionChange = (region) => {
    console.log('Region changed:', region);
  };

  const handleMarkerPress = (hoarding) => {
    console.log('Marker pressed:', hoarding);
    setSelectedHoarding(hoarding);
    bottomSheetRef.current?.expand();
  };

  const handleAddPress = () => {
    navigation.navigate('Add Hoarding');
  };

  const renderPlaceItem = ({ item }) => (
    <TouchableOpacity
      style={styles.placeItem}
      onPress={() => handlePlaceSelect(item)}
    >
      <Text style={styles.placeText}>{item.display_name}</Text>
    </TouchableOpacity>
  );

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

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search places or hoardings..."
            onChangeText={handleSearch}
            value={searchQuery}
            style={styles.searchBar}
            loading={isSearchingPlace}
          />
          {placeResults.length > 0 && (
            <FlatList
              data={placeResults}
              renderItem={renderPlaceItem}
              keyExtractor={(item) => item.place_id}
              style={styles.placesList}
            />
          )}
        </View>
        
        {initialRegion && (
          <Map 
            initialRegion={initialRegion}
            onRegionChange={handleRegionChange}
            hoardings={filteredHoardings}
            onMarkerPress={handleMarkerPress}
          />
        )}

        <FAB
          style={styles.fab}
          icon="plus"
          onPress={handleAddPress}
        />

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
              <Text style={styles.title}>{selectedHoarding.title}</Text>
              <Text style={styles.description}>{selectedHoarding.description}</Text>
              <Text style={styles.details}>Size: {selectedHoarding.size}</Text>
              <Text style={styles.details}>Price: ₹{selectedHoarding.price}</Text>
              <Text style={styles.details}>
                Status: {selectedHoarding.availability ? 'Available' : 'Not Available'}
              </Text>
              <Text style={styles.address}>{selectedHoarding.address}</Text>
            </View>
          )}
        </BottomSheet>
      </View>
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
  searchContainer: {
    zIndex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  searchBar: {
    margin: 16,
    elevation: 4,
    borderRadius: 8,
  },
  placesList: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    maxHeight: 200,
    borderRadius: 8,
    elevation: 4,
  },
  placeItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  placeText: {
    fontSize: 14,
    color: '#333',
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    marginBottom: 12,
    color: '#666',
  },
  details: {
    fontSize: 14,
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#f4511e',
  },
});

export default SearchScreen; 