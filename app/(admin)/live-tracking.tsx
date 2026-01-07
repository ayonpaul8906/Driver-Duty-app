import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LiveTracking() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen for active drivers with valid GPS data
    const q = query(collection(db, "drivers"), where("active", "==", true));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const driverList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((d: any) => d.currentLocation && d.currentLocation.latitude);
      
      setDrivers(driverList);
      setLoading(false);

      // 2. Push updated data to the WebView Map
      if (webViewRef.current && driverList.length > 0) {
        const jsonStr = JSON.stringify(driverList);
        webViewRef.current.injectJavaScript(`updateMarkers(${jsonStr}); true;`);
      }
    });

    return () => unsubscribe();
  }, []);

  const mapHtml = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          #map { height: 100vh; width: 100vw; margin: 0; }
          .custom-div-icon {
            background: #2563EB;
            border: 2px solid white;
            border-radius: 50%;
            width: 12px;
            height: 12px;
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([22.5726, 88.3639], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
          L.control.zoom({ position: 'bottomright' }).addTo(map);
          
          var markers = {};

          function updateMarkers(driverData) {
            driverData.forEach(driver => {
              var lat = driver.currentLocation.latitude;
              var lng = driver.currentLocation.longitude;
              
              if (markers[driver.id]) {
                // Smoothly transition marker to new position
                markers[driver.id].setLatLng([lat, lng]);
              } else {
                // Create new marker if it doesn't exist
                markers[driver.id] = L.marker([lat, lng])
                  .addTo(map)
                  .bindPopup("<b>" + (driver.name || 'Driver') + "</b><br>Live Location");
                
                // On the very first marker, center the map
                if (Object.keys(markers).length === 1) {
                  map.setView([lat, lng], 14);
                }
              }
            });
          }
        </script>
      </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={30} color="#0F172A" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Live Fleet Map</Text>
          <Text style={styles.subTitle}>AMPL Real-time Tracking</Text>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoadEnd={() => {
            if (drivers.length > 0) {
              const jsonStr = JSON.stringify(drivers);
              webViewRef.current?.injectJavaScript(`updateMarkers(${jsonStr}); true;`);
            }
          }}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.statusIndicator}>
          <View style={styles.pulseDot} />
          <Text style={styles.countText}>Tracking {drivers.length} Active Personnel</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 20, 
    paddingVertical: 15, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9'
  },
  backBtn: { marginRight: 15 },
  title: { fontSize: 20, fontWeight: "bold", color: "#0F172A" },
  subTitle: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  mapContainer: { flex: 1 },
  footer: { 
    padding: 20, 
    backgroundColor: "#fff", 
    borderTopWidth: 1, 
    borderTopColor: "#E2E8F0" 
  },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  countText: { color: "#1E293B", fontWeight: "700", fontSize: 14 }
});