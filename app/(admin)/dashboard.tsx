import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  StatusBar 
} from "react-native";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// Define local types for stats
interface DashboardStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
  });

  // 1. Real-time stats listener for the entire fleet
  useEffect(() => {
    const q = query(collection(db, "tasks"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      setStats({
        total: docs.length,
        completed: docs.filter(d => d.status === "completed").length,
        inProgress: docs.filter(d => d.status === "in-progress").length,
        pending: docs.filter(d => d.status === "assigned").length,
      });
    }, (error) => {
      console.error("Stats Listener Error:", error);
    });
    
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error) {
      console.error("Logout Error", error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>System Administrator</Text>
            <Text style={styles.subTitle}>AMPL Fleet Control</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutCircle}>
            <MaterialCommunityIcons name="power" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard 
            title="Total Duties" 
            value={stats.total} 
            icon="clipboard-list-outline" 
            color="#6366f1" 
          />
          <StatCard 
            title="Completed" 
            value={stats.completed} 
            icon="check-decagram-outline" 
            color="#22c55e" 
          />
          <StatCard 
            title="In Progress" 
            value={stats.inProgress} 
            icon="map-clock-outline" 
            color="#f59e0b" 
          />
          <StatCard 
            title="Pending" 
            value={stats.pending} 
            icon="alert-circle-outline" 
            color="#64748b" 
          />
        </View>

        {/* Main Actions Section */}
        <Text style={styles.sectionTitle}>Management Console</Text>
        <View style={styles.actionContainer}>
          
          {/* New Live Tracking Shortcut */}
          <TouchableOpacity 
            style={[styles.mainActionBtn, { backgroundColor: '#0F172A' }]}
            onPress={() => router.push("/(admin)/live-tracking")}
          >
            <MaterialCommunityIcons name="map-marker-radius" size={24} color="#fff" />
            <Text style={styles.actionBtnText}>Live Fleet Tracking</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.mainActionBtn}
            onPress={() => router.push("./assign-duty")}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={24} color="#fff" />
            <Text style={styles.actionBtnText}>Assign New Duty</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
             style={[styles.mainActionBtn, styles.secondaryBtn]}
             onPress={() => router.push("./manage-drivers")}
          >
            <MaterialCommunityIcons name="account-group-outline" size={24} color="#1e293b" />
            <Text style={[styles.actionBtnText, { color: '#1e293b' }]}>Manage Drivers</Text>
          </TouchableOpacity>

        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Reusable Stat Card Component
const StatCard = ({ title, value, icon, color }: any) => (
  <View style={styles.card}>
    <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.cardValue}>{value}</Text>
    <Text style={styles.cardTitle}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    marginTop: 10
  },
  welcomeText: { fontSize: 13, color: "#64748b", fontWeight: "700", textTransform: 'uppercase', letterSpacing: 0.5 },
  subTitle: { fontSize: 26, fontWeight: "bold", color: "#0F172A" },
  logoutCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "#fff",
    width: "48%",
    padding: 20,
    borderRadius: 24,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cardValue: { fontSize: 24, fontWeight: "bold", color: "#1e293b" },
  cardTitle: { fontSize: 12, color: "#64748b", fontWeight: "600", marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#1e293b", marginTop: 20, marginBottom: 15 },
  actionContainer: { gap: 14 },
  mainActionBtn: {
    backgroundColor: "#2563eb",
    flexDirection: "row",
    padding: 20,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    elevation: 2,
  },
  secondaryBtn: {
    backgroundColor: '#fff', 
    borderWidth: 1.5, 
    borderColor: '#e2e8f0',
    elevation: 0,
  },
  actionBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});