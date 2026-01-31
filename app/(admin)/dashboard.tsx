// app/(admin)/dashboard.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface DashboardStats {
  total: number;      // drivers that have at least one task
  active: number;     // drivers with activeStatus="active" and active=true
  inProgress: number; // drivers whose latest task is in-progress
  pending: number;    // drivers whose latest task is assigned
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    active: 0,
    inProgress: 0,
    pending: 0,
  });

  useEffect(() => {
    const qDrivers = query(
      collection(db, "users"),
      where("role", "==", "driver")
    );
    const qTasks = query(
      collection(db, "tasks"),
      orderBy("createdAt", "desc")
    );

    const unsubDrivers = onSnapshot(qDrivers, (_driverSnap) => {
      const unsubTasks = onSnapshot(qTasks, async (taskSnap) => {
        const allTasks = taskSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as any[];

        // Group tasks by driverId
        const tasksByDriver: Record<string, any[]> = {};
        allTasks.forEach((task) => {
          if (!task.driverId) return;
          if (!tasksByDriver[task.driverId]) tasksByDriver[task.driverId] = [];
          tasksByDriver[task.driverId].push(task);
        });

        // Latest task per driver
        const latestTasksPerDriver: { driverId: string; status: string }[] = [];

        Object.keys(tasksByDriver).forEach((driverId) => {
          const driverTasks = tasksByDriver[driverId];

          const sorted = [...driverTasks].sort((a, b) => {
            const aTime = a.createdAt?.toDate
              ? a.createdAt.toDate().getTime()
              : 0;
            const bTime = b.createdAt?.toDate
              ? b.createdAt.toDate().getTime()
              : 0;
            return bTime - aTime;
          });

          const latest = sorted[0];
          if (latest) {
            latestTasksPerDriver.push({
              driverId,
              status: latest.status,
            });
          }
        });

        const total = latestTasksPerDriver.length;
        const inProgress = latestTasksPerDriver.filter(
          (t) => t.status === "in-progress"
        ).length;
        const pending = latestTasksPerDriver.filter(
          (t) => t.status === "assigned"
        ).length;

        // Active drivers from "drivers" collection
        const activeQuery = query(
          collection(db, "drivers"),
          where("activeStatus", "==", "active"),
          where("active", "==", true)
        );
        const activeSnap = await getDocs(activeQuery);
        const active = activeSnap.size;

        setStats({
          total,
          active,
          inProgress,
          pending,
        });
      });

      return () => unsubTasks();
    });

    return () => unsubDrivers();
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
              <View style={styles.pulseWrapper}>
                <View style={styles.pulseOuter} />
                <View style={styles.pulseInner} />
              </View>
              <Text style={styles.statusText}>
                System Live • Admin Portal
              </Text>
            </View>
            <Text style={styles.brandTitle}>
              AMPL <Text style={{ color: "#2563EB" }}>Control</Text>
            </Text>
          </View>

          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
            <View style={styles.logoutIconBox}>
              <MaterialCommunityIcons
                name="logout"
                size={18}
                color="#64748B"
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Tasks"
            value={stats.total}
            icon="account-group-outline"
            color="#6366F1"
            onPress={() =>
              router.push("/(admin)/duty-records?filter=all")
            }
          />
          <StatCard
            title="Active"
            value={stats.active}
            icon="check-circle-outline"
            color="#10B981"
            onPress={() =>
              router.push("/(admin)/duty-records?filter=active")
            }
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon="map-outline"
            color="#F59E0B"
            onPress={() =>
              router.push("/(admin)/duty-records?filter=in-progress")
            }
          />
          <StatCard
            title="Pending"
            value={stats.pending}
            icon="alert-circle-outline"
            color="#64748B"
            onPress={() =>
              router.push("/(admin)/duty-records?filter=assigned")
            }
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
            bordered
            onPress={() => router.push("/(admin)/manage-drivers")}
          />
          <ActionButton
            title="Daywise Report"
            subtitle="Analytics & Exports"
            icon="chart-bar"
            bgColor="#FFFFFF"
            iconColor="#6366F1"
            bordered
            onPress={() => router.push("/(admin)/daywise-report")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* UI COMPONENTS */

function StatCard({
  title,
  value,
  icon,
  color,
  onPress,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
  onPress: () => void;
}) {
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

function ActionButton({
  title,
  subtitle,
  icon,
  bgColor,
  iconColor,
  onPress,
  bordered,
}: {
  title: string;
  subtitle: string;
  icon: string;
  bgColor: string;
  iconColor: string;
  onPress: () => void;
  bordered?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.actionCard,
        { backgroundColor: bgColor },
        bordered && styles.borderedAction,
      ]}
    >
      <View
        style={[
          styles.actionIconBox,
          {
            backgroundColor: bordered
              ? "#F1F5F9"
              : "rgba(255,255,255,0.15)",
          },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={24} color={iconColor} />
      </View>
      <Text
        style={[
          styles.actionTitle,
          { color: bordered ? "#0F172A" : "#FFFFFF" },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.actionSubtitle,
          { color: bordered ? "#64748B" : "rgba(255,255,255,0.6)" },
        ]}
      >
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  gradientBorder: {
    height: 6,
    width: "100%",
    backgroundColor: "#2563EB",
  },
  scrollContent: { padding: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 40,
  },
  statusRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  pulseWrapper: { marginRight: 8 },
  pulseOuter: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    opacity: 0.4,
  },
  pulseInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.5,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
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
  logoutText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginRight: 8,
  },
  logoutIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 40,
  },
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
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statValue: { fontSize: 28, fontWeight: "900", color: "#0F172A" },
  statLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
    marginRight: 12,
  },
  line: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  actionCard: {
    width: "47%",
    padding: 24,
    borderRadius: 32,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
  },
  borderedAction: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 0,
    shadowOpacity: 0,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  actionTitle: { fontSize: 16, fontWeight: "800" },
  actionSubtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
});
