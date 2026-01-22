import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, onSnapshot, query, where, doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Driver {
  id: string;
  name: string;
  email: string;
  phone?: string;
  totalKms?: number;
  status?: "active" | "on-duty" | "offline";
}

export default function ManageDrivers() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Add Driver States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdminVerify, setShowAdminVerify] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adminVerify, setAdminVerify] = useState({ email: "", password: "" });
  const [newDriver, setNewDriver] = useState({
    name: "",
    email: "",
    phone: "",
    vehicleNumber: "",
    password: "",
  });

  /* ================= REAL-TIME DATA LOGIC ================= */
  useEffect(() => {
    const qDrivers = query(collection(db, "users"), where("role", "==", "driver"));
    const tasksRef = collection(db, "tasks");

    const unsubDrivers = onSnapshot(qDrivers, (driverSnap) => {
      const driverList = driverSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];

      const unsubTasks = onSnapshot(tasksRef, (taskSnap) => {
        const taskList = taskSnap.docs.map(d => d.data());
        const processedDrivers = driverList.map(driver => {
          const hasActiveTask = taskList.some(t => 
            t.driverId === driver.id && t.status === 'in-progress'
          );
          return {
            ...driver,
            status: hasActiveTask ? "on-duty" : "active"
          };
        });
        setDrivers(processedDrivers as Driver[]);
        setLoading(false);
      });
      return () => unsubTasks();
    });
    return () => unsubDrivers();
  }, []);

  /* ================= REGISTRATION WORKFLOW ================= */
  const handleAddDriver = () => {
    setShowAdminVerify(true);
  };

  const handleConfirmAddDriver = async () => {
    if (!adminVerify.email || !adminVerify.password) {
      Alert.alert("Error", "Admin credentials required for verification.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Auth User for Driver
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        newDriver.email, 
        newDriver.password
      );
      const uid = userCredential.user.uid;

      // 2. Create User Profile
      await setDoc(doc(db, "users", uid), {
        name: newDriver.name,
        email: newDriver.email,
        phone: newDriver.phone,
        role: "driver",
        totalKms: 0,
        createdAt: new Date(),
      });

      // 3. Create Operational Doc
      await setDoc(doc(db, "drivers", uid), {
        name: newDriver.name,
        vehicleNumber: newDriver.vehicleNumber,
        activeStatus: "active",
        totalKilometers: 0,
        active: true
      });

      // 4. Re-authenticate as Admin
      await signInWithEmailAndPassword(auth, adminVerify.email, adminVerify.password);

      setShowAddModal(false);
      setShowAdminVerify(false);
      setNewDriver({ name: "", email: "", phone: "", vehicleNumber: "", password: "" });
      setAdminVerify({ email: "", password: "" });
      Alert.alert("Success", "Driver registered successfully!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDrivers = drivers.filter((d) =>
    d.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar} />
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#64748B" />
            </TouchableOpacity>
            <View>
              <Text style={styles.brandTitle}>Fleet <Text style={{ color: "#2563EB" }}>Personnel</Text></Text>
              <Text style={styles.brandSub}>REAL-TIME DRIVER DIRECTORY</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addBtn}>
            <MaterialCommunityIcons name="account-plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={22} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            placeholder="Search drivers by name..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* LIST CONTENT */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.syncText}>Syncing Fleet Data...</Text>
          </View>
        ) : filteredDrivers.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="account-group" size={60} color="#E2E8F0" />
            <Text style={styles.emptyTitle}>No personnel found</Text>
            <Text style={styles.emptySub}>No driver matches your search.</Text>
          </View>
        ) : (
          filteredDrivers.map((driver) => (
            <DriverCard 
                key={driver.id} 
                driver={driver} 
                onPress={() => router.push(`/(admin)/driver-profile/${driver.id}` as any)} 
            />
          ))
        )}
      </ScrollView>

      {/* MODAL: ADD DRIVER */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Onboard Driver</Text>
                <Text style={styles.modalSub}>CREATE NEW LOGIN ACCESS</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <ModalInput icon="badge-account" label="Full Name" value={newDriver.name} onChange={(v) => setNewDriver({...newDriver, name: v})} />
              <ModalInput icon="email" label="Email Address" value={newDriver.email} onChange={(v) => setNewDriver({...newDriver, email: v})} keyboardType="email-address" />
              <ModalInput icon="phone" label="Phone Number" value={newDriver.phone} onChange={(v) => setNewDriver({...newDriver, phone: v})} keyboardType="phone-pad" />
              <ModalInput icon="card-account-details" label="License/Vehicle" value={newDriver.vehicleNumber} onChange={(v) => setNewDriver({...newDriver, vehicleNumber: v})} />
              <ModalInput icon="key" label="Password" value={newDriver.password} onChange={(v) => setNewDriver({...newDriver, password: v})} secureTextEntry />

              <TouchableOpacity onPress={handleAddDriver} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>Register Driver</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: ADMIN VERIFICATION */}
      <Modal visible={showAdminVerify} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto', marginBottom: 50 }]}>
            <Text style={styles.modalTitle}>Verify Admin Access</Text>
            <Text style={styles.modalSub}>RE-AUTHENTICATE TO CONTINUE</Text>
            
            <View style={{ marginVertical: 20 }}>
              <ModalInput icon="email" label="Admin Email" value={adminVerify.email} onChange={(v) => setAdminVerify({...adminVerify, email: v})} />
              <ModalInput icon="key" label="Admin Password" value={adminVerify.password} onChange={(v) => setAdminVerify({...adminVerify, password: v})} secureTextEntry />
            </View>

            <View style={styles.flexRow}>
              <TouchableOpacity onPress={() => setShowAdminVerify(false)} style={[styles.flex1, styles.cancelBtn]}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmAddDriver} disabled={submitting} style={[styles.flex1, styles.confirmBtn]}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ================= HELPER COMPONENTS ================= */

function DriverCard({ driver, onPress }: { driver: Driver; onPress: () => void }) {
  const status = driver.status || "active";
  const statusColors = {
    "on-duty": { bg: "#FFFBEB", text: "#B45309", dot: "#F59E0B" },
    "active": { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E" },
    "offline": { bg: "#F8FAFC", text: "#64748B", dot: "#94A3B8" }
  };
  const config = statusColors[status];

  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{driver.name?.charAt(0) || "?"}</Text>
          <View style={[styles.statusDot, { backgroundColor: config.dot }]} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.flexRow}>
            <Text style={styles.driverName}>{driver.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
              <Text style={[styles.statusBadgeText, { color: config.text }]}>{status.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.driverEmail}>{driver.email}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD5E1" />
      </View>
      
      <View style={styles.cardFooter}>
        <View style={styles.flexRow}>
          <MaterialCommunityIcons name="map-marker-distance" size={18} color="#94A3B8" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.footerVal}>{driver.totalKms || 0} KM</Text>
            <Text style={styles.footerLabel}>LIFE MILEAGE</Text>
          </View>
        </View>
        <Text style={styles.historyLink}>HISTORY →</Text>
      </View>
    </TouchableOpacity>
  );
}

function ModalInput({ icon, label, value, onChange, ...props }: any) {
  return (
    <View style={styles.inputWrapper}>
      <MaterialCommunityIcons name={icon} size={20} color="#94A3B8" style={styles.inputIcon} />
      <TextInput
        placeholder={label}
        placeholderTextColor="#CBD5E1"
        style={styles.nativeInput}
        value={value}
        onChangeText={onChange}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  topBar: { height: 6, backgroundColor: "#2563EB" },
  scrollBody: { padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 30 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 15 },
  backBtn: { padding: 10, backgroundColor: "#fff", borderRadius: 12, elevation: 2, shadowOpacity: 0.1 },
  brandTitle: { fontSize: 26, fontWeight: "900", color: "#0F172A" },
  brandSub: { fontSize: 9, fontWeight: "900", color: "#94A3B8", letterSpacing: 1.5, marginTop: 2 },
  addBtn: { width: 48, height: 48, backgroundColor: "#2563EB", borderRadius: 16, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#2563EB", shadowOpacity: 0.3 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 15, height: 60, borderWidth: 1, borderColor: "#E2E8F0", shadowOpacity: 0.05, elevation: 2, marginBottom: 25 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "600", color: "#0F172A" },
  centerBox: { height: 200, alignItems: "center", justifyContent: "center" },
  syncText: { fontSize: 10, fontWeight: "900", color: "#94A3B8", letterSpacing: 1.5, marginTop: 15 },
  emptyCard: { backgroundColor: "#fff", padding: 40, borderRadius: 32, alignItems: "center", borderWidth: 1, borderColor: "#F1F5F9" },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A", marginTop: 15 },
  emptySub: { fontSize: 13, color: "#64748B", marginTop: 5 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: "#F1F5F9", elevation: 2, shadowOpacity: 0.05 },
  cardTop: { flexDirection: "row", alignItems: "center" },
  avatarBox: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", position: "relative" },
  avatarText: { fontSize: 20, fontWeight: "900", color: "#2563EB" },
  statusDot: { width: 14, height: 14, borderRadius: 7, borderWeight: 2, borderColor: "#fff", position: "absolute", bottom: -2, right: -2 },
  cardInfo: { flex: 1, marginLeft: 15 },
  driverName: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  driverEmail: { fontSize: 13, color: "#64748B", marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 10 },
  statusBadgeText: { fontSize: 8, fontWeight: "900" },
  cardFooter: { borderTopWidth: 1, borderColor: "#F8FAFC", marginTop: 15, paddingTop: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerVal: { fontSize: 14, fontWeight: "900", color: "#0F172A" },
  footerLabel: { fontSize: 8, fontWeight: "900", color: "#94A3B8", letterSpacing: 0.5 },
  historyLink: { fontSize: 9, fontWeight: "900", color: "#2563EB", letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  modalTitle: { fontSize: 24, fontWeight: "900", color: "#0F172A" },
  modalSub: { fontSize: 9, fontWeight: "900", color: "#94A3B8", letterSpacing: 1.5 },
  closeBtn: { padding: 5 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 16, paddingHorizontal: 15, height: 56, marginBottom: 12, borderWidth: 1, borderColor: "#F1F5F9" },
  inputIcon: { marginRight: 10 },
  nativeInput: { flex: 1, fontWeight: "700", color: "#0F172A" },
  submitBtn: { backgroundColor: "#2563EB", height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 15, elevation: 4 },
  submitBtnText: { color: "#fff", fontWeight: "900", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" },
  flexRow: { flexDirection: "row", alignItems: "center" },
  flex1: { flex: 1 },
  cancelBtn: { backgroundColor: "#F1F5F9", height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 10 },
  cancelBtnText: { fontWeight: "900", color: "#64748B", fontSize: 12, textTransform: "uppercase" },
  confirmBtn: { backgroundColor: "#2563EB", height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  confirmBtnText: { fontWeight: "900", color: "#fff", fontSize: 12, textTransform: "uppercase" },
});