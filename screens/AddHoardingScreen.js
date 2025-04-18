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
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { hoardings } from '../services/api';

const AddHoardingScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
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
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        setLocation(location);
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

      await hoardings.add(hoardingData);
      Alert.alert('Success', 'Hoarding added successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error adding hoarding:', error);
      Alert.alert('Error', typeof error === 'string' ? error : 'Failed to add hoarding');
    } finally {
      setLoading(false);
    }
  };

  if (!location) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Getting location...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            onLongPress={handleLocationSelect}
          >
            {selectedLocation && (
              <Marker
                coordinate={selectedLocation}
                title="Selected Location"
                description={address}
              />
            )}
          </MapView>
        </View>

        {selectedLocation && (
          <View style={styles.addressContainer}>
            <Text style={styles.addressText}>{address}</Text>
          </View>
        )}

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
    marginBottom: 16,
    borderRadius: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
  },
});

export default AddHoardingScreen; 