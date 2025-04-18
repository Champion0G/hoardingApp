import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import { useRoute, useIsFocused } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const DEFAULT_REGION = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 20,
  longitudeDelta: 20,
};

const isValidCoordinate = (latitude, longitude) => {
  return typeof latitude === 'number' && 
         typeof longitude === 'number' && 
         !isNaN(latitude) && 
         !isNaN(longitude) &&
         latitude >= -90 && 
         latitude <= 90 &&
         longitude >= -180 && 
         longitude <= 180;
};

const Map = ({ initialRegion, onRegionChange, hoardings = [], onMarkerPress, onLongPress }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [region, setRegion] = useState(initialRegion || DEFAULT_REGION);
  const mapRef = useRef(null);
  const route = useRoute();
  const isFocused = useIsFocused();
  const locationPermissionChecked = useRef(false);

  // Check location permission only once when component mounts
  useEffect(() => {
    if (!locationPermissionChecked.current) {
      checkLocationPermission();
      locationPermissionChecked.current = true;
    }
  }, []);

  // Get current location only on initial mount
  useEffect(() => {
    if (locationPermissionChecked.current) {
      updateCurrentLocation();
    }
  }, []);

  const checkLocationPermission = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  };

  const updateCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      });
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };

  const handleMapReady = useCallback(() => {
    console.log('Map is ready');
    setMapReady(true);
  }, []);

  const goToCurrentLocation = async () => {
    try {
      setIsLoading(true);
      
      if (!locationPermissionChecked.current) {
        const hasPermission = await checkLocationPermission();
        if (!hasPermission) {
          alert('Location permission is required to use this feature');
          return;
        }
        locationPermissionChecked.current = true;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      });

      if (mapRef.current && mapReady) {
        mapRef.current.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      alert('Failed to get current location');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle refresh flag and new hoarding from navigation
  useEffect(() => {
    if (route.params?.refresh && isFocused && route.params?.newHoarding && mapRef.current && mapReady) {
      console.log('New hoarding location detected, centering map...');
      mapRef.current.animateToRegion({
        latitude: route.params.newHoarding.latitude,
        longitude: route.params.newHoarding.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    }
  }, [route.params?.refresh, route.params?.newHoarding, isFocused, mapReady]);

  const handleRegionChange = useCallback((newRegion) => {
    if (newRegion && 
        typeof newRegion.latitude === 'number' && 
        typeof newRegion.longitude === 'number') {
      setRegion(newRegion);
      if (onRegionChange) {
        onRegionChange(newRegion);
      }
    }
  }, [onRegionChange]);

  const handleMarkerPress = useCallback((hoarding) => {
    if (onMarkerPress) {
      onMarkerPress(hoarding);
    }
  }, [onMarkerPress]);

  const renderMarker = useCallback((hoarding) => {
    try {
      // Basic validation
      if (!hoarding || typeof hoarding !== 'object') {
        return null;
      }

      // Validate ID
      if (!hoarding._id) {
        return null;
      }

      // Validate coordinates
      if (!Array.isArray(hoarding.location?.coordinates) || 
          hoarding.location.coordinates.length !== 2) {
        return null;
      }

      // Extract coordinates
      const longitude = Number(hoarding.location.coordinates[0]);
      const latitude = Number(hoarding.location.coordinates[1]);

      // Validate coordinate values
      if (isNaN(latitude) || isNaN(longitude) ||
          latitude < -90 || latitude > 90 ||
          longitude < -180 || longitude > 180) {
        return null;
      }

      // Return the marker with key prop separate from other props
      return (
        <Marker
          key={hoarding._id.toString()}
          coordinate={{
            latitude,
            longitude
          }}
          title={hoarding.title || 'Hoarding'}
          description={hoarding.description || ''}
          tracksViewChanges={false}
          onPress={() => handleMarkerPress(hoarding)}
        />
      );
    } catch (error) {
      console.error('Error rendering marker:', error);
      return null;
    }
  }, [handleMarkerPress]);

  const renderCurrentLocationMarker = useCallback(() => {
    if (!currentLocation) return null;

    const { latitude, longitude } = currentLocation;
    if (!isValidCoordinate(latitude, longitude)) return null;

    const coordinate = Object.freeze({
      latitude: Number(latitude),
      longitude: Number(longitude)
    });

    return (
      <>
        <Circle
          center={coordinate}
          radius={currentLocation.accuracy || 30}
          fillColor="rgba(77, 123, 243, 0.2)"
          strokeColor="rgba(77, 123, 243, 0.5)"
          strokeWidth={1}
        />
        <Marker
          coordinate={coordinate}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.currentLocationDot}>
            <View style={styles.currentLocationDotInner} />
          </View>
        </Marker>
      </>
    );
  }, [currentLocation]);

  // Validate hoardings array before rendering
  const validHoardings = Array.isArray(hoardings) ? hoardings : [];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={Platform.select({
          ios: null, // Use Apple Maps on iOS
          android: PROVIDER_GOOGLE
        })}
        style={styles.map}
        initialRegion={initialRegion || DEFAULT_REGION}
        onRegionChangeComplete={handleRegionChange}
        onLongPress={onLongPress}
        maxZoomLevel={20}
        minZoomLevel={3}
        showsUserLocation
        showsMyLocationButton={Platform.OS === 'ios'}
        onMapReady={handleMapReady}
        loadingEnabled
        loadingIndicatorColor="#666666"
        loadingBackgroundColor="#eeeeee"
      >
        {mapReady && Platform.OS === 'android' && renderCurrentLocationMarker()}
        {mapReady && validHoardings.map(renderMarker)}
      </MapView>

      {Platform.OS === 'android' && (
        <TouchableOpacity 
          style={styles.currentLocationButton}
          onPress={goToCurrentLocation}
          disabled={isLoading}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="locate" size={24} color="#f4511e" />
            {isLoading && (
              <ActivityIndicator 
                size="small" 
                color="#f4511e" 
                style={styles.loadingIndicator}
              />
            )}
          </View>
        </TouchableOpacity>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  currentLocationButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  loadingContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 8,
    borderRadius: 8,
  },
  currentLocationDot: {
    width: 22,
    height: 22,
    backgroundColor: 'rgba(77, 123, 243, 0.3)',
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationDotInner: {
    width: 12,
    height: 12,
    backgroundColor: '#4D7BF3',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  }
});

export default Map; 