import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// Interface matching your operational structure
interface TaskRecord {
  id: string;
  driverId: string;
  status: string;
  tourLocation: string;
  tourTime: string;
  passenger: {
    name: string;
    phone: string;
    heads: number;
  };
  createdAt: any;
  date?: string;
  driverName?: string;
}

export default function DutyRecords() {
  const router = useRouter();
  const { filter } = useLocalSearchParams(); // status filter from dashboard
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch Drivers to map ID to Name
    const qDrivers = query(collection(db, "users"), where("role", "==", "driver"));
    const qTasks = query(collection(db, "tasks"), orderBy("createdAt", "desc"));

    const unsubDrivers = onSnapshot(qDrivers, (driverSnap) => {
      const drivers = driverSnap.docs.map(d => ({ 
        id: d.id, 
        name: d.data().name 
      }));

      const unsubTasks = onSnapshot(qTasks, (taskSnap) => {
        const today = new Date().toDateString();

        const allTasks = taskSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TaskRecord[];

        // Filter: Status matching AND Date must be Today
        const filtered = allTasks
          .filter(t => {
            const taskDate = t.createdAt?.toDate 
              ? t.createdAt.toDate().toDateString() 
              : new Date(t.date || "").toDateString();
            
            const isToday = taskDate === today;
            const matchesStatus = (filter === "all" || !filter ? true : t.status === filter);
            
            return isToday && matchesStatus;
          })
          .map(t => ({
            ...t,
            driverName: drivers.find(d => d.id === t.driverId)?.name || "Unknown Driver"
          }));

        setTasks(filtered);
        setLoading(false);
      });
      return () => unsubTasks();
    });
    return () => unsubDrivers();
  }, [filter]);

  const filteredTasks = tasks.filter(t => 
    t.passenger?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.tourLocation?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topRibbon} />

      <View style={styles.content}>
        {/* ================= HEADER ================= */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles.backBtn}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#64748B" />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>
                {filter === 'all' || !filter ? "Today's Total" : `Today's ${String(filter).replace('-', ' ')}`}
              </Text>
              <View style={styles.subTitleRow}>
                <MaterialCommunityIcons name="filter-variant" size={14} color="#2563EB" />
                <Text style={styles.subTitle}>DAYWISE OPERATIONAL RECORDS</Text>
              </View>
            </View>
          </View>
          <View style={styles.counterBadge}>
            <Text style={styles.counterNum}>{filteredTasks.length}</Text>
            <Text style={styles.counterText}>ENTRIES</Text>
          </View>
        </View>

        {/* ================= SEARCH ================= */}
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={24} color="#94A3B8" style={styles.searchIcon} />
          <TextInput 
            placeholder="Search today's records..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* ================= LIST ================= */}
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loaderText}>LOADING RECORDS...</Text>
          </View>
        ) : (
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollList}
          >
            {filteredTasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="text-box-search-outline" size={48} color="#E2E8F0" />
                <Text style={styles.emptyText}>NO DUTY RECORDS FOUND FOR TODAY.</Text>
              </View>
            ) : (
              filteredTasks.map(task => (
                <View key={task.id} style={styles.taskCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, getStatusStyle(task.status)]}>
                      <Text style={[styles.statusText, { color: getStatusColor(task.status) }]}>
                        {task.status.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.refText}>REF: {task.id.slice(-6).toUpperCase()}</Text>
                  </View>

                  <View style={styles.cardMain}>
                    <Text style={styles.passengerName}>{task.passenger?.name}</Text>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <MaterialCommunityIcons name="account-group" size={16} color="#2563EB" />
                        <Text style={styles.infoText}>{task.passenger?.heads || 0} HEADS</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color="#2563EB" />
                        <Text style={styles.infoText}>{task.tourTime}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.locationBox}>
                    <MaterialCommunityIcons name="map-marker" size={18} color="#EF4444" />
                    <Text style={styles.locationText} numberOfLines={2}>{task.tourLocation}</Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.driverAvatar}>
                      <MaterialCommunityIcons name="account-tie" size={20} color="#fff" />
                    </View>
                    <View>
                      <Text style={styles.footerLabel}>DRIVER ASSIGNED</Text>
                      <Text style={styles.footerVal}>{task.driverName}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

// Helper for status styles
const getStatusStyle = (status: string) => {
  switch (status) {
    case 'completed': return { backgroundColor: '#DCFCE7' };
    case 'in-progress': return { backgroundColor: '#FEF3C7' };
    default: return { backgroundColor: '#DBEAFE' };
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return '#15803D';
    case 'in-progress': return '#B45309';
    default: return '#1E40AF';
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  topRibbon: { height: 6, backgroundColor: "#2563EB" },
  content: { flex: 1, padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 30 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 15 },
  backBtn: { padding: 12, backgroundColor: "#fff", borderRadius: 16, elevation: 2, shadowOpacity: 0.1 },
  title: { fontSize: 26, fontWeight: "900", color: "#0F172A", textTransform: 'capitalize' },
  subTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  subTitle: { fontSize: 9, fontWeight: "900", color: "#94A3B8", letterSpacing: 1 },
  counterBadge: { backgroundColor: "#fff", paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, alignItems: "center", borderWidth: 1, borderColor: "#F1F5F9" },
  counterNum: { fontSize: 20, fontWeight: "900", color: "#2563EB" },
  counterText: { fontSize: 8, fontWeight: "900", color: "#94A3B8" },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", height: 64, borderRadius: 20, paddingHorizontal: 20, marginBottom: 25, borderWidth: 1, borderColor: "#E2E8F0", elevation: 2, shadowOpacity: 0.05 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, fontWeight: "700", color: "#1E293B" },
  loaderBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: { fontSize: 10, fontWeight: "900", color: "#94A3B8", letterSpacing: 1.5, marginTop: 15 },
  scrollList: { paddingBottom: 20 },
  taskCard: { backgroundColor: "#fff", borderRadius: 32, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: "#F1F5F9", elevation: 3, shadowOpacity: 0.05 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: "900" },
  refText: { fontSize: 9, fontWeight: "800", color: "#CBD5E1" },
  cardMain: { marginBottom: 15 },
  passengerName: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
  infoRow: { flexDirection: "row", gap: 15, marginTop: 8 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoText: { fontSize: 10, fontWeight: "900", color: "#94A3B8" },
  locationBox: { backgroundColor: "#F8FAFC", padding: 16, borderRadius: 20, flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 20 },
  locationText: { flex: 1, fontSize: 13, fontWeight: "700", color: "#475569", lineHeight: 18 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 15, borderTopWidth: 1, borderTopColor: "#F8FAFC" },
  driverAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
  footerLabel: { fontSize: 8, fontWeight: "900", color: "#94A3B8", letterSpacing: 0.5 },
  footerVal: { fontSize: 14, fontWeight: "900", color: "#1E293B" },
  emptyCard: { padding: 60, borderRadius: 40, borderStyle: "dashed", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  emptyText: { fontSize: 10, fontWeight: "900", color: "#CBD5E1", letterSpacing: 1, marginTop: 15 }
});