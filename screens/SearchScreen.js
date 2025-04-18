import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import WebView from 'react-native-webview';
import HoardingBottomSheet from '../components/HoardingBottomSheet';

// Function to generate dummy hoardings around a location
const generateNearbyHoardings = (latitude, longitude) => {
  return [
    {
      id: `h_${Date.now()}_1`,
      title: 'Premium Billboard',
      description: 'High visibility location near search area',
      latitude: latitude + 0.002,
      longitude: longitude + 0.002,
      size: '30x40 ft',
      price: '$2500/month'
    },
    {
      id: `h_${Date.now()}_2`,
      title: 'Digital Display Board',
      description: 'Modern LED display in prime area',
      latitude: latitude - 0.001,
      longitude: longitude + 0.001,
      size: '20x30 ft',
      price: '$1800/month'
    },
    {
      id: `h_${Date.now()}_3`,
      title: 'Street Side Hoarding',
      description: 'Perfect for local business advertising',
      latitude: latitude + 0.001,
      longitude: longitude - 0.001,
      size: '15x25 ft',
      price: '$1200/month'
    }
  ];
};

export default function SearchScreen() {
  const [region, setRegion] = useState({
    latitude: 19.0760,
    longitude: 72.8777,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hoardings, setHoardings] = useState([]);
  const [selectedHoarding, setSelectedHoarding] = useState(null);
  const bottomSheetRef = useRef(null);
  const webViewRef = useRef(null);
  const searchTimeout = useRef(null);

  // Debounced search function
  const handleSearch = useCallback(async (text) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          text
        )}&format=json&countrycodes=in&limit=5`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'HoardingApp/1.0', // Required by Nominatim's usage policy
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format');
      }

      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Search error:', error.message);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle search input changes with debounce
  useEffect(() => {
    if (searchText.length >= 3) {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
      searchTimeout.current = setTimeout(() => {
        handleSearch(searchText);
      }, 1000); // Increased debounce time to avoid rate limiting
    } else {
      setSearchResults([]);
    }
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchText, handleSearch]);

  const handleLocationSelect = useCallback((location) => {
    const newRegion = {
      latitude: parseFloat(location.lat),
      longitude: parseFloat(location.lon),
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    
    setRegion(newRegion);
    
    // Update map view using WebView
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        map.setView([${newRegion.latitude}, ${newRegion.longitude}], 15);
        true;
      `);
    }
    
    // Generate and set nearby hoardings
    const nearbyHoardings = generateNearbyHoardings(newRegion.latitude, newRegion.longitude);
    setHoardings(nearbyHoardings);
    
    // Update markers
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        updateMarkers(${JSON.stringify(nearbyHoardings)});
        true;
      `);
    }
    
    // Clear search results
    setSearchResults([]);
    setSearchText(location.display_name.split(',')[0]);
  }, []);

  const handleMarkerPress = useCallback((hoarding) => {
    setSelectedHoarding(hoarding);
    bottomSheetRef.current?.expand();
  }, []);

  const renderSearchResult = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.searchResult}
      onPress={() => handleLocationSelect(item)}
    >
      <Text style={styles.searchResultText}>{item.display_name}</Text>
    </TouchableOpacity>
  ), [handleLocationSelect]);

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
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            let map;
            let markers = [];

            function initMap() {
              const defaultLocation = [${region.latitude}, ${region.longitude}];
              map = L.map('map').setView(defaultLocation, 15);
              
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
              }).addTo(map);

              // Add initial markers if any
              updateMarkers(${JSON.stringify(hoardings)});
            }

            function updateMarkers(hoardings) {
              // Clear existing markers
              markers.forEach(marker => map.removeLayer(marker));
              markers = [];

              // Add new markers
              hoardings.forEach(hoarding => {
                const marker = L.marker(
                  [hoarding.latitude, hoarding.longitude],
                  { title: hoarding.title }
                );

                marker.on('click', () => {
                  window.ReactNativeWebView.postMessage(JSON.stringify(hoarding));
                });

                marker.addTo(map);
                markers.push(marker);
              });
            }

            initMap();
          </script>
        </body>
      </html>
    `;
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a location"
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#666"
          />
          {isLoading && (
            <ActivityIndicator 
              style={styles.loadingIndicator} 
              color="#f4511e" 
            />
          )}
          {searchResults.length > 0 && (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.place_id}
              style={styles.searchList}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: getMapHTML() }}
          onMessage={(event) => {
            const hoarding = JSON.parse(event.nativeEvent.data);
            handleMarkerPress(hoarding);
          }}
        />
        <HoardingBottomSheet
          ref={bottomSheetRef}
          hoarding={selectedHoarding}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    position: 'absolute',
    width: '100%',
    zIndex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingTop: Platform.OS === 'ios' ? 10 : 30,
  },
  searchInput: {
    height: 50,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchList: {
    backgroundColor: '#fff',
    marginHorizontal: 0,
    marginTop: 5,
    borderRadius: 8,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchResult: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchResultText: {
    fontSize: 15,
    color: '#333',
  },
  loadingIndicator: {
    position: 'absolute',
    right: 25,
    top: 42,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
}); 