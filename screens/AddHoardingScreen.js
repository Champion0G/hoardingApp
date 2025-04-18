import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button, Switch } from 'react-native-paper';
import * as Location from 'expo-location';
import { hoardings } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Map from '../components/Map';

const AddHoardingScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [initialRegion, setInitialRegion] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [address, setAddress] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    size: '',
    price: '',
    availability: true,
  });

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required to add hoardings');
          // Set default location (center of India)
          setInitialRegion({
            latitude: 20.5937,
            longitude: 78.9629,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        const region = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        setInitialRegion(region);
      } catch (error) {
        console.error('Error getting location:', error);
        Alert.alert('Error', 'Failed to get current location');
      }
    })();
  }, []);

  const handleLocationSelect = async (event) => {
    try {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      setSelectedLocation({ latitude, longitude });

      // Reverse geocoding to get address
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'HoardingApp/1.0',
            },
          }
        );
        const data = await response.json();
        setAddress(data.display_name || 'Address not found');
      } catch (error) {
        console.error('Error fetching address:', error);
        setAddress('Address not found');
      }
    } catch (error) {
      console.error('Error selecting location:', error);
      Alert.alert('Error', 'Failed to select location');
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return false;
    }
    if (!formData.size.trim()) {
      Alert.alert('Error', 'Please enter the size');
      return false;
    }
    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return false;
    }
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location on the map');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const hoardingData = {
        ...formData,
        price: Number(formData.price),
        location: {
          type: 'Point',
          coordinates: [selectedLocation.longitude, selectedLocation.latitude]
        },
        address: address
      };

      console.log('Submitting hoarding data:', hoardingData);
      await hoardings.add(hoardingData);
      
      // Clear all hoarding caches to force refresh
      const keys = await AsyncStorage.getAllKeys();
      const cachesToClear = keys.filter(key => key.startsWith('nearby_hoardings_'));
      console.log('Clearing caches:', cachesToClear);
      await AsyncStorage.multiRemove(cachesToClear);
      
      // Navigate back with refresh flag and the new hoarding location
      navigation.navigate('Home', { 
        refresh: Date.now(),
        newHoarding: {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude
        }
      });
      Alert.alert('Success', 'Hoarding added successfully');
    } catch (error) {
      console.error('Error adding hoarding:', error);
      Alert.alert('Error', typeof error === 'string' ? error : 'Failed to add hoarding');
    } finally {
      setLoading(false);
    }
  };

  if (!initialRegion) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Getting location...</Text>
      </View>
    );
  }

  const selectedHoarding = selectedLocation ? {
    _id: 'temp',
    location: {
      coordinates: [selectedLocation.longitude, selectedLocation.latitude]
    },
    title: 'Selected Location',
    description: address
  } : null;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.mapContainer}>
          <Map
            initialRegion={initialRegion}
            onRegionChange={() => {}}
            hoardings={selectedHoarding ? [selectedHoarding] : []}
            onMarkerPress={() => {}}
            onLongPress={handleLocationSelect}
          />
          {selectedLocation && (
            <View style={styles.addressContainer}>
              <Text style={styles.addressText}>{address}</Text>
            </View>
          )}
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Title"
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description"
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            multiline
            numberOfLines={4}
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

          <View style={styles.switchContainer}>
            <Text>Available</Text>
            <Switch
              value={formData.availability}
              onValueChange={(value) => setFormData({ ...formData, availability: value })}
            />
          </View>

          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.button}
            loading={loading}
            disabled={loading}
          >
            Add Hoarding
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    height: 300,
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  addressContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
  },
  form: {
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});

export default AddHoardingScreen; 