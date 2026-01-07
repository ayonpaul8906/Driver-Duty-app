import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { signOut } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  increment,
  serverTimestamp
} from "firebase/firestore";
import * as Location from 'expo-location'; // Added for GPS
import { auth, db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import TaskCard from "../../components/TaskCard";
import FormInput from "../../components/FormInput";

export default function DriverDashboard() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverStats, setDriverStats] = useState({ totalKms: 0, completed: 0, pending: 0 });
  
  // Modal & Completion State
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completionData, setCompletionData] = useState({
    openingKm: "",
    closingKm: "",
    fuelQuantity: "",
    amount: "",
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // 1. GPS Tracking Logic
    let locationSubscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission denied');
          return;
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 50, // Update Firebase every 50 meters
          },
          async (location) => {
            const { latitude, longitude } = location.coords;
            const driverRef = doc(db, "drivers", user.uid);
            await updateDoc(driverRef, {
              currentLocation: {
                latitude,
                longitude,
                lastUpdated: serverTimestamp()
              }
            }).catch(err => console.log("GPS sync error:", err));
          }
        );
      } catch (err) {
        console.error("GPS Tracking Error:", err);
      }
    };

    startTracking();

    // 2. Listen to Driver's lifetime stats
    const userRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setDriverStats(prev => ({ 
          ...prev, 
          totalKms: docSnap.data().totalKms || 0 
        }));
      }
    });

    // 3. Listen to Tasks using the unique driverId
    const q = query(
      collection(db, "tasks"), 
      where("driverId", "==", user.uid)
    );

    const unsubTasks = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      const completedCount = taskList.filter(t => t.status === 'completed').length;
      const pendingCount = taskList.filter(t => t.status !== 'completed').length;

      setDriverStats(prev => ({ ...prev, completed: completedCount, pending: pendingCount }));
      
      taskList.sort((a, b) => (a.status === 'completed' ? 1 : -1));
      setTasks(taskList);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubTasks();
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error) {
      Alert.alert("Error", "Failed to logout");
    }
  };

  const handleCompleteTask = async () => {
    const { openingKm, closingKm, fuelQuantity, amount } = completionData;
    if (!openingKm || !closingKm) {
      Alert.alert("Validation Error", "Opening and Closing KM are required.");
      return;
    }

    const open = parseFloat(openingKm);
    const close = parseFloat(closingKm);
    if (close <= open) {
      Alert.alert("Invalid Data", "Closing KM must be greater than Opening KM.");
      return;
    }

    const totalTripKms = close - open;

    try {
      setSubmitting(true);
      const taskRef = doc(db, "tasks", selectedTask.id);
      
      await updateDoc(taskRef, {
        status: "completed",
        openingKm: open,
        closingKm: close,
        fuelQuantity: parseFloat(fuelQuantity) || 0,
        fuelAmount: parseFloat(amount) || 0,
        kilometers: totalTripKms,
        completedAt: serverTimestamp(),
      });

      if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
          totalKms: increment(totalTripKms)
        });

        const driverRef = doc(db, "drivers", auth.currentUser.uid);
        await updateDoc(driverRef, {
          totalKilometers: increment(totalTripKms)
        });
      }

      setModalVisible(false);
      setCompletionData({ openingKm: "", closingKm: "", fuelQuantity: "", amount: "" });
      Alert.alert("Success", "Duty marked as completed!");
    } catch (error) {
      Alert.alert("Error", "Failed to update record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Driver Console</Text>
            <Text style={styles.title}>{auth.currentUser?.displayName || "My Profile"}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
            <View style={styles.statIconCircle}>
              <MaterialCommunityIcons name="map-marker-distance" size={22} color="#4F46E5" />
            </View>
            <Text style={styles.statValue}>{driverStats.totalKms}</Text>
            <Text style={styles.statLabel}>Total Kms</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
            <View style={styles.statIconCircle}>
              <MaterialCommunityIcons name="check-circle" size={22} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{driverStats.completed}</Text>
            <Text style={styles.statLabel}>Finished</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#FFF7ED' }]}>
            <View style={styles.statIconCircle}>
              <MaterialCommunityIcons name="clock-alert" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{driverStats.pending}</Text>
            <Text style={styles.statLabel}>Incomplete</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Task Roster</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
        ) : tasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="car-connected" size={60} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Roster is Empty</Text>
            <Text style={styles.emptySub}>No duties linked to your account yet.</Text>
          </View>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              passenger={task.passenger?.name || task.passengerName}
              pickup={task.pickup}
              drop={task.drop}
              status={task.status}
              onPress={() => {
                if (task.status !== "completed") {
                  setSelectedTask(task);
                  setModalVisible(true);
                }
              }}
            />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Trip Completion</Text>
                <Text style={styles.modalSub}>Update trip logs</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <FormInput
                    label="Opening KM"
                    placeholder="0"
                    keyboardType="numeric"
                    value={completionData.openingKm}
                    onChangeText={(t) => setCompletionData({ ...completionData, openingKm: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormInput
                    label="Closing KM"
                    placeholder="0"
                    keyboardType="numeric"
                    value={completionData.closingKm}
                    onChangeText={(t) => setCompletionData({ ...completionData, closingKm: t })}
                  />
                </View>
              </View>

              <FormInput
                label="Fuel Qty"
                placeholder="Litres"
                keyboardType="numeric"
                value={completionData.fuelQuantity}
                onChangeText={(t) => setCompletionData({ ...completionData, fuelQuantity: t })}
              />

              <FormInput
                label="Amount Paid"
                placeholder="₹"
                keyboardType="numeric"
                value={completionData.amount}
                onChangeText={(t) => setCompletionData({ ...completionData, amount: t })}
              />

              <TouchableOpacity 
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]} 
                onPress={handleCompleteTask}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Confirm Completion</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  container: { padding: 20 },
  header: {
    marginTop: 10,
    marginBottom: 25,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: { fontSize: 12, color: "#64748B", fontWeight: "700", textTransform: "uppercase" },
  title: { fontSize: 26, fontWeight: "bold", color: "#0F172A" },
  logoutBtn: { padding: 10, backgroundColor: "#FEE2E2", borderRadius: 12 },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  statCard: { width: "31%", padding: 15, borderRadius: 20, alignItems: "center", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
  statIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: "bold", color: "#1E293B" },
  statLabel: { fontSize: 10, color: "#64748B", fontWeight: "700", textTransform: "uppercase", marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#1E293B", marginBottom: 15 },
  emptyContainer: { alignItems: "center", marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#475569", marginTop: 15 },
  emptySub: { fontSize: 14, color: "#94A3B8", textAlign: "center", marginTop: 5 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#1E293B" },
  modalSub: { fontSize: 14, color: "#64748B" },
  closeBtn: { padding: 8, backgroundColor: "#F1F5F9", borderRadius: 10 },
  row: { flexDirection: "row" },
  submitBtn: { backgroundColor: "#22C55E", padding: 16, borderRadius: 16, alignItems: "center", marginTop: 20, marginBottom: 20 },
  submitBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});