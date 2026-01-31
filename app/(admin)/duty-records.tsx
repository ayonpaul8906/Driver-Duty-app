// app/(admin)/duty-records.tsx
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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
  vehicleNumber?: string;
}

export default function DutyRecords() {
  const router = useRouter();
  const { filter } = useLocalSearchParams(); // corresponds to :status in web
  const status = (filter as string) || "all";

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qDrivers = query(
      collection(db, "users"),
      where("role", "==", "driver")
    );
    const qTasks = query(
      collection(db, "tasks"),
      orderBy("createdAt", "desc")
    );
    const driversRef = collection(db, "drivers");

    // Listen to user drivers
    const unsubUsers = onSnapshot(qDrivers, (driverSnap) => {
      const drivers = driverSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
      }));

      // Listen to operational driver docs (activeStatus, active)
      const unsubDriverOps = onSnapshot(driversRef, (opsSnap) => {
        const driverOps: Record<
          string,
          { activeStatus?: string; active?: boolean; vehicleNumber?: string }
        > = {};
        opsSnap.docs.forEach((d) => {
          const data = d.data() as any;
          driverOps[d.id] = {
            activeStatus: data.activeStatus,
            active: data.active,
            vehicleNumber: data.vehicleNumber,
          };
        });

        // Listen to tasks
        const unsubTasks = onSnapshot(qTasks, (taskSnap) => {
          const allTasks = taskSnap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as TaskRecord[];

          // Group tasks by driver
          const tasksByDriver: Record<string, TaskRecord[]> = {};
          allTasks.forEach((task) => {
            if (!task.driverId) return;
            if (!tasksByDriver[task.driverId])
              tasksByDriver[task.driverId] = [];
            tasksByDriver[task.driverId].push(task);
          });

          const latestTasksPerDriver: TaskRecord[] = [];

          Object.keys(tasksByDriver).forEach((driverId) => {
            const driverTasks = tasksByDriver[driverId];

            // Sort latest first
            const sorted = [...driverTasks].sort((a, b) => {
              const aTime = a.createdAt?.toDate
                ? a.createdAt.toDate().getTime()
                : new Date(a.date || "").getTime();
              const bTime = b.createdAt?.toDate
                ? b.createdAt.toDate().getTime()
                : new Date(b.date || "").getTime();
              return bTime - aTime;
            });

            let latestMatch: TaskRecord | undefined;

            if (status === "all") {
              latestMatch = sorted[0];
            } else if (status === "active") {
              // show latest task only for drivers that are active (activeStatus="active", active=true)
              const ops = driverOps[driverId];
              if (ops?.active === true && ops?.activeStatus === "active") {
                latestMatch = sorted[0];
              }
            } else {
              latestMatch = sorted.find((t) => t.status === status);
            }

            if (latestMatch) {
              latestTasksPerDriver.push(latestMatch);
            }
          });

          const withDriverNames = latestTasksPerDriver.map((t) => ({
            ...t,
            driverName: drivers.find((d) => d.id === t.driverId)?.name || "Unknown Driver",
            vehicleNumber: driverOps[t.driverId]?.vehicleNumber || "N/A",
          }));

          setTasks(withDriverNames);
          setLoading(false);  
        });

        return () => unsubTasks();
      });

      return () => unsubDriverOps();
    });

    return () => unsubUsers();
  }, [status]);

  const handleDelete = async (task: TaskRecord) => {
    Alert.alert(
      "Confirm delete",
      `Delete ${task.passenger?.name}'s duty? Driver ${task.driverName} will be set to active.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "tasks", task.id));
              if (task.driverId) {
                const driverRef = doc(db, "drivers", task.driverId);
                await updateDoc(driverRef, {
                  activeStatus: "active",
                });
              }
            } catch (error) {
              console.error("Error during deletion process:", error);
              Alert.alert(
                "Error",
                "Failed to complete deletion. Please check permissions."
              );
            }
          },
        },
      ]
    );
  };

  const filteredTasks = tasks.filter(
    (t) =>
      t.passenger?.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      t.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tourLocation
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  const title =
    status === "all"
      ? "Current Duties"
      : status === "active"
      ? "Latest Active Drivers"
      : `Latest ${status.replace("-", " ")} per Driver`;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topRibbon} />

      <View style={styles.content}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#64748B"
              />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.subTitleRow}>
                <MaterialCommunityIcons
                  name="filter-variant"
                  size={14}
                  color="#2563EB"
                />
                <Text style={styles.subTitle}>
                  DRIVER LATEST TASK BY STATUS
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.counterBadge}>
            <Text style={styles.counterNum}>{filteredTasks.length}</Text>
            <Text style={styles.counterText}>ENTRIES</Text>
          </View>
        </View>

        {/* SEARCH */}
        <View style={styles.searchBox}>
          <MaterialCommunityIcons
            name="magnify"
            size={24}
            color="#94A3B8"
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search records..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* LIST */}
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loaderText}>SYNCING WITH FLEET...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollList}
          >
            {filteredTasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <MaterialCommunityIcons
                    name="filter-variant"
                    size={40}
                    color="#E2E8F0"
                  />
                </View>
                <Text style={styles.emptyText}>ZERO ENTRIES FOUND</Text>
                <Text style={styles.emptySubText}>
                  No duties match your current filter.
                </Text>
              </View>
            ) : (
              filteredTasks.map((task) => (
                <View key={task.id} style={styles.taskCard}>
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.statusBadge,
                        getStatusStyle(task.status),
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(task.status) },
                        ]}
                      >
                        {task.status}
                      </Text>
                    </View>

                    {task.status === "assigned" && (
                      <TouchableOpacity
                        onPress={() => handleDelete(task)}
                        style={styles.deleteBtn}
                      >
                        <MaterialCommunityIcons
                          name="delete-outline"
                          size={22}
                          color="#CBD5E1"
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.cardMain}>
                    <Text style={styles.passengerName}>
                      {task.passenger?.name}
                    </Text>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <MaterialCommunityIcons
                          name="account-group"
                          size={16}
                          color="#2563EB"
                        />
                        <Text style={styles.infoText}>
                          {task.passenger?.heads || 0}
                        </Text>
                      </View>
                      <View style={styles.infoItem}>
                        <MaterialCommunityIcons
                          name="calendar-month"
                          size={16}
                          color="#2563EB"
                        />
                        <Text style={styles.infoText}>
                          {task.tourTime}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.locationBox}>
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={18}
                      color="#EF4444"
                    />
                    <Text style={styles.locationText}>
                      {task.tourLocation}
                    </Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.driverInfo}>
                      <View style={styles.driverAvatar}>
                        <MaterialCommunityIcons
                          name="account-tie"
                          size={20}
                          color="#FFFFFF"
                        />
                      </View>
                      <View>
                        <Text style={styles.footerLabel}>Fleet Driver</Text>
                        <Text style={styles.footerVal}>
                          {task.driverName}
                        </Text>
                        <Text style={[{fontSize:12},{fontWeight:700}, { color: '#2563EB' }]}>
                          <MaterialCommunityIcons
                          name="car-info"
                          size={20}
                          color="#2563EB"
                        />
                          {task.vehicleNumber}
                        </Text>
                      </View>
                    </View>
                    {/* <Text style={styles.idBadge}>
                      ID: {task.id.slice(-6).toUpperCase()}
                    </Text> */}
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

// Helpers for status styling
const getStatusStyle = (status: string) => {
  switch (status) {
    case "completed":
      return { backgroundColor: "#DCFCE7" };
    case "in-progress":
      return { backgroundColor: "#FEF3C7" };
    default:
      return { backgroundColor: "#DBEAFE" };
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "#15803D";
    case "in-progress":
      return "#B45309";
    default:
      return "#1E40AF";
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  topRibbon: { height: 6, backgroundColor: "#2563EB" },
  content: { flex: 1, padding: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 15 },
  backBtn: {
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    textTransform: "capitalize",
  },
  subTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  subTitle: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  counterBadge: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  counterNum: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2563EB",
  },
  counterText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#94A3B8",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    height: 64,
    borderRadius: 20,
    paddingHorizontal: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchIcon: { marginRight: 12 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  loaderBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: {
    marginTop: 10,
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.5,
  },
  scrollList: { paddingBottom: 20 },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  deleteBtn: {
    padding: 6,
  },
  cardMain: { marginBottom: 12 },
  passengerName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  infoRow: { flexDirection: "row", gap: 16, marginTop: 6 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94A3B8",
  },
  locationBox: {
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 14,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  driverInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  footerLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  footerVal: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1E293B",
  },
  idBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyCard: {
    padding: 40,
    borderRadius: 32,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E2E8F0",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  emptySubText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#CBD5E1",
    marginTop: 4,
  },
});
