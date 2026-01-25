import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Task {
  id: string;
  status: string;
  tourLocation: string;
  tourTime: string;
  passenger: { name: string; phone: string; heads: number };
  createdAt: any;
}

export default function DriverProfile() {
  const { driverId } = useLocalSearchParams();
  const router = useRouter();
  const [driver, setDriver] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;

    // 1. Listen to Driver Details
    const unsubDriver = onSnapshot(doc(db, "users", driverId as string), (snap) => {
      if (snap.exists()) {
        setDriver(snap.data());
      }
    });

    // 2. Listen to Driver Tasks
    const q = query(
      collection(db, "tasks"),
      where("driverId", "==", driverId)
    );

    const unsubTasks = onSnapshot(q, (snap) => {
      const fetchedTasks = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Task[];

      // Manual sort: Newest first
      const sortedTasks = fetchedTasks.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setTasks(sortedTasks);
      setLoading(false);
    }, (error) => {
      console.error("Task subscription error:", error);
      setLoading(false);
    });

    return () => {
      unsubDriver();
      unsubTasks();
    };
  }, [driverId]);

  const activeTask = tasks.find(t => t.status === "in-progress") || tasks.find(t => t.status === "assigned");
  const pastTasks = tasks.filter(t => t.status === "completed");

  const formatDate = (createdAt: any) => {
    if (createdAt?.seconds) {
      return new Date(createdAt.seconds * 1000).toLocaleDateString('en-GB');
    }
    return 'N/A';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* NAVIGATION HEADER */}
      <View style={styles.navHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#64748B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Driver Profile</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: activeTask ? '#22C55E' : '#CBD5E1' }]} />
          <Text style={styles.statusLabel}>{activeTask ? 'ON DUTY' : 'AVAILABLE'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* PROFILE INFO CARD */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{driver?.name?.charAt(0) || "?"}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.driverName}>{driver?.name || "Loading..."}</Text>
            <View style={styles.emailRow}>
              <MaterialCommunityIcons name="email-outline" size={14} color="#64748B" />
              <Text style={styles.driverEmail}>{driver?.email}</Text>
            </View>
            <View style={styles.idBadge}>
              <Text style={styles.idText}>ID: {(driverId as string)?.slice(-6).toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.statsColumn}>
            <Text style={styles.statsLabel}>LIFE DUTIES</Text>
            <Text style={styles.statsValue}>{tasks.length}</Text>
          </View>
        </View>

        {/* ONGOING DUTY SECTION */}
        <Text style={styles.sectionHeader}>ONGOING DUTY</Text>
        {loading ? (
          <View style={styles.skeletonLoader} />
        ) : activeTask ? (
          <View style={styles.activeTaskCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: activeTask.status === 'in-progress' ? '#FEF3C7' : '#DBEAFE' }]}>
                <Text style={[styles.badgeText, { color: activeTask.status === 'in-progress' ? '#B45309' : '#1E40AF' }]}>
                  {activeTask.status.toUpperCase()}
                </Text>
              </View>
              <MaterialCommunityIcons name="clock-outline" size={18} color="#CBD5E1" />
            </View>
            <Text style={styles.passengerName}>{activeTask.passenger?.name}</Text>
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker" size={16} color="#2563EB" />
              <Text style={styles.locationText}>{activeTask.tourLocation}</Text>
            </View>
            <View style={styles.cardFooter}>
              <View style={styles.footerItem}>
                <MaterialCommunityIcons name="account-group" size={14} color="#94A3B8" />
                <Text style={styles.footerText}>{activeTask.passenger?.heads || 0} HEADS</Text>
              </View>
              <View style={styles.footerItem}>
                <MaterialCommunityIcons name="clock-time-four" size={14} color="#94A3B8" />
                <Text style={styles.footerText}>{activeTask.tourTime}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyActiveCard}>
            <Text style={styles.emptyText}>NO ACTIVE TASK</Text>
          </View>
        )}

        {/* HISTORY LOG SECTION */}
        <Text style={styles.sectionHeader}>DUTY HISTORY LOG</Text>
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.colHeader}>PASSENGER / DATE</Text>
            <Text style={styles.colHeader}>LOCATION</Text>
            <Text style={[styles.colHeader, { textAlign: 'right' }]}>STATUS</Text>
          </View>

          {pastTasks.length > 0 ? (
            pastTasks.map((task) => (
              <View key={task.id} style={styles.historyRow}>
                <View style={styles.col1}>
                  <Text style={styles.histPassenger}>{task.passenger?.name}</Text>
                  <Text style={styles.histDate}>{formatDate(task.createdAt)}</Text>
                </View>
                <View style={styles.col2}>
                  <Text style={styles.histLoc} numberOfLines={2}>
                    <MaterialCommunityIcons name="map-marker" size={12} color="#CBD5E1" /> {task.tourLocation}
                  </Text>
                </View>
                <View style={styles.col3}>
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedText}>COMPLETED</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noHistoryText}>
              {loading ? "Fetching history..." : "No historical logs found for this driver."}
            </Text>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  navHeader: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 15 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 10, fontWeight: "900", color: "#94A3B8", letterSpacing: 0.5 },
  backBtn: { padding: 5 },

  scrollContent: { padding: 20 },

  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
  profileInfo: { flex: 1, marginLeft: 15 },
  driverName: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  driverEmail: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  idBadge: {
    backgroundColor: "#EFF6FF",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  idText: { color: "#2563EB", fontSize: 10, fontWeight: "900" },
  statsColumn: { borderLeftWidth: 1, borderLeftColor: "#F1F5F9", paddingLeft: 15, alignItems: "center" },
  statsLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8" },
  statsValue: { fontSize: 22, fontWeight: "900", color: "#1E293B" },

  sectionHeader: { fontSize: 10, fontWeight: "900", color: "#94A3B8", letterSpacing: 2, marginBottom: 15 },
  skeletonLoader: { height: 120, backgroundColor: "#FFFFFF", borderRadius: 20, opacity: 0.5 },
  
  activeTaskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#2563EB",
    padding: 20,
    marginBottom: 25,
    shadowColor: "#2563EB",
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 4,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 9, fontWeight: "900" },
  passengerName: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  locationRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 8 },
  locationText: { flex: 1, fontSize: 13, fontWeight: "700", color: "#475569" },
  cardFooter: { flexDirection: "row", gap: 15, marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: "#F8FAFC" },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { fontSize: 10, fontWeight: "900", color: "#94A3B8" },

  emptyActiveCard: {
    backgroundColor: "#E2E8F0",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    marginBottom: 25,
  },
  emptyText: { fontSize: 10, fontWeight: "900", color: "#94A3B8" },

  historyContainer: { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden" },
  historyHeader: { backgroundColor: "#F8FAFC", flexDirection: "row", padding: 15, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  colHeader: { flex: 1, fontSize: 9, fontWeight: "900", color: "#94A3B8" },
  historyRow: { flexDirection: "row", padding: 15, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  col1: { flex: 1 },
  col2: { flex: 1.5, paddingRight: 10 },
  col3: { flex: 0.8, alignItems: "flex-end" },
  histPassenger: { fontSize: 13, fontWeight: "900", color: "#1E293B" },
  histDate: { fontSize: 10, fontWeight: "700", color: "#94A3B8", marginTop: 2 },
  histLoc: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  completedBadge: { backgroundColor: "#F0FDF4", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  completedText: { color: "#16A34A", fontSize: 8, fontWeight: "900" },
  noHistoryText: { textAlign: "center", padding: 30, color: "#94A3B8", fontSize: 12, fontWeight: "600", fontStyle: "italic" }
});