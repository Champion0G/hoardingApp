/*
Setup steps:
1. npx create-expo-app hoarding-app
2. cd hoarding-app
3. npx expo install react-native-maps
4. npx expo install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
5. npx expo install expo-location
6. npx expo install @gorhom/bottom-sheet
7. npx expo install react-native-gesture-handler react-native-reanimated
8. npm install react-native-google-places-autocomplete
9. npx expo install react-native-get-random-values
10. npx expo start
*/

import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import LoginScreen from './screens/LoginScreen';
import RoleSelectScreen from './screens/RoleSelectScreen';
import AddHoardingScreen from './screens/AddHoardingScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const { userRole } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Add Hoarding') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#f4511e',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          headerShown: true
        }}
      />
      <Tab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{
          headerShown: true
        }}
      />
      {userRole === 'authorized' && (
        <Tab.Screen 
          name="Add Hoarding" 
          component={AddHoardingScreen}
          options={{
            headerShown: true,
            tabBarLabel: 'Add',
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons 
                name={focused ? 'add-circle' : 'add-circle-outline'} 
                size={size} 
                color={color}
              />
            )
          }}
        />
      )}
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { isLoggedIn, hasSelectedRole } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isLoggedIn ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : !hasSelectedRole ? (
        <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      ) : (
        <Stack.Screen name="MainApp" component={TabNavigator} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 