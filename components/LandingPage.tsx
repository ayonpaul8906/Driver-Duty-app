import React from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  const router = useRouter();

  const handleStart = () => {
    onGetStarted();
    router.push('/(auth)/login');
  };

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=1200' }} 
      style={styles.bg}
    >
      <View style={styles.overlay}>
        <View style={styles.topSection}>
          <Text style={styles.company}>AMPL</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.midSection}>
          <Text style={styles.title}>Driver Duty{"\n"}Management</Text>
          <Text style={styles.desc}>Secure enterprise fleet coordination and real-time task tracking for AMPL professionals.</Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleStart}>
          <Text style={styles.btnText}>Get Started</Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: 30, justifyContent: 'space-between' },
  topSection: { marginTop: 50 },
  company: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  line: { height: 4, width: 40, backgroundColor: '#2563EB', marginTop: 5 },
  midSection: { marginBottom: 50 },
  title: { fontSize: 42, fontWeight: 'bold', color: '#fff', lineHeight: 50 },
  desc: { fontSize: 16, color: '#CBD5E1', marginTop: 15, lineHeight: 24 },
  btn: { 
    backgroundColor: '#2563EB', 
    flexDirection: 'row', 
    height: 60, 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 10,
    marginBottom: 40
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});