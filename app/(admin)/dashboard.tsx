import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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

  // Keep the exact same real-time filtering logic
  useEffect(() => {
    const q = query(collection(db, "tasks"));
    const unsub = onSnapshot(q, (snapshot) => {
      const today = new Date().toDateString();
      const docs = snapshot.docs.map((d) => d.data());
      
      const todayDocs = docs.filter((d: any) => {
        const taskDate = d.createdAt?.toDate 
            ? d.createdAt.toDate().toDateString() 
            : new Date(d.date).toDateString();
        return taskDate === today;
      });

      setStats({
        total: todayDocs.length,
        completed: todayDocs.filter((d) => d.status === "completed").length,
        inProgress: todayDocs.filter((d) => d.status === "in-progress").length,
        pending: todayDocs.filter((d) => d.status === "assigned").length,
      });
    });

    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Top Gradient Border */}
      <View style={styles.gradientBorder} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <View style={styles.statusRow}>
              <View style={styles.pulseContainer}>
                <View style={styles.pulseDot} />
              </View>
              <Text style={styles.statusText}>SYSTEM LIVE • ADMIN PORTAL</Text>
            </View>
            <Text style={styles.brandTitle}>
              AMPL <Text style={{ color: "#2563EB" }}>Control</Text>
            </Text>
          </View>

          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
            <View style={styles.logoutIconBox}>
              <MaterialCommunityIcons name="logout" size={18} color="#64748B" />
            </View>
          </TouchableOpacity>
        </View>

        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Today's Total"
            value={stats.total}
            icon="check-circle-outline"
            color="#6366F1"
            onPress={() => router.push("/(admin)/duty-records?filter=all")}
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            icon="check-circle"
            color="#10B981"
            onPress={() => router.push("/(admin)/duty-records?filter=completed")}
          />
          <StatCard
            title="In Progress"
            value={stats.map}
            icon="map-outline"
            color="#F59E0B"
            onPress={() => router.push("/(admin)/duty-records?filter=in-progress")}
          />
          <StatCard
            title="Pending"
            value={stats.pending}
            icon="alert-circle-outline"
            color="#64748B"
            onPress={() => router.push("/(admin)/duty-records?filter=assigned")}
          />
        </View>

        <View style={styles.dividerRow}>
          <Text style={styles.sectionTitle}>Management Console</Text>
          <View style={styles.line} />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionGrid}>
          <ActionButton
            title="Live Tracking"
            subtitle="GPS tracking"
            icon="map-marker-radius"
            bgColor="#0F172A"
            iconColor="#60A5FA"
            onPress={() => router.push("/(admin)/live-tracking")}
          />
          <ActionButton
            title="Dispatch Duty"
            subtitle="New tasks"
            icon="plus-circle-outline"
            bgColor="#2563EB"
            iconColor="#FFFFFF"
            onPress={() => router.push("/(admin)/assign-duty")}
          />
          <ActionButton
            title="Manage Drivers"
            subtitle="Personnel records"
            icon="account-group-outline"
            bgColor="#FFFFFF"
            iconColor="#2563EB"
            onPress={() => router.push("/(admin)/manage-drivers")}
            bordered
          />
          <ActionButton
            title="Daywise Report"
            subtitle="Analytics & Exports"
            icon="chart-bar"
            bgColor="#FFFFFF"
            iconColor="#6366F1"
            onPress={() => router.push("/(admin)/daywise-report")}
            bordered
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* UI COMPONENTS */
function StatCard({ title, value, icon, color, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: color + "15" }]}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </TouchableOpacity>
  );
}

function ActionButton({ title, subtitle, icon, bgColor, iconColor, onPress, bordered }: any) {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={[
        styles.actionCard, 
        { backgroundColor: bgColor },
        bordered && styles.borderedAction
      ]}
    >
      <View style={[styles.actionIconBox, { backgroundColor: bordered ? "#F1F5F9" : "rgba(255,255,255,0.15)" }]}>
        <MaterialCommunityIcons name={icon} size={24} color={bordered ? iconColor : iconColor} />
      </View>
      <Text style={[styles.actionTitle, { color: bordered ? "#0F172A" : "#FFFFFF" }]}>{title}</Text>
      <Text style={[styles.actionSubtitle, { color: bordered ? "#64748B" : "rgba(255,255,255,0.6)" }]}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  gradientBorder: {
    height: 6,
    width: "100%",
    backgroundColor: "#2563EB", // Simplified for mobile performance
  },
  scrollContent: { padding: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 40,
  },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  pulseContainer: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E", marginRight: 8 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E", opacity: 0.5 },
  statusText: { fontSize: 10, fontWeight: "900", color: "#94A3B8", letterSpacing: 1.5 },
  brandTitle: { fontSize: 32, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  logoutText: { fontSize: 13, fontWeight: "700", color: "#64748B", marginRight: 8 },
  logoutIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 40 },
  statCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 32,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  statIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  statValue: { fontSize: 28, fontWeight: "900", color: "#0F172A" },
  statLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase", marginTop: 4 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B", marginRight: 12 },
  line: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  actionCard: { width: "47%", padding: 24, borderRadius: 32, marginBottom: 16, elevation: 4, shadowColor: "#000", shadowOpacity: 0.1 },
  borderedAction: { borderWidth: 1, borderColor: "#E2E8F0", elevation: 0, shadowOpacity: 0 },
  actionIconBox: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  actionTitle: { fontSize: 16, fontWeight: "800" },
  actionSubtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
});