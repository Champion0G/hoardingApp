import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  FlatList,
} from 'react-native';
import { Button, Searchbar } from 'react-native-paper';
import WebView from 'react-native-webview';
import * as Location from 'expo-location';
import { hoardings } from '../services/api';
import { useNavigation } from '@react-navigation/native';

const AddHoardingScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const webViewRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    size: '',
    price: '',
  });
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef(null);

  const [debouncedAddressLookup] = useState(() => {
    let timeoutId;
    return (location) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        fetchLocationAddress(location);
      }, 1000); // 1 second delay
    };
  });

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Permission to access location was denied');
          setLoading(false);
          return;
        }

        // Don't wait for location to load the page
        setLoading(false);

        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        setLocation(location);
        // Set initial location in GeoJSON format
        const initialLocation = {
          type: 'Point',
          coordinates: [
            Number(location.coords.longitude),
            Number(location.coords.latitude)
          ]
        };
        setSelectedLocation(initialLocation);
        debouncedAddressLookup({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
      } catch (error) {
        console.error('Error getting location:', error);
        setError('Error getting location');
        setLoading(false);
      }
    })();

    // Cleanup function
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  const fetchLocationAddress = async (location) => {
    if (!location || addressLoading) return;

    try {
      setAddressLoading(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${location.latitude}&lon=${location.longitude}&format=json`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'HoardingApp/1.0',
          },
          timeout: 5000 // 5 second timeout
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch address');
      }

      const data = await response.json();
      setLocationAddress(data.display_name);
    } catch (error) {
      console.error('Error fetching address:', error);
      setLocationAddress('Address not found');
    } finally {
      setAddressLoading(false);
    }
  };

  const getMapHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Map</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <style>
            #map { height: 100vh; width: 100vw; }
            body { margin: 0; padding: 0; }
            .current-location-btn {
              position: absolute;
              bottom: 80px;
              right: 20px;
              z-index: 1000;
              background: white;
              border: none;
              border-radius: 50%;
              width: 44px;
              height: 44px;
              cursor: pointer;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 20px;
            }
            .current-location-btn:hover {
              background: #f0f0f0;
            }
            .current-location-btn:active {
              background: #e0e0e0;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <button id="currentLocationBtn" class="current-location-btn" title="Go to current location">📍</button>
          <script>
            let map;
            let marker;

            function sendLocationUpdate(lat, lng) {
              // Validate coordinates before sending
              if (typeof lat !== 'number' || typeof lng !== 'number' ||
                  isNaN(lat) || isNaN(lng) ||
                  lng < -180 || lng > 180 ||
                  lat < -90 || lat > 90) {
                console.error('Invalid coordinates:', { lat, lng });
                return;
              }

              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'marker_update',
                latitude: lat,
                longitude: lng
              }));
            }

            function initMap() {
              const defaultLocation = [${location?.coords.latitude || 0}, ${location?.coords.longitude || 0}];
              map = L.map('map').setView(defaultLocation, 15);
              
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
              }).addTo(map);

              // Add draggable marker
              marker = L.marker(defaultLocation, {
                draggable: true,
                title: 'Drag to set location'
              }).addTo(map);

              // Handle marker drag end
              marker.on('dragend', function(event) {
                const position = marker.getLatLng();
                sendLocationUpdate(position.lat, position.lng);
              });

              // Handle map click
              map.on('click', function(event) {
                const position = event.latlng;
                marker.setLatLng(position);
                sendLocationUpdate(position.lat, position.lng);
              });

              // Add current location button handler
              document.getElementById('currentLocationBtn').addEventListener('click', function() {
                this.style.opacity = '0.5';
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'get_current_location'
                }));
              });
            }

            window.updateLocation = function(lat, lng) {
              if (map && marker) {
                // Validate coordinates before updating
                if (typeof lat === 'number' && typeof lng === 'number' &&
                    !isNaN(lat) && !isNaN(lng) &&
                    lng >= -180 && lng <= 180 &&
                    lat >= -90 && lat <= 90) {
                  const newLocation = [lat, lng];
                  map.setView(newLocation, 15);
                  marker.setLatLng(newLocation);
                } else {
                  console.error('Invalid coordinates in updateLocation:', { lat, lng });
                }
                document.getElementById('currentLocationBtn').style.opacity = '1';
              }
            };

            initMap();
          </script>
        </body>
      </html>
    `;
  };

  const handleLocationSelect = async (data) => {
    try {
      if (data.type === 'get_current_location') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required to add hoardings');
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });

        // Store location in GeoJSON format
        const newLocation = {
          type: 'Point',
          coordinates: [
            Number(currentLocation.coords.longitude),
            Number(currentLocation.coords.latitude)
          ]
        };

        // Validate coordinates
        if (newLocation.coordinates.some(coord => isNaN(coord))) {
          throw new Error('Invalid coordinates received from location service');
        }

        // Validate coordinate ranges
        const [longitude, latitude] = newLocation.coordinates;
        if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
          throw new Error('Coordinates out of range');
        }

        console.log('Setting location:', JSON.stringify(newLocation));
        setSelectedLocation(newLocation);
        debouncedAddressLookup({
          latitude: latitude,
          longitude: longitude
        });

        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            window.updateLocation(${latitude}, ${longitude});
            true;
          `);
        }
      } else if (data.type === 'marker_update') {
        // Store location in GeoJSON format
        const newLocation = {
          type: 'Point',
          coordinates: [
            Number(data.longitude),
            Number(data.latitude)
          ]
        };

        // Validate coordinates
        if (newLocation.coordinates.some(coord => isNaN(coord))) {
          throw new Error('Invalid coordinates received from map');
        }

        // Validate coordinate ranges
        const [longitude, latitude] = newLocation.coordinates;
        if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
          throw new Error('Coordinates out of range');
        }

        console.log('Setting location from map:', JSON.stringify(newLocation));
        setSelectedLocation(newLocation);
        debouncedAddressLookup({
          latitude: latitude,
          longitude: longitude
        });
      }
    } catch (error) {
      console.error('Error handling location:', error);
      Alert.alert('Error', 'Failed to get valid location coordinates. Please try again.');
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          document.getElementById('currentLocationBtn').style.opacity = '1';
          true;
        `);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      // Validate required fields
      if (!formData.title || !formData.description || !formData.size || !formData.price || !selectedLocation) {
        Alert.alert('Error', 'Please fill in all fields and select a location');
        return;
      }

      // Log the selected location for debugging
      console.log('Selected location:', JSON.stringify(selectedLocation, null, 2));

      // Validate location format
      if (!selectedLocation || !selectedLocation.type || !selectedLocation.coordinates ||
          !Array.isArray(selectedLocation.coordinates) || selectedLocation.coordinates.length !== 2) {
        Alert.alert('Error', 'Invalid location format. Please select a location again.');
        return;
      }

      // Validate coordinates are numbers
      const [longitude, latitude] = selectedLocation.coordinates;
      if (typeof longitude !== 'number' || typeof latitude !== 'number' || 
          isNaN(longitude) || isNaN(latitude)) {
        Alert.alert('Error', 'Invalid coordinates. Please select a location again.');
        return;
      }

      // Validate coordinate ranges
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        Alert.alert('Error', 'Coordinates out of range. Please select a valid location.');
        return;
      }

      // Validate price is a number
      const price = Number(formData.price);
      if (isNaN(price) || price <= 0) {
        Alert.alert('Error', 'Please enter a valid price');
        return;
      }

      // Create the hoarding data object
      const hoardingData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        size: formData.size.trim(),
        price: price,
        location: {
          type: 'Point',
          coordinates: [longitude, latitude]  // GeoJSON format: [longitude, latitude]
        },
        address: locationAddress ? locationAddress.trim() : 'Address not available',
        availability: true
      };

      // Log the final data being sent
      console.log('Final hoarding data to send:', JSON.stringify(hoardingData, null, 2));

      // Send the request
      const response = await hoardings.add(hoardingData);
      console.log('Server response:', response);

      Alert.alert(
        'Success',
        'Hoarding added successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error adding hoarding:', error);
      Alert.alert(
        'Error',
        typeof error === 'string' ? error : 'Failed to add hoarding. Please try again.'
      );
    }
  };

  const handleSearch = useCallback(async (text) => {
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          text
        )}&format=json&countrycodes=in&limit=5`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'HoardingApp/1.0',
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Search request timed out');
      } else {
        console.error('Search error:', error);
      }
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery, handleSearch]);

  const handleSearchResultSelect = (result) => {
    try {
      // Validate and format coordinates from search result
      const latitude = Number(result.lat);
      const longitude = Number(result.lon);

      // Validate coordinates are numbers
      if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Invalid coordinates: not numbers');
      }

      // Validate coordinate ranges
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        throw new Error('Invalid coordinates: out of range');
      }

      // Create location in GeoJSON format
      const newLocation = {
        type: 'Point',
        coordinates: [longitude, latitude] // GeoJSON format: [longitude, latitude]
      };

      console.log('Setting location from search:', JSON.stringify(newLocation, null, 2));
      
      setSelectedLocation(newLocation);
      setLocationAddress(result.display_name);
      setSearchQuery('');
      setSearchResults([]);

      // Update map view
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          map.setView([${latitude}, ${longitude}], 15);
          marker.setLatLng([${latitude}, ${longitude}]);
          true;
        `);
      }
    } catch (error) {
      console.error('Error handling search result:', error);
      Alert.alert('Error', 'Invalid location coordinates from search result. Please try another location.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search for a location"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          loading={isSearching}
        />
      </View>

      {searchResults.length > 0 && (
        <View style={styles.searchResultsContainer}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.place_id}
            style={styles.searchResults}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultItem}
                onPress={() => handleSearchResultSelect(item)}
              >
                <Text style={styles.searchResultText}>{item.display_name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <ScrollView style={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.mapContainer}>
          {location && (
            <WebView
              ref={webViewRef}
              style={styles.map}
              source={{ html: getMapHTML() }}
              onMessage={(event) => {
                const data = JSON.parse(event.nativeEvent.data);
                handleLocationSelect(data);
              }}
            />
          )}
        </View>

        {addressLoading ? (
          <View style={styles.addressContainer}>
            <ActivityIndicator size="small" color="#666" />
          </View>
        ) : locationAddress ? (
          <View style={styles.addressContainer}>
            <Text style={styles.addressText}>Selected Location:</Text>
            <Text style={styles.addressValue}>{locationAddress}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Title"
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Description"
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            multiline
          />
          <TextInput
            style={styles.input}
            placeholder="Size (e.g., 30x40 ft)"
            value={formData.size}
            onChangeText={(text) => setFormData({ ...formData, size: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Price"
            value={formData.price}
            onChangeText={(text) => setFormData({ ...formData, price: text })}
            keyboardType="numeric"
          />
          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.button}
            disabled={!selectedLocation}
          >
            Add Hoarding
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  searchContainer: {
    padding: 16,
    zIndex: 2,
    backgroundColor: 'white',
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    zIndex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  searchBar: {
    elevation: 4,
    borderRadius: 8,
  },
  searchResults: {
    backgroundColor: 'white',
    borderRadius: 8,
    maxHeight: 200,
    elevation: 4,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchResultText: {
    fontSize: 14,
    color: '#333',
  },
  mapContainer: {
    height: Dimensions.get('window').height * 0.3,
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  addressContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  addressValue: {
    fontSize: 16,
    color: '#333',
  },
  form: {
    padding: 16,
  },
  input: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  button: {
    marginTop: 16,
  },
  error: {
    color: 'red',
    marginBottom: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AddHoardingScreen; 