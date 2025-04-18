import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Alert } from 'react-native';
import WebView from 'react-native-webview';
import * as Location from 'expo-location';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import { ActivityIndicator, Text, Card, Title, Paragraph } from 'react-native-paper';
import { hoardings } from '../services/api';

const HomeScreen = () => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [nearbyHoardings, setNearbyHoardings] = useState([]);
  const [selectedHoarding, setSelectedHoarding] = useState(null);
  const [loading, setLoading] = useState(true);
  const bottomSheetRef = useRef(null);
  const snapPoints = useCallback(['25%', '50%'], []);
  const webViewRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        setLocation(location);
        fetchNearbyHoardings(location.coords.latitude, location.coords.longitude);
      } catch (error) {
        console.error('Error getting location:', error);
        setErrorMsg('Error getting location');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchNearbyHoardings = async (latitude, longitude) => {
    try {
      const data = await hoardings.getNearby(latitude, longitude);
      setNearbyHoardings(data);
      if (webViewRef.current) {
        const formattedHoardings = data.map(hoarding => ({
          ...hoarding,
          latitude: hoarding.location.coordinates[1],
          longitude: hoarding.location.coordinates[0],
        }));
        webViewRef.current.injectJavaScript(`
          updateMarkers(${JSON.stringify(formattedHoardings)});
          true;
        `);
      }
    } catch (error) {
      console.error('Error fetching nearby hoardings:', error);
      setErrorMsg('Error fetching nearby hoardings');
    }
  };

  const handleMarkerPress = (hoarding) => {
    setSelectedHoarding(hoarding);
    bottomSheetRef.current?.expand();
  };

  const handleLocationUpdate = async (data) => {
    try {
      if (data.type === 'get_current_location') {
        // Get current location using React Native's Location API
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required to view nearby hoardings');
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });

        // Update the location state
        setLocation(currentLocation);

        // Update the map view
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            window.updateLocation(${currentLocation.coords.latitude}, ${currentLocation.coords.longitude});
            true;
          `);
        }

        // Fetch nearby hoardings
        await fetchNearbyHoardings(currentLocation.coords.latitude, currentLocation.coords.longitude);
      }
    } catch (error) {
      console.error('Error updating location:', error);
      setErrorMsg('Error updating location');
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          document.getElementById('currentLocationBtn').style.opacity = '1';
          true;
        `);
      }
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
            let markers = [];
            let userMarker;

            function initMap() {
              const defaultLocation = [${location?.coords.latitude || 0}, ${location?.coords.longitude || 0}];
              map = L.map('map').setView(defaultLocation, 15);
              
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
              }).addTo(map);

              // Add user marker
              userMarker = L.marker(defaultLocation, {
                title: 'You are here',
                icon: L.icon({
                  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                  iconSize: [25, 41],
                  iconAnchor: [12, 41],
                  popupAnchor: [1, -34],
                })
              }).addTo(map);

              // Add current location button handler
              document.getElementById('currentLocationBtn').addEventListener('click', function() {
                this.style.opacity = '0.5';
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'get_current_location'
                }));
              });
            }

            window.updateLocation = function(lat, lng) {
              if (map && userMarker) {
                const newLocation = [lat, lng];
                map.setView(newLocation, 15);
                userMarker.setLatLng(newLocation);
                document.getElementById('currentLocationBtn').style.opacity = '1';
              }
            };

            function updateMarkers(hoardings) {
              // Clear existing markers
              markers.forEach(marker => map.removeLayer(marker));
              markers = [];

              // Add new markers
              hoardings.forEach(hoarding => {
                const marker = L.marker(
                  [hoarding.latitude, hoarding.longitude],
                  { 
                    title: hoarding.title,
                    icon: L.icon({
                      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                    })
                  }
                );

                marker.bindPopup(
                  '<b>' + hoarding.title + '</b><br>' +
                  hoarding.description + '<br>' +
                  'Size: ' + hoarding.size + '<br>' +
                  'Price: ₹' + hoarding.price
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
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
        {location && (
          <WebView
            ref={webViewRef}
            style={styles.map}
            source={{ html: getMapHTML() }}
            onMessage={(event) => {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'get_current_location') {
                handleLocationUpdate(data);
              } else {
                handleMarkerPress(data);
              }
            }}
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
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
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
});

export default HomeScreen; 