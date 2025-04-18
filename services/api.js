import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Get the appropriate API URL based on the platform and environment
const getApiUrl = () => {
  if (__DEV__) {
    // Development environment
    if (Platform.OS === 'android') {
      if (!Platform.isTV) {
        // For physical Android devices
        return 'http://192.168.29.210:5000/api';
      }
      // For Android Emulator
      return 'http://10.0.2.2:5000/api';
    } else if (Platform.OS === 'ios') {
      // For both iOS Simulator and physical devices
      return 'http://192.168.29.210:5000/api';
    }
  }
  // For production
  return 'http://192.168.29.210:5000/api';
};

const API_URL = getApiUrl();
console.log('Using API URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 second timeout
});

// Add request interceptor for debugging and token
api.interceptors.request.use(
  async (config) => {
    try {
      // Log request details
      console.log('Making request:', {
        url: `${config.baseURL}${config.url}`,
        method: config.method,
        data: config.data,
        headers: config.headers
      });

      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log('Response received:', {
      status: response.status,
      data: response.data,
      url: response.config.url
    });
    return response;
  },
  (error) => {
    // Handle network errors
    if (!error.response) {
      console.error('Network error details:', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
          timeout: error.config?.timeout
        }
      });

      // Check if it's a timeout error
      if (error.code === 'ECONNABORTED') {
        return Promise.reject('Request timed out. Please check your internet connection and try again.');
      }

      // Check if server is unreachable
      if (error.message.includes('Network Error')) {
        return Promise.reject('Cannot connect to server. Please check if the server is running and try again.');
      }

      return Promise.reject('Network error. Please check your internet connection.');
    }

    // Handle HTTP errors
    console.error('Response error:', {
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method
    });

    return Promise.reject(error.response?.data?.error || error.message);
  }
);

export const auth = {
  login: async (email, password) => {
    try {
      console.log('Attempting login for:', email);
      const response = await api.post('/auth/login', {
        email,
        password,
      });
      
      await AsyncStorage.setItem('token', response.data.token);
      console.log('Login successful');
      return response.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw typeof error === 'string' ? error : 'Login failed. Please try again.';
    }
  },

  register: async (email, password, role) => {
    try {
      console.log('Attempting registration for:', email);
      const response = await api.post('/auth/register', {
        email,
        password,
        role,
      });
      
      await AsyncStorage.setItem('token', response.data.token);
      console.log('Registration successful');
      return response.data;
    } catch (error) {
      console.error('Registration failed:', error);
      throw typeof error === 'string' ? error : 'Registration failed. Please try again.';
    }
  },

  logout: async () => {
    try {
      await AsyncStorage.removeItem('token');
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      throw 'Logout failed';
    }
  },
};

export const hoardings = {
  add: async (hoardingData) => {
    try {
      console.log('Adding hoarding:', hoardingData);
      const response = await api.post('/hoardings/add', hoardingData);
      
      // Clear all cached hoarding data to ensure fresh data
      const keys = await AsyncStorage.getAllKeys();
      const cachesToClear = keys.filter(key => key.startsWith('nearby_hoardings_'));
      await AsyncStorage.multiRemove(cachesToClear);
      
      console.log('Hoarding added successfully');
      return response.data;
    } catch (error) {
      console.error('Failed to add hoarding:', error);
      throw typeof error === 'string' ? error : 'Failed to add hoarding. Please try again.';
    }
  },

  getNearby: async (latitude, longitude, radius = 5000) => {
    try {
      console.log('Fetching nearby hoardings:', { latitude, longitude, radius });
      
      // Round coordinates to reduce cache variations
      const roundedLat = Math.round(latitude * 1000) / 1000;
      const roundedLng = Math.round(longitude * 1000) / 1000;
      
      const cacheKey = `nearby_hoardings_${roundedLat}_${roundedLng}_${radius}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        const cacheAge = Date.now() - timestamp;
        
        // Use cache if it's less than 2 minutes old
        if (cacheAge < 2 * 60 * 1000) {
          console.log('Using cached hoarding data');
          return data;
        }
      }
      
      const response = await api.get('/hoardings/nearby', {
        params: { lat: latitude, lng: longitude, radius }
      });
      
      // Cache the new data
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        data: response.data,
        timestamp: Date.now()
      }));
      
      return response.data;
    } catch (error) {
      console.error('Failed to fetch nearby hoardings:', error);
      // If there's an error but we have cached data, return it as fallback
      try {
        const cacheKey = `nearby_hoardings_${Math.round(latitude * 1000) / 1000}_${Math.round(longitude * 1000) / 1000}_${radius}`;
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
          const { data } = JSON.parse(cachedData);
          console.log('Using cached data as fallback due to error');
          return data;
        }
      } catch (cacheError) {
        console.error('Cache fallback failed:', cacheError);
      }
      throw typeof error === 'string' ? error : 'Failed to fetch nearby hoardings. Please try again.';
    }
  },

  getAll: async () => {
    try {
      console.log('Fetching all hoardings');
      const response = await api.get('/hoardings');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch hoardings:', error);
      throw typeof error === 'string' ? error : 'Failed to fetch hoardings. Please try again.';
    }
  },

  getById: async (id) => {
    try {
      console.log('Fetching hoarding by id:', id);
      const response = await api.get(`/hoardings/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch hoarding:', error);
      throw typeof error === 'string' ? error : 'Failed to fetch hoarding details. Please try again.';
    }
  },

  update: async (id, data) => {
    try {
      console.log('Updating hoarding:', { id, data });
      const response = await api.put(`/hoardings/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update hoarding:', error);
      throw typeof error === 'string' ? error : 'Failed to update hoarding. Please try again.';
    }
  },

  delete: async (id) => {
    try {
      console.log('Deleting hoarding:', id);
      const response = await api.delete(`/hoardings/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete hoarding:', error);
      throw typeof error === 'string' ? error : 'Failed to delete hoarding. Please try again.';
    }
  }
}; 