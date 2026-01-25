import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

interface Driver {
  id: string;
  name: string;
  email: string;
  latitude?: number;
  longitude?: number;
  isOnline: boolean;
}

export default function LiveTracking() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isListVisible, setIsListVisible] = useState(false);

  // ---------------------------
  // FIRESTORE REALTIME SYNC
  // ---------------------------
  useEffect(() => {
    const qUsers = query(
      collection(db, "users"),
      where("role", "==", "driver")
    );

    const unsubUsers = onSnapshot(qUsers, (userSnap) => {
      const userList = userSnap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "Unknown Driver",
        email: doc.data().email || "",
      }));

      const unsubLocations = onSnapshot(
        collection(db, "drivers"),
        (locSnap) => {
          const locations: any = {};
          locSnap.docs.forEach((doc) => {
            locations[doc.id] = doc.data();
          });

          const mergedDrivers = userList.map((user) => {
            const locData = locations[user.id];
            const lat =
              locData?.latitude ??
              locData?.currentLocation?.latitude;
            const lng =
              locData?.longitude ??
              locData?.currentLocation?.longitude;

            const isValidLocation =
              Number.isFinite(lat) && Number.isFinite(lng);

            return {
              ...user,
              latitude: lat,
              longitude: lng,
              isOnline: isValidLocation,
            };
          });

          setDrivers(mergedDrivers);
          setLoading(false);

          webViewRef.current?.postMessage(
            JSON.stringify(mergedDrivers)
          );
        }
      );

      return () => unsubLocations();
    });

    return () => unsubUsers();
  }, []);

  const filteredDrivers = useMemo(
    () =>
      drivers.filter((d) =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [drivers, searchQuery]
  );

  // ---------------------------
  // USER-TRIGGERED FOCUS ONLY
  // ---------------------------
  const handleFocusDriver = (driver: Driver) => {
    if (
      driver.isOnline &&
      Number.isFinite(driver.latitude) &&
      Number.isFinite(driver.longitude)
    ) {
      webViewRef.current?.injectJavaScript(`
        map.flyTo([${driver.latitude}, ${driver.longitude}], 17, { duration: 0.8 });
        true;
      `);
      setIsListVisible(false);
    }
  };

  // ---------------------------
  // LEAFLET HTML (FIXED)
  // ---------------------------
  const leafletHTML = `
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<style>
#map {
  height: 100vh;
  width: 100vw;
  background: #f1f5f9;
}

.car-wrapper {
  background: #2563EB;
  border: 3px solid white;
  border-radius: 12px;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}

.pulse {
  position: absolute;
  width: 50px;
  height: 50px;
  background: rgba(37, 99, 235, 0.25);
  border-radius: 50%;
  animation: pulse-ring 2s infinite ease-in-out;
  z-index: -1;
}

@keyframes pulse-ring {
  0% { transform: scale(0.4); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}
</style>
</head>

<body>
<div id="map"></div>

<script>
var map = L.map('map', { zoomControl: false })
  .setView([22.5726, 88.3639], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

var markers = {};
var OFFSET = 0.00003;

// deterministic offset for same-location drivers
function offsetLatLng(lat, lng, index) {
  var angle = (index * 45) * Math.PI / 180;
  return [
    lat + OFFSET * Math.cos(angle),
    lng + OFFSET * Math.sin(angle)
  ];
}

function handleMessage(event) {
  const drivers = JSON.parse(event.data);

  const buckets = {};

  drivers.forEach(d => {
    if (!Number.isFinite(d.latitude) || !Number.isFinite(d.longitude)) return;

    const key = d.latitude.toFixed(6) + "_" + d.longitude.toFixed(6);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(d);
  });

  Object.values(buckets).forEach(group => {
    group.forEach((d, index) => {
      const pos = group.length > 1
        ? offsetLatLng(d.latitude, d.longitude, index)
        : [d.latitude, d.longitude];

      if (markers[d.id]) {
        markers[d.id].setLatLng(pos); // ✅ NO animation → no lag
      } else {
        const icon = L.divIcon({
          html: '<div class="car-wrapper"><div class="pulse"></div><svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg></div>',
          className: 'custom-car-marker',
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });

        markers[d.id] = L.marker(pos, { icon })
          .addTo(map)
          .bindPopup('<b>' + d.name + '</b><br>Live Tracking Active');
      }
    });
  });
}

window.addEventListener("message", handleMessage);
document.addEventListener("message", handleMessage);
</script>
</body>
</html>
`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: leafletHTML }}
        style={styles.map}
        scrollEnabled={false}
      />

      {/* UI BELOW UNCHANGED */}
      {/* ... your UI code remains exactly the same ... */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1 },
});
