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
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  setDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Driver {
  id: string;
  name: string;
  email: string;
  phone?: string;
  totalKms?: number;
  status?: "active" | "assigned" | "in-progress" | "offline";
}

export default function ManageDrivers() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Add Driver states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdminVerify, setShowAdminVerify] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adminVerify, setAdminVerify] = useState({
    email: "",
    password: "",
  });
  const [newDriver, setNewDriver] = useState({
    name: "",
    email: "",
    phone: "",
    vehicleNumber: "",
    password: "",
  });

  /* ============ REAL-TIME DATA (users + drivers ops) ============ */
  useEffect(() => {
    const qUsers = query(
      collection(db, "users"),
      where("role", "==", "driver")
    );
    const driversRef = collection(db, "drivers");

    // Listen to user profiles
    const unsubUsers = onSnapshot(qUsers, (userSnap) => {
      const userList = userSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Driver, "id" | "status">),
      }));

      // Listen to driver operational docs
      const unsubOps = onSnapshot(driversRef, (opsSnap) => {
        const opsById: Record<
          string,
          { activeStatus?: string; active?: boolean }
        > = {};

        opsSnap.docs.forEach((d) => {
          const data = d.data() as any;
          opsById[d.id] = {
            activeStatus: data.activeStatus,
            active: data.active,
          };
        });

        const processedDrivers: Driver[] = userList.map((user) => {
          const ops = opsById[user.id] || {};
          let status: Driver["status"] = "offline";

          // Same rules as web:
          // active = true,  activeStatus = "assigned"    -> assigned
          // active = false, activeStatus = "in-progress" -> in-progress
          // active = true,  activeStatus = "active"      -> active
          if (ops.active === true && ops.activeStatus === "assigned") {
            status = "assigned";
          } else if (
            ops.active === false &&
            ops.activeStatus === "in-progress"
          ) {
            status = "in-progress";
          } else if (ops.active === true && ops.activeStatus === "active") {
            status = "active";
          }

          return {
            ...user,
            status,
          };
        });

        setDrivers(processedDrivers);
        setLoading(false);
      });

      return () => unsubOps();
    });

    return () => unsubUsers();
  }, []);

  /* ============ REGISTRATION FLOW (2-step like web) ============ */

  const handleAddDriverPress = () => {
    // First submit: open admin verify modal
    setShowAdminVerify(true);
  };

  const handleConfirmAddDriver = async () => {
    if (!adminVerify.email || !adminVerify.password) {
      Alert.alert("Error", "Admin credentials required for verification.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Auth user for driver
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newDriver.email,
        newDriver.password
      );
      const uid = userCredential.user.uid;

      // 2. Create user profile (users)
      await setDoc(doc(db, "users", uid), {
        name: newDriver.name,
        email: newDriver.email,
        phone: newDriver.phone,
        role: "driver",
        totalKms: 0,
        createdAt: new Date(),
      });

      // 3. Create driver operational doc (drivers)
      await setDoc(doc(db, "drivers", uid), {
        name: newDriver.name,
        vehicleNumber: newDriver.vehicleNumber,
        activeStatus: "active",
        totalKilometers: 0,
        active: true,
        contact: newDriver.phone,
      });

      // 4. Re-authenticate admin
      await signInWithEmailAndPassword(
        auth,
        adminVerify.email,
        adminVerify.password
      );

      // Reset state
      setShowAddModal(false);
      setShowAdminVerify(false);
      setNewDriver({
        name: "",
        email: "",
        phone: "",
        vehicleNumber: "",
        password: "",
      });
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

  /* ============================= RENDER ============================= */

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar} />
      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
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
              <Text style={styles.brandTitle}>
                Fleet <Text style={{ color: "#2563EB" }}>Personnel</Text>
              </Text>
              <Text style={styles.brandSub}>
                REAL-TIME DRIVER DIRECTORY
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={styles.addBtn}
          >
            <MaterialCommunityIcons
              name="account-plus"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color="#94A3B8"
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search drivers by name..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* CONTENT */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.syncText}>Syncing Fleet Data...</Text>
          </View>
        ) : filteredDrivers.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="account-group"
              size={60}
              color="#E2E8F0"
            />
            <Text style={styles.emptyTitle}>No personnel found</Text>
            <Text style={styles.emptySub}>
              No driver matches your current search.
            </Text>
          </View>
        ) : (
          <View>
            {filteredDrivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                onPress={() =>
                  router.push(
                    `/(admin)/driver-profile/${driver.id}` as any
                  )
                }
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* MODAL: ADD DRIVER (step 1) */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Onboard Driver</Text>
                <Text style={styles.modalSub}>
                  CREATE NEW LOGIN ACCESS
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.closeBtn}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <ModalInput
                icon="badge-account"
                label="Full Name"
                value={newDriver.name}
                onChange={(v: string) =>
                  setNewDriver({ ...newDriver, name: v })
                }
              />
              <ModalInput
                icon="email"
                label="Email Address"
                value={newDriver.email}
                onChange={(v: string) =>
                  setNewDriver({ ...newDriver, email: v })
                }
                keyboardType="email-address"
              />
              <ModalInput
                icon="phone"
                label="Phone Number"
                value={newDriver.phone}
                onChange={(v: string) =>
                  setNewDriver({ ...newDriver, phone: v })
                }
                keyboardType="phone-pad"
              />
              <ModalInput
                icon="card-account-details"
                label="License Number"
                value={newDriver.vehicleNumber}
                onChange={(v: string) =>
                  setNewDriver({
                    ...newDriver,
                    vehicleNumber: v,
                  })
                }
              />
              <ModalInput
                icon="key"
                label="Login Password"
                value={newDriver.password}
                onChange={(v: string) =>
                  setNewDriver({ ...newDriver, password: v })
                }
                secureTextEntry
              />

              <TouchableOpacity
                onPress={handleAddDriverPress}
                style={styles.submitBtn}
              >
                <Text style={styles.submitBtnText}>
                  Register Driver
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: ADMIN VERIFICATION (step 2) */}
      <Modal visible={showAdminVerify} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalVerifyContent}>
            <View style={{ marginBottom: 24 }}>
              <Text style={styles.modalTitle}>
                Verify Admin Access
              </Text>
              <Text style={styles.modalSub}>
                ENTER YOUR CREDENTIALS TO CONTINUE
              </Text>
            </View>

            <ModalInput
              icon="email"
              label="Admin Email"
              value={adminVerify.email}
              onChange={(v: string) =>
                setAdminVerify({ ...adminVerify, email: v })
              }
              keyboardType="email-address"
            />
            <ModalInput
              icon="key"
              label="Admin Password"
              value={adminVerify.password}
              onChange={(v: string) =>
                setAdminVerify({
                  ...adminVerify,
                  password: v,
                })
              }
              secureTextEntry
            />

            <View style={styles.verifyButtonsRow}>
              <TouchableOpacity
                onPress={() => {
                  setShowAdminVerify(false);
                  setAdminVerify({ email: "", password: "" });
                }}
                style={[styles.verifyBtn, styles.cancelBtn]}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmAddDriver}
                disabled={submitting}
                style={[styles.verifyBtn, styles.confirmBtn]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ================= HELPER COMPONENTS ================= */

function DriverCard({
  driver,
  onPress,
}: {
  driver: Driver;
  onPress: () => void;
}) {
  const status = driver.status || "offline";

  const statusConfig: any = {
    "in-progress": {
      bg: "#FEF3C7",
      text: "#B45309",
      dot: "#F59E0B",
      border: "#FDE68A",
    },
    assigned: {
      bg: "#DBEAFE",
      text: "#1D4ED8",
      dot: "#3B82F6",
      border: "#BFDBFE",
    },
    active: {
      bg: "#DCFCE7",
      text: "#15803D",
      dot: "#22C55E",
      border: "#BBF7D0",
    },
    offline: {
      bg: "#F8FAFC",
      text: "#64748B",
      dot: "#94A3B8",
      border: "#E2E8F0",
    },
  };

  const currentStatus = statusConfig[status] || statusConfig["offline"];

  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {driver.name?.charAt(0) || "?"}
            </Text>
          </View>
          <View
            style={[
              styles.avatarStatusDot,
              { backgroundColor: currentStatus.dot },
            ]}
          />
        </View>

        <View style={styles.cardInfo}>
          <View style={styles.cardInfoRow}>
            <Text style={styles.driverName}>{driver.name}</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: currentStatus.bg,
                  borderColor: currentStatus.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="circle"
                size={8}
                color={currentStatus.text}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: currentStatus.text },
                ]}
              >
                {status}
              </Text>
            </View>
          </View>
          <Text style={styles.driverEmail}>{driver.email}</Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color="#CBD5E1"
        />
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerLeftRow}>
          <MaterialCommunityIcons
            name="map-marker-distance"
            size={18}
            color="#94A3B8"
          />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.footerVal}>
              {driver.totalKms || 0} KM
            </Text>
            <Text style={styles.footerLabel}>LIFE MILEAGE</Text>
          </View>
        </View>
        <Text style={styles.historyLink}>View Driver History →</Text>
      </View>
    </TouchableOpacity>
  );
}

function ModalInput({
  icon,
  label,
  value,
  onChange,
  ...props
}: {
  icon: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  [key: string]: any;
}) {
  return (
    <View style={styles.inputWrapper}>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color="#94A3B8"
        style={styles.inputIcon}
      />
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

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  topBar: { height: 6, backgroundColor: "#2563EB" },
  scrollBody: { padding: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 15 },
  backBtn: {
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  brandTitle: { fontSize: 26, fontWeight: "900", color: "#0F172A" },
  brandSub: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#2563EB",
    borderRadius: 16,
    shadowColor: "#2563EB",
    shadowOpacity: 0.25,
    elevation: 4,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 6,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 60,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowOpacity: 0.05,
    elevation: 2,
    marginBottom: 25,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  centerBox: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  syncText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.5,
    marginTop: 15,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 40,
    borderRadius: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 15,
  },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 5,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 2,
    shadowOpacity: 0.05,
  },
  cardTop: { flexDirection: "row", alignItems: "center" },
  avatarWrapper: { marginRight: 14 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  avatarText: { fontSize: 20, fontWeight: "900", color: "#2563EB" },
  avatarStatusDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    right: -2,
    bottom: -2,
  },
  cardInfo: { flex: 1 },
  cardInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  driverName: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  driverEmail: { fontSize: 13, color: "#64748B" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 8,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
    marginTop: 14,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeftRow: { flexDirection: "row", alignItems: "center" },
  footerVal: { fontSize: 14, fontWeight: "900", color: "#0F172A" },
  footerLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  historyLink: {
    fontSize: 10,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "flex-end",
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 30,
    maxHeight: "90%",
  },
  modalVerifyContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 24,
    width: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  modalTitle: { fontSize: 24, fontWeight: "900", color: "#0F172A" },
  modalSub: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  closeBtn: { padding: 4 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 56,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  inputIcon: { marginRight: 10 },
  nativeInput: {
    flex: 1,
    fontWeight: "700",
    color: "#0F172A",
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: "#2563EB",
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    shadowColor: "#2563EB",
    shadowOpacity: 0.4,
    elevation: 4,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  verifyButtonsRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 10,
  },
  verifyBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "#F1F5F9",
  },
  confirmBtn: {
    backgroundColor: "#2563EB",
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
