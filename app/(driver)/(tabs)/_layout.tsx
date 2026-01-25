import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB', // AMPL Blue
        tabBarInactiveTintColor: '#94A3B8',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '900',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginTop: -5,
          marginBottom: Platform.OS === 'ios' ? 0 : 12,
        },
        tabBarStyle: {
          // Increased height for a more premium "Console" look
          height: Platform.OS === 'ios' ? 100 : 85,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 25,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.1,
          shadowRadius: 20,
          // Inner padding to center icons
          paddingTop: 12,
        },
      }}
    >
      {/* 1. DASHBOARD / HOME */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeContainer]}>
              <MaterialCommunityIcons 
                name={focused ? "view-dashboard" : "view-dashboard-outline"} 
                size={26} 
                color={focused ? "#2563EB" : "#94A3B8"} 
              />
            </View>
          ),
        }}
      />

      {/* 2. HISTORY / LOGS */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeContainer]}>
              <MaterialCommunityIcons 
                name={focused ? "clock-check" : "clock-outline"} 
                size={26} 
                color={focused ? "#2563EB" : "#94A3B8"} 
              />
            </View>
          ),
        }}
      />

      {/* 3. PROFILE */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeContainer]}>
              <MaterialCommunityIcons 
                name={focused ? "account-circle" : "account-circle-outline"} 
                size={26} 
                color={focused ? "#2563EB" : "#94A3B8"} 
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 50,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginBottom: 4,
  },
  activeContainer: {
    backgroundColor: '#EFF6FF', // Soft Blue Background for Active Tab
  },
});