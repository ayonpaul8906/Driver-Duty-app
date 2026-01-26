import React, { useEffect, useState, useRef } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
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
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../../services/firebase";
import { startBackgroundTracking } from "../../../services/LocationTracker";

/* ================= TYPES & HELPERS ================= */
interface Task {
  id: string;
  tourLocation?: string;
  pickup?: string;
  drop?: string;
  status: "assigned" | "in-progress" | "completed";
  passenger?: { name?: string };
  date?: string;
  createdAt?: any;
  fuelQuantity?: number;
  openingKm?: number;
}

function isToday(task: Task) {
  const today = new Date().toDateString();
  if (task.createdAt?.toDate)
    return task.createdAt.toDate().toDateString() === today;
  if (task.date) return new Date(task.date).toDateString() === today;
  return false;
}

export default function DriverDashboard() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalKms: 0,
    completed: 0,
    pending: 0,
    totalFuel: 0,
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startingKm, setStartingKm] = useState("");
  const [gpsStatus, setGpsStatus] = useState<
    "tracking" | "error" | "searching"
  >("searching");
  const isInitializing = useRef(false);

  const [completion, setCompletion] = useState({
    closingKm: "",
    fuelQuantity: "",
    amount: "",
  });

  /* ================= LIVE LOCATION TRACKING ================= */

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

    // Optional quick check
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    if (fg.status !== "granted" || bg.status !== "granted") {
      console.log("Permissions missing, requesting...");
    }

    const result = await startBackgroundTracking();
    setGpsStatus(result as any);

    // ✅ use result instead of gpsStatus
    if (result === "tracking") {
      await setDoc(
        doc(db, "drivers", user.uid),
        {
          locationstatus: "online",
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (e) {
    console.error("Critical GPS Error:", e);
    setGpsStatus("error");
  } finally {
    setTimeout(() => {
      isInitializing.current = false;
    }, 1500);
  }
};


const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


useEffect(() => {
  // Initial run
  initTimeoutRef.current && clearTimeout(initTimeoutRef.current);
  initTimeoutRef.current = setTimeout(initializeTracking, 1000);

  const subscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      initTimeoutRef.current && clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = setTimeout(initializeTracking, 1500);
    }
  });

  return () => {
    if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
    subscription.remove();
  };
}, []);


  /* ================= DATA FETCHING ================= */
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setStats((s) => ({ ...s, totalKms: snap.data().totalKms || 0 }));
      }
    });

    const q = query(collection(db, "tasks"), where("driverId", "==", user.uid));
    const unsubTasks = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Task[];
      const completed = list.filter((t) => t.status === "completed").length;
      const pending = list.filter((t) => t.status !== "completed").length;
      const totalFuel = list.reduce(
        (acc, curr) => acc + (Number(curr.fuelQuantity) || 0),
        0,
      );

      setStats((s) => ({ ...s, completed, pending, totalFuel }));
      setTasks(list);
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubTasks();
    };
  }, []);

  /* ================= ACTIONS ================= */

  const handleStartTrip = async () => {
    const currentStart = Number(startingKm);
    const uid = auth.currentUser?.uid;

    if (!startingKm || isNaN(currentStart)) {
      Alert.alert("Input Error", "Please enter a valid numeric value.");
      return;
    }
    if (!selectedTask) return;
    if (!uid) return;

    try {
      const driverRef = doc(db, "drivers", uid);
      const driverSnap = await getDoc(driverRef);
      const lastTripEnd = driverSnap.exists()
        ? driverSnap.data().lastTripEndKm || 0
        : 0;

      // 🔥 ALERT 1: If Start KM < Last Journey's End KM
      if (currentStart < lastTripEnd) {
        Alert.alert(
          "Validation Failed",
          "You have entered less km than last journey", // Your specific message
          [{ text: "Fix Input" }],
        );
        return;
      }

      // Proceed if valid
      await updateDoc(doc(db, "tasks", selectedTask.id), {
        status: "in-progress",
        startedAt: serverTimestamp(),
        openingKm: currentStart,
      });

      await setDoc(
        driverRef,
        {
          activeStatus: "in-progress",
          active: false,
          locationstatus: "online",
        },
        { merge: true },
      );

      setShowStartModal(false);
      setStartingKm("");
      setSelectedTask(null);
    } catch (e: any) {
      Alert.alert("Sync Error", e.message);
    }
  };

  const completeJourney = async () => {
    if (!selectedTask) return;
    const uid = auth.currentUser?.uid;
    const close = Number(completion.closingKm);
    const open = selectedTask.openingKm || 0;

    if (isNaN(close)) {
      Alert.alert("Input Error", "Please enter valid closing KM.");
      return;
    }

    // 🔥 ALERT 2: If Closing KM < Starting (Initialize) KM
    if (close <= open) {
      Alert.alert(
        "Validation Failed",
        "You have entered less than initialize km", // Your specific message
        [{ text: "Fix Input" }],
      );
      return;
    }

    if (!uid) return;

    try {
      const driverRef = doc(db, "drivers", uid);
      const taskRef = doc(db, "tasks", selectedTask.id);
      const userRef = doc(db, "users", uid);
      const kms = close - open;

      await updateDoc(taskRef, {
        status: "completed",
        closingKm: close,
        fuelQuantity: Number(completion.fuelQuantity) || 0,
        fuelAmount: Number(completion.amount) || 0,
        kilometers: kms,
        completedAt: serverTimestamp(),
      });

      await setDoc(
        driverRef,
        {
          activeStatus: "active",
          active: true,
          lastTripEndKm: close,
          totalKilometers: increment(kms),
        },
        { merge: true },
      );

      await updateDoc(userRef, { totalKms: increment(kms) });

      setShowModal(false);
      setCompletion({ closingKm: "", fuelQuantity: "", amount: "" });
      setSelectedTask(null);
      Alert.alert("Success", "Journey completed successfully!");
    } catch (e: any) {
      Alert.alert("Sync Error", e.message);
    }
  };

  const handleLogout = async () => {
    const user = auth.currentUser;
    if (user) {
      await updateDoc(doc(db, "drivers", user.uid), {
        locationstatus: "offline",
      });
    }
    await signOut(auth);
    router.replace("/");
  };

  const handleNavigate = (destination?: string) => {
    if (!destination) {
      Alert.alert("Error", "No destination address found.");
      return;
    }
    // Deep links into the Google Maps app
    const url = `http://maps.google.com/maps?daddr=${encodeURIComponent(destination)}`;
    Linking.openURL(url);
  };

  const todayTasks = tasks.filter(
    (t) => isToday(t) && t.status !== "completed",
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <View style={styles.gpsRow}>
            <TouchableOpacity
              onPress={initializeTracking}
              style={styles.gpsRow}
              disabled={gpsStatus === "tracking"} // Disable if already live
            >
              <View
                style={[
                  styles.pulse,
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
              <Text style={styles.gpsText}>
                {gpsStatus === "tracking"
                  ? "SYSTEM LIVE • TRACKING"
                  : gpsStatus === "searching"
                    ? "INITIALIZING..."
                    : "GPS INACTIVE • TAP TO FIX"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.brandText}>
            AMPL <Text style={{ color: "#2563EB" }}>Driver</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
          <MaterialCommunityIcons name="logout" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}
      >
        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Total KM"
            value={stats.totalKms}
            icon="speedometer"
            color="#6366F1"
          />
          <StatCard
            label="Finished"
            value={stats.completed}
            icon="check-circle"
            color="#10B981"
          />
          <StatCard
            label="Upcoming"
            value={stats.pending}
            icon="clock-outline"
            color="#F59E0B"
          />
          <StatCard
            label="Fuel (L)"
            value={stats.totalFuel.toFixed(1)}
            icon="gas-station"
            color="#2563EB"
          />
        </View>

        <Text style={styles.sectionTitle}>TODAY'S Tasks</Text>

        {loading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 50 }} />
        ) : todayTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No active tasks for today.</Text>
          </View>
        ) : (
          todayTasks.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskInner}>
                <View style={styles.taskHeader}>
                  <View style={styles.passengerRow}>
                    <View style={styles.pIcon}>
                      <MaterialCommunityIcons
                        name="account"
                        size={24}
                        color="#2563EB"
                      />
                    </View>
                    <View>
                      <Text style={styles.labelSmall}>PASSENGER</Text>
                      <Text style={styles.pName}>
                        {task.passenger?.name || "Corporate Guest"}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          task.status === "in-progress" ? "#FEF3C7" : "#DBEAFE",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            task.status === "in-progress"
                              ? "#B45309"
                              : "#1E40AF",
                        },
                      ]}
                    >
                      {task.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationBox}>
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={styles.locText}>
                    {task.tourLocation || `${task.pickup} → ${task.drop}`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor:
                      task.status === "assigned" ? "#0F172A" : "#10B981",
                  },
                ]}
                onPress={() => {
                  setSelectedTask(task);
                  task.status === "assigned"
                    ? setShowStartModal(true)
                    : setShowModal(true);
                }}
              >
                <MaterialCommunityIcons
                  name={task.status === "assigned" ? "play" : "flag"}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.actionBtnText}>
                  {task.status === "assigned" ? "START TRIP" : "COMPLETE DUTY"}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* START MODAL */}
      <Modal visible={showStartModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Initialize Trip</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="speedometer"
                size={20}
                color="#CBD5E1"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Start KM"
                style={styles.input}
                keyboardType="numeric"
                value={startingKm}
                onChangeText={setStartingKm}
              />
            </View>
            <TouchableOpacity
              style={styles.modalSubmit}
              onPress={handleStartTrip}
            >
              <Text style={styles.modalSubmitText}>BEGIN JOURNEY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowStartModal(false)}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* COMPLETION MODAL */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Complete Duty</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="speedometer"
                size={20}
                color="#CBD5E1"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Closing KM"
                style={styles.input}
                keyboardType="numeric"
                value={completion.closingKm}
                onChangeText={(v) =>
                  setCompletion({ ...completion, closingKm: v })
                }
              />
            </View>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="gas-station"
                size={20}
                color="#CBD5E1"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Fuel (Liters)"
                style={styles.input}
                keyboardType="numeric"
                value={completion.fuelQuantity}
                onChangeText={(v) =>
                  setCompletion({ ...completion, fuelQuantity: v })
                }
              />
            </View>
            <TouchableOpacity
              style={[styles.modalSubmit, { backgroundColor: "#10B981" }]}
              onPress={completeJourney}
            >
              <Text style={styles.modalSubmitText}>SUBMIT DUTY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: color + "15" }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingHorizontal: 25,
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  gpsRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  pulse: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  gpsText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  brandText: { fontSize: 24, fontWeight: "900", color: "#0F172A" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  logoutText: { fontWeight: "700", color: "#64748B", marginRight: 8 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 24,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statValue: { fontSize: 22, fontWeight: "900", color: "#0F172A" },
  statLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 2,
    marginBottom: 15,
    marginLeft: 5,
  },
  emptyCard: {
    padding: 40,
    borderRadius: 30,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    alignItems: "center",
  },
  emptyText: { color: "#94A3B8", fontWeight: "700" },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
    marginBottom: 20,
  },
  taskInner: { padding: 25 },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  passengerRow: { flexDirection: "row", alignItems: "center" },
  pIcon: {
    width: 48,
    height: 48,
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  labelSmall: { fontSize: 9, fontWeight: "900", color: "#94A3B8" },
  pName: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 9, fontWeight: "900" },
  locationBox: {
    backgroundColor: "#F8FAFC",
    padding: 15,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  locText: {
    flex: 1,
    marginLeft: 10,
    fontWeight: "700",
    color: "#475569",
    fontSize: 14,
  },
  actionBtn: {
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 2,
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "center",
    padding: 25,
  },
  modalBody: { backgroundColor: "#fff", borderRadius: 40, padding: 30 },
  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 25,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    paddingHorizontal: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 18, fontWeight: "700", color: "#1E293B" },
  modalSubmit: {
    backgroundColor: "#2563EB",
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 10,
  },
  modalSubmitText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 2,
  },
  cancelBtn: { marginTop: 15, alignItems: "center" },
  cancelText: { color: "#94A3B8", fontWeight: "700" },
});
