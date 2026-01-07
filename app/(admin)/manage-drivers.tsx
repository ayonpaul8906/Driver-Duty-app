import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Driver {
  id: string;
  name: string;
  email: string;
  totalKms: number;
  status: "active" | "on-duty" | "offline";
}

export default function ManageDrivers() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Querying only users with the role 'driver'
    const q = query(collection(db, "users"), where("role", "==", "driver"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const driverList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Driver[];
      
      setDrivers(driverList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredDrivers = drivers.filter((d) =>
    d.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderDriverCard = ({ item }: { item: Driver }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.driverName}>{item.name}</Text>
          <Text style={styles.driverEmail}>{item.email}</Text>
        </View>
        <View style={[styles.statusBadge, item.status === 'on-duty' ? styles.statusOnDuty : styles.statusActive]}>
          <Text style={styles.statusText}>{item.status || "active"}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="map-marker-distance" size={18} color="#64748B" />
          <Text style={styles.statValue}>{item.totalKms || 0} km</Text>
        </View>
        <TouchableOpacity 
          style={styles.viewDetailsBtn}
          onPress={() => router.push({ pathname: "/(admin)/driver-details", params: { id: item.id } })}
        >
          <Text style={styles.viewDetailsText}>View Details</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color="#2563EB" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.title}>Fleet Personnel</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search drivers by name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <FlatList
            data={filteredDrivers}
            keyExtractor={(item) => item.id}
            renderItem={renderDriverCard}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No drivers found.</Text>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  container: { flex: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 15 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", color: "#0F172A" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: "#1E293B" },
  listContent: { paddingBottom: 30 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "bold", color: "#2563EB" },
  info: { flex: 1, marginLeft: 15 },
  driverName: { fontSize: 16, fontWeight: "bold", color: "#1E293B" },
  driverEmail: { fontSize: 13, color: "#64748B", marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusActive: { backgroundColor: "#DCFCE7" },
  statusOnDuty: { backgroundColor: "#FEF3C7" },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", color: "#166534" },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  statItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  statValue: { fontSize: 14, fontWeight: "600", color: "#475569" },
  viewDetailsBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewDetailsText: { color: "#2563EB", fontWeight: "600", fontSize: 14 },
  loader: { flex: 1, justifyContent: "center" },
  emptyText: { textAlign: "center", marginTop: 40, color: "#64748B" },
});