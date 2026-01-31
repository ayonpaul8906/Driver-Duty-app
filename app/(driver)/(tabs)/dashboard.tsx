import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../../services/firebase";
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from "../../../services/LocationTracker";

type TaskStatus = "assigned" | "in-progress" | "completed";

interface Task {
  id: string;
  tourLocation?: string;
  pickup?: string;
  drop?: string;
  status: TaskStatus;
  passenger?: { name?: string };
  fuelQuantity?: number;
  openingKm?: number;
  completedAt?: any;
  createdAt?: any;
}

type GpsState = "tracking" | "error" | "searching";

export default function DriverDashboard() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [gpsStatus, setGpsStatus] = useState<GpsState>("searching");
  const isInitializing = useRef(false);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stats, setStats] = useState({
    totalKms: 0,
    totalTrips: 0,
    activeDuties: 0,
    totalFuel: 0,
  });

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startingKm, setStartingKm] = useState("");

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completion, setCompletion] = useState({
    closingKm: "",
    fuelQuantity: "",
  });
  const [submitting, setSubmitting] = useState(false);

  /* ============ GPS INITIALIZATION (no always-on foreground watch) ============ */

  const initializeTracking = async () => {
    if (isInitializing.current) return;
    isInitializing.current = true;

    const user = auth.currentUser;
    if (!user) {
      isInitializing.current = false;
      return;
    }

    try {
      setGpsStatus("searching");
      await AsyncStorage.setItem("driver_uid", user.uid);

      // Ensure both foreground & background permissions
      let fg = await Location.getForegroundPermissionsAsync();
      let bg = await Location.getBackgroundPermissionsAsync();

      if (fg.status !== "granted") {
        const fgReq = await Location.requestForegroundPermissionsAsync();
        fg = fgReq;
      }
      if (bg.status !== "granted") {
        const bgReq = await Location.requestBackgroundPermissionsAsync();
        bg = bgReq;
      }

      if (fg.status !== "granted" || bg.status !== "granted") {
        setGpsStatus("error");
        isInitializing.current = false;
        return;
      }

      // Start your background task (TaskManager + startLocationUpdatesAsync inside LocationTracker)
      const result = await startBackgroundTracking(); // "tracking" | "error"
      setGpsStatus(result as GpsState);

      if (result === "tracking") {
        await setDoc(
          doc(db, "drivers", user.uid),
          {
            locationstatus: "online",
            lastUpdated: serverTimestamp(),
          },
          { merge: true },
        );
      }
    } catch (e) {
      setGpsStatus("error");
    } finally {
      setTimeout(() => {
        isInitializing.current = false;
      }, 1500);
    }
  };

  // Run once on mount and when app comes back to foreground
  useEffect(() => {
    if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
    initTimeoutRef.current = setTimeout(initializeTracking, 1000);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = setTimeout(initializeTracking, 1500);
      }
    });

    return () => {
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
      sub.remove();
    };
  }, []);

  /* ============ FIRESTORE DATA: STATS & TASKS ============ */
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setStats((s) => ({
          ...s,
          totalKms: snap.data().totalKms || 0,
        }));
      }
    });

    const q = query(collection(db, "tasks"), where("driverId", "==", user.uid));
    const unsubTasks = onSnapshot(q, (snap) => {
      const list = snap.docs.map(
        (d) =>
          ({
            id: d.id,
            ...(d.data() as Omit<Task, "id">),
          }) as Task,
      );

      const totalTrips = list.length;
      const activeDuties = list.filter(
        (t) => t.status === "assigned" || t.status === "in-progress",
      ).length;
      const totalFuel = list.reduce(
        (acc, curr) => acc + (Number(curr.fuelQuantity) || 0),
        0,
      );

      setStats((s) => ({
        ...s,
        totalTrips,
        activeDuties,
        totalFuel,
      }));
      setTasks(list);
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubTasks();
    };
  }, []);

  /* ============ ACTIONS: START & COMPLETE JOURNEY ============ */

  const handleStartTrip = async () => {
    // Require GPS live before starting
    if (gpsStatus !== "tracking") {
      Alert.alert(
        "GPS Required",
        "Please enable GPS and wait until the system is live before starting a trip.",
      );
      return;
    }

    const currentStart = Number(startingKm);
    const uid = auth.currentUser?.uid;
    if (!startingKm || isNaN(currentStart)) {
      Alert.alert("Validation", "Enter valid starting KM.");
      return;
    }
    if (!selectedTask || !uid) return;

    try {
      const driverRef = doc(db, "drivers", uid);
      const driverSnap = await getDoc(driverRef);
      const lastTripEnd = driverSnap.exists()
        ? driverSnap.data().lastTripEndKm || 0
        : 0;

      if (currentStart < lastTripEnd) {
        Alert.alert(
          "Validation Failed",
          `You entered less KM than last journey (${lastTripEnd} KM).`,
        );
        return;
      }

      // 1. Update task -> in-progress
      await updateDoc(doc(db, "tasks", selectedTask.id), {
        status: "in-progress",
        startedAt: serverTimestamp(),
        openingKm: currentStart,
      });

      // 2. Update driver status
      await updateDoc(driverRef, {
        locationstatus: "online",
        activeStatus: "in-progress",
        active: false,
      });

      // 3. Persist UID for background task
      await AsyncStorage.setItem("driver_uid", uid);

      // 4. Ensure background tracking is running
      const status = await startBackgroundTracking();
      if (status === "error") {
        Alert.alert(
          "Tracking Error",
          "Could not start background tracking. Please check permissions.",
        );
      }

      setShowStartModal(false);
      setStartingKm("");
      setSelectedTask(null);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error starting trip.");
    }
  };

  const handleCompleteJourney = async () => {
    if (!selectedTask) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const close = Number(completion.closingKm);
    const open = selectedTask.openingKm || 0;

    if (!completion.closingKm || isNaN(close)) {
      Alert.alert("Validation", "Please enter valid closing KM.");
      return;
    }
    if (close <= open) {
      Alert.alert(
        "Validation Failed",
        "You have entered less than initialized KM.",
      );
      return;
    }

    try {
      setSubmitting(true);

      const driverRef = doc(db, "drivers", uid);
      const taskRef = doc(db, "tasks", selectedTask.id);
      const userRef = doc(db, "users", uid);
      const kms = close - open;

      // 1. Complete task
      await updateDoc(taskRef, {
        status: "completed",
        closingKm: close,
        fuelQuantity: Number(completion.fuelQuantity) || 0,
        kilometers: kms,
        completedAt: serverTimestamp(),
      });

      // 2. Reset driver status
      await setDoc(
        driverRef,
        {
          activeStatus: "active",
          active: true,
          lastTripEndKm: close,
          totalKilometers: increment(kms),
          locationstatus: "online",
        },
        { merge: true },
      );

      // 3. Update user total kms
      await updateDoc(userRef, { totalKms: increment(kms) });

      // 4. Stop background tracking
      await stopBackgroundTracking();
      await AsyncStorage.removeItem("driver_uid");

      setShowCompleteModal(false);
      setCompletion({ closingKm: "", fuelQuantity: "" });
      setSelectedTask(null);
      Alert.alert("Success", "Journey completed successfully.");
    } catch (e: any) {
      Alert.alert("Sync Error", e.message || "Failed to sync journey.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    const user = auth.currentUser;
    try {
      await stopBackgroundTracking();
      await AsyncStorage.removeItem("driver_uid");

      if (user) {
        await updateDoc(doc(db, "drivers", user.uid), {
          locationstatus: "offline",
        });
      }
      await signOut(auth);
      router.replace("/login");
    } catch (e: any) {
      Alert.alert("Logout Error", e.message || "Failed to logout.");
    }
  };

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const recentCompletedTasks = tasks
    .filter((t) => t.status === "completed")
    .sort((a, b) => {
      const aTime = a.completedAt?.toDate
        ? a.completedAt.toDate().getTime()
        : a.createdAt?.toDate
        ? a.createdAt.toDate().getTime()
        : 0;
      const bTime = b.completedAt?.toDate
        ? b.completedAt.toDate().getTime()
        : b.createdAt?.toDate
        ? b.createdAt.toDate().getTime()
        : 0;
      return bTime - aTime;
    })
    .slice(0, 4);

  /* ============ RENDER ============ */
  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerBar}>
        <View>
          <View style={styles.gpsRow}>
            <TouchableOpacity
              onPress={initializeTracking}
              style={styles.gpsRow}
              disabled={gpsStatus === "tracking"}
            >
              <View
                style={[
                  styles.gpsDot,
                  {
                    backgroundColor:
                      gpsStatus === "tracking"
                        ? "#22C55E"
                        : gpsStatus === "searching"
                        ? "#F59E0B"
                        : "#EF4444",
                  },
                ]}
              />
              <Text
                style={[
                  styles.gpsText,
                  gpsStatus === "tracking"
                    ? { color: "#94A3B8" }
                    : gpsStatus === "searching"
                    ? { color: "#F97316" }
                    : { color: "#FCA5A5" },
                ]}
              >
                {gpsStatus === "tracking"
                  ? "System Live • Tracking"
                  : gpsStatus === "searching"
                  ? "Initializing..."
                  : "GPS Inactive • Tap to Fix"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.brandTitle}>
            AMPL <Text style={{ color: "#2563EB" }}>Driver</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
          <MaterialCommunityIcons
            name="logout-variant"
            size={18}
            color="#DC2626"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* STATS */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="speedometer"
            label="Total KM"
            value={stats.totalKms.toLocaleString()}
            color="#4F46E5"
          />
          <StatCard
            icon="check-circle"
            label="Total Trips"
            value={stats.totalTrips}
            color="#059669"
            onPress={() => router.push("/(driver)/duties/all" as any)}
          />
          <StatCard
            icon="clock-outline"
            label="Active Duties"
            value={stats.activeDuties}
            color="#D97706"
            onPress={() => router.push("/(driver)/duties/active" as any)}
          />
          <StatCard
            icon="gas-station"
            label="Fuel (L)"
            value={stats.totalFuel.toFixed(1)}
            color="#2563EB"
          />
        </View>

        {/* MAIN GRID */}
        <View style={styles.mainGrid}>
          {/* Active Duties */}
          <View style={styles.activeColumn}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#2563EB" />
              </View>
            ) : activeTasks.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No active assignments.</Text>
              </View>
            ) : (
              activeTasks.map((task) => (
                <View key={task.id} style={styles.taskCard}>
                  <View style={styles.taskBody}>
                    <View style={styles.taskTopRow}>
                      <View style={styles.taskAvatar}>
                        <MaterialCommunityIcons
                          name="account"
                          size={24}
                          color="#2563EB"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.taskLabel}>Passenger</Text>
                        <Text style={styles.taskPassenger}>
                          {task.passenger?.name || "Corporate Guest"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          task.status === "in-progress"
                            ? styles.statusInProgress
                            : styles.statusAssigned,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            task.status === "in-progress"
                              ? { color: "#B45309" }
                              : { color: "#1D4ED8" },
                          ]}
                        >
                          {task.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.routeBox}>
                      <View style={styles.routeIconBox}>
                        <MaterialCommunityIcons
                          name="map-marker"
                          size={20}
                          color="#2563EB"
                        />
                      </View>
                      <Text style={styles.routeText}>
                        {task.tourLocation ||
                          `${task.pickup || ""} → ${task.drop || ""}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.taskFooter}>
                    {task.status === "assigned" ? (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTask(task);
                          setShowStartModal(true);
                        }}
                        style={[styles.footerBtn, styles.startBtn]}
                      >
                        <MaterialCommunityIcons
                          name="play-circle"
                          size={20}
                          color="#FFFFFF"
                        />
                        <Text style={styles.footerBtnText}>Start Trip</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTask(task);
                          setShowCompleteModal(true);
                        }}
                        style={[styles.footerBtn, styles.completeBtn]}
                      >
                        <MaterialCommunityIcons
                          name="flag-checkered"
                          size={20}
                          color="#FFFFFF"
                        />
                        <Text style={styles.footerBtnText}>
                          Complete Duty
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* START MODAL */}
      <Modal
        visible={showStartModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowStartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Initialize Trip</Text>
            <View style={{ marginVertical: 20 }}>
              <LogInput
                icon="speedometer"
                label="Start KM"
                value={startingKm}
                onChange={setStartingKm}
              />
            </View>
            <TouchableOpacity
              onPress={handleStartTrip}
              style={[styles.modalBtn, { backgroundColor: "#2563EB" }]}
            >
              <Text style={styles.modalBtnText}>Begin Journey</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* COMPLETE MODAL */}
      <Modal
        visible={showCompleteModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Complete Duty</Text>
            <View style={{ marginVertical: 20 }}>
              <LogInput
                icon="speedometer"
                label="Closing KM"
                value={completion.closingKm}
                onChange={(v: string) =>
                  setCompletion({ ...completion, closingKm: v })
                }
              />
              <View style={{ height: 12 }} />
              <LogInput
                icon="gas-station"
                label="Fuel (Liters)"
                value={completion.fuelQuantity}
                onChange={(v: string) =>
                  setCompletion({ ...completion, fuelQuantity: v })
                }
              />
            </View>
            <TouchableOpacity
              onPress={handleCompleteJourney}
              disabled={submitting}
              style={[
                styles.modalBtn,
                { backgroundColor: "#059669", opacity: submitting ? 0.7 : 1 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalBtnText}>Submit Duty</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* SMALL COMPONENTS */
function StatCard({
  icon,
  label,
  value,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      style={styles.statCard}
    >
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function LogInput({
  icon,
  label,
  value,
  onChange,
}: {
  icon: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.logInputWrapper}>
      <MaterialCommunityIcons
        name={icon as any}
        size={20}
        color="#94A3B8"
        style={{ marginRight: 10 }}
      />
      <TextInput
        placeholder={label}
        keyboardType="numeric"
        value={value}
        onChangeText={onChange}
        style={styles.logInput}
      />
    </View>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  headerBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gpsRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  gpsText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B91C1C",
    marginRight: 6,
  },
  scrollContent: { padding: 20, paddingBottom: 40 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flexBasis: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 2,
  },
  mainGrid: { flexDirection: "row", gap: 16 },
  activeColumn: { flex: 2 },
  logsColumn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignSelf: "flex-start",
  },
  loadingBox: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CBD5F5",
    backgroundColor: "#FFFFFF",
  },
  emptyText: {
    textAlign: "center",
    fontWeight: "700",
    color: "#9CA3AF",
  },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    overflow: "hidden",
  },
  taskBody: { padding: 16 },
  taskTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  taskAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  taskLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  taskPassenger: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusInProgress: { backgroundColor: "#FEF3C7" },
  statusAssigned: { backgroundColor: "#DBEAFE" },
  statusPillText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  routeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#4B5563",
  },
  taskFooter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  footerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 18,
    gap: 6,
  },
  startBtn: { backgroundColor: "#0F172A" },
  completeBtn: { backgroundColor: "#059669" },
  footerBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.6,
  },
  logsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  logsHeaderText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1.6,
  },
  noLogsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#CBD5F5",
  },
  logItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    marginBottom: 8,
    gap: 8,
  },
  logBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  logBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#16A34A",
  },
  logTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },
  logSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  modalBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.6,
  },
  logInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    height: 52,
  },
  logInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
});
