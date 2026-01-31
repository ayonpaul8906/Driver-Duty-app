// app/(admin)/assign-duty.tsx
import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Dropdown } from "react-native-element-dropdown";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Linking from "expo-linking";

/* ================= STATIC OPTIONS ================= */
const DESIGNATIONS = [
  { label: "Advisor", value: "Advisor" },
  { label: "HOD", value: "HOD" },
  { label: "Senior Manager", value: "Senior Manager" },
  { label: "Manager", value: "Manager" },
  { label: "Asst Manager", value: "Asst Manager" },
  { label: "Executive", value: "Executive" },
];

const DEPARTMENTS = [
  { label: "Operation", value: "Operation" },
  { label: "Civil", value: "Civil" },
  { label: "HR", value: "HR" },
  { label: "Admin", value: "Admin" },
  { label: "Survey", value: "Survey" },
  { label: "HSD", value: "HSD" },
  { label: "Accounts", value: "Accounts" },
];

/* ================= WHATSAPP HELPER ================= */
const buildWhatsAppUrl = (driverPhone: string, taskDetails: any) => {
  const cleanPhone = driverPhone.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("91")
    ? cleanPhone
    : `91${cleanPhone}`;

  const message =
    "🚀 *NEW DUTY ASSIGNED*%0A%0A" +
    `*Passenger:* ${taskDetails.passenger}%0A` +
    `*Destination:* ${taskDetails.location}%0A` +
    `*Reporting Date:* ${taskDetails.date}%0A` +
    `*Reporting Time:* ${taskDetails.time}%0A` +
    `*Instructions:* ${taskDetails.notes || "N/A"}%0A%0A` +
    "_Please open the AMPL Driver App to begin your journey._";

  return `https://wa.me/${formattedPhone}?text=${message}`;
};

export default function AssignDuty() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingDrivers, setFetchingDrivers] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [drivers, setDrivers] = useState<{ label: string; value: string }[]>(
    []
  );

  // Date/Time Picker State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const [dutyData, setDutyData] = useState({
    driverId: "",
    driverName: "",
    tourLocation: "",
    date: "",
    time: "",
    notes: "",
  });

  const [passenger, setPassenger] = useState({
    name: "",
    heads: "",
    designation: "",
    department: "",
    contact: "",
  });

  const today = new Date();

  /* ================= FETCH ACTIVE DRIVERS ================= */
  useEffect(() => {
    async function fetchDrivers() {
      try {
        const q = query(
          collection(db, "drivers"),
          where("active", "==", true),
          where("activeStatus", "==", "active")
        );
        const snap = await getDocs(q);
        setDrivers(
          snap.docs.map((d) => ({
            label: d.data().name || "Unnamed Driver",
            value: d.id,
          }))
        );
      } catch (e) {
        Alert.alert("Sync Error", "Could not fetch fleet data.");
      } finally {
        setFetchingDrivers(false);
      }
    }
    fetchDrivers();
  }, []);

  /* ================= DATE/TIME PICKERS ================= */
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDutyData({
        ...dutyData,
        date: selectedDate.toISOString().split("T")[0],
      });
      setTempDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setTempDate(selectedTime);
      const hours = selectedTime.getHours().toString().padStart(2, "0");
      const mins = selectedTime.getMinutes().toString().padStart(2, "0");
      setDutyData({ ...dutyData, time: `${hours}:${mins}` });
    }
  };

  /* ================= PASSENGER VALIDATION ================= */
  const validatePassenger = () => {
    const errs: string[] = [];
    if (!passenger.name) errs.push("Passenger name");
    if (
      !passenger.heads ||
      isNaN(Number(passenger.heads)) ||
      Number(passenger.heads) < 1
    )
      errs.push("Number of heads (>=1)");
    if (!passenger.designation) errs.push("Designation");
    if (!passenger.department) errs.push("Department");
    if (!passenger.contact) errs.push("Contact (10 digits)");
    if (passenger.contact && !/^\d{10}$/.test(passenger.contact))
      errs.push("Contact must be 10 digits");

    if (errs.length > 0) {
      Alert.alert("Fix these fields", errs.join(", "));
      return false;
    }
    return true;
  };

  const handleSavePassenger = () => {
    if (!validatePassenger()) return;
    setModalOpen(false);
  };

  /* ================= ASSIGN DUTY ================= */
  async function handleAssign() {
    const errors: string[] = [];
    if (!dutyData.driverId) errors.push("Driver");
    if (!passenger.name) errors.push("Passenger name");
    if (!dutyData.tourLocation) errors.push("Tour location");
    if (!dutyData.date) errors.push("Tour date");
    if (!dutyData.time) errors.push("Tour time");

    if (errors.length > 0) {
      Alert.alert("Missing info", errors.join(", "));
      return;
    }

    try {
      setLoading(true);

      // Build tourDateTime object (similar to web)
      let tourDateTime: Date | null = null;
      if (dutyData.date && dutyData.time) {
        const iso = `${dutyData.date}T${dutyData.time}`;
        const parsed = new Date(iso);
        if (!isNaN(parsed.getTime())) {
          tourDateTime = parsed;
        }
      }

      const payload: any = {
        driverId: dutyData.driverId,
        driverName: dutyData.driverName,
        tourLocation: dutyData.tourLocation,
        notes: dutyData.notes,
        passenger: { ...passenger, heads: Number(passenger.heads) || 0 },
        status: "assigned",
        kilometers: 0,
        createdAt: serverTimestamp(),
      };

      if (dutyData.date) payload.tourDate = dutyData.date;
      if (dutyData.time) payload.tourTime = dutyData.time;
      if (tourDateTime) payload.tourDateTime = tourDateTime;

      await addDoc(collection(db, "tasks"), payload);
      await updateDoc(doc(db, "drivers", dutyData.driverId), {
        activeStatus: "assigned",
      });

      // Optional: open WhatsApp (if you store driver phone under drivers.contact)
      // Commented out by default; uncomment once you have the phone number loaded.
      /*
      const driverSnap = await getDoc(doc(db, "drivers", dutyData.driverId));
      const driverPhone = driverSnap.data()?.contact;
      if (driverPhone) {
        const waUrl = buildWhatsAppUrl(driverPhone, {
          passenger: passenger.name,
          location: dutyData.tourLocation,
          date: dutyData.date,
          time: dutyData.time,
          notes: dutyData.notes,
        });
        const canOpen = await Linking.canOpenURL(waUrl);
        if (canOpen) {
          await Linking.openURL(waUrl);
        } else {
          Alert.alert("WhatsApp", "Cannot open WhatsApp on this device.");
        }
      }
      */

      Alert.alert("Success", "Duty assigned successfully.");
      router.back();
    } catch (e) {
      Alert.alert("Error", "Failed to assign duty.");
    } finally {
      setLoading(false);
    }
  }

  /* ================= RENDER ================= */
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={28}
              color="#0F172A"
            />
          </TouchableOpacity>
          <View>
            <Text style={styles.brandTitle}>
              Dispatch <Text style={{ color: "#2563EB" }}>Console</Text>
            </Text>
            <Text style={styles.brandSub}>ASSIGNMENT PORTAL</Text>
          </View>
        </View>

        {/* MAIN CARD */}
        <View style={styles.card}>
          <Text style={styles.label}>Vehicle Operator</Text>
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.placeholder}
            selectedTextStyle={styles.selectedText}
            data={drivers}
            labelField="label"
            valueField="value"
            placeholder={
              fetchingDrivers ? "Syncing Fleet Data..." : "Select Available Driver"
            }
            value={dutyData.driverId}
            onChange={(item) =>
              setDutyData({
                ...dutyData,
                driverId: item.value,
                driverName: item.label,
              })
            }
            renderLeftIcon={() => (
              <MaterialCommunityIcons
                style={{ marginRight: 10 }}
                name="steering"
                size={20}
                color="#2563EB"
              />
            )}
          />

          {/* PASSENGER TOGGLE */}
          <TouchableOpacity
            onPress={() => setModalOpen(true)}
            style={styles.passengerToggle}
          >
            <View style={styles.row}>
              <View style={styles.pIconBox}>
                <MaterialCommunityIcons
                  name="account-tie"
                  size={24}
                  color="#fff"
                />
              </View>
              <View>
                <Text style={styles.pTitle}>Passenger Manifest</Text>
                <Text style={styles.pSub}>
                  {passenger.name
                    ? `Confirmed: ${passenger.name}`
                    : "Action Required: tap to configure"}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name="clipboard-check-outline"
              size={24}
              color="#2563EB"
            />
          </TouchableOpacity>

          <Input
            label="Destination / Tour Location"
            icon="map-marker"
            placeholder="e.g. Airport Terminal 3"
            value={dutyData.tourLocation}
            onChange={(v: string) =>
              setDutyData({ ...dutyData, tourLocation: v })
            }
          />

          <View style={styles.flexRow}>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={{ flex: 1, marginRight: 10 }}
            >
              <Input
                label="Tour Date"
                icon="calendar"
                placeholder="YYYY-MM-DD"
                value={dutyData.date}
                editable={false}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={{ flex: 1 }}
            >
              <Input
                label="Reporting Time"
                icon="clock-outline"
                placeholder="HH:MM"
                value={dutyData.time}
                editable={false}
              />
            </TouchableOpacity>
          </View>

          <Input
            label="Fleet Instructions / Notes"
            icon="note-text-outline"
            multiline
            placeholder="Any specific instructions for the driver..."
            value={dutyData.notes}
            onChange={(v: string) => setDutyData({ ...dutyData, notes: v })}
          />
        </View>

        {/* ACTION BUTTON */}
        <TouchableOpacity
          disabled={loading}
          onPress={handleAssign}
          style={styles.dispatchBtn}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="car-connected"
                size={24}
                color="#fff"
              />
              <Text style={styles.dispatchBtnText}>Confirm & Dispatch</Text>
            </>
          )}
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            onChange={onDateChange}
            minimumDate={today}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={tempDate}
            mode="time"
            display="default"
            onChange={onTimeChange}
          />
        )}
      </ScrollView>

      {/* PASSENGER MODAL */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Passenger Sheet</Text>
                <Text style={styles.modalSub}>
                  ENTRY DETAIL MANIFEST
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                style={styles.closeBtn}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Input
                label="Primary Passenger"
                icon="account"
                value={passenger.name}
                onChange={(v: string) =>
                  setPassenger({ ...passenger, name: v })
                }
              />
              <Input
                label="Total Persons (Heads)"
                icon="account-group"
                keyboardType="numeric"
                value={passenger.heads}
                onChange={(v: string) =>
                  setPassenger({ ...passenger, heads: v })
                }
              />

              <Text style={styles.label}>Rank / Designation</Text>
              <Dropdown
                style={styles.dropdown}
                data={DESIGNATIONS}
                labelField="label"
                valueField="value"
                placeholder="Select Rank"
                value={passenger.designation}
                onChange={(item) =>
                  setPassenger({
                    ...passenger,
                    designation: item.value,
                  })
                }
                renderLeftIcon={() => (
                  <MaterialCommunityIcons
                    style={{ marginRight: 10 }}
                    name="briefcase-outline"
                    size={20}
                    color="#2563EB"
                  />
                )}
              />

              <Text style={styles.label}>Department</Text>
              <Dropdown
                style={styles.dropdown}
                data={DEPARTMENTS}
                labelField="label"
                valueField="value"
                placeholder="Select Dept"
                value={passenger.department}
                onChange={(item) =>
                  setPassenger({
                    ...passenger,
                    department: item.value,
                  })
                }
                renderLeftIcon={() => (
                  <MaterialCommunityIcons
                    style={{ marginRight: 10 }}
                    name="office-building"
                    size={20}
                    color="#2563EB"
                  />
                )}
              />

              <Input
                label="Contact Number"
                icon="phone"
                keyboardType="phone-pad"
                maxLength={10}
                value={passenger.contact}
                onChange={(v: string) =>
                  setPassenger({ ...passenger, contact: v })
                }
              />

              <TouchableOpacity
                onPress={handleSavePassenger}
                style={styles.saveBtn}
              >
                <Text style={styles.saveBtnText}>Confirm Information</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* HELPER COMPONENT */
function Input({
  label,
  icon,
  value,
  onChange,
  placeholder,
  multiline,
  editable = true,
  ...props
}: any) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          multiline && { height: 100, alignItems: "flex-start", paddingTop: 15 },
        ]}
      >
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color="#2563EB"
            style={{ marginRight: 10 }}
          />
        )}
        <TextInput
          placeholder={placeholder}
          style={[
            styles.nativeInput,
            multiline && { textAlignVertical: "top" },
          ]}
          value={value}
          onChangeText={onChange}
          multiline={multiline}
          editable={editable}
          {...props}
        />
      </View>
    </View>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 25 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
    gap: 15,
  },
  backBtn: {
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 15,
    elevation: 3,
    shadowOpacity: 0.1,
  },
  brandTitle: { fontSize: 24, fontWeight: "900", color: "#0F172A" },
  brandSub: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 25,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  dropdown: {
    height: 56,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  placeholder: { color: "#CBD5E1", fontSize: 15, fontWeight: "600" },
  selectedText: { color: "#0F172A", fontSize: 15, fontWeight: "600" },
  passengerToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    padding: 18,
    borderRadius: 20,
    marginBottom: 20,
  },
  pIconBox: {
    width: 44,
    height: 44,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pTitle: { fontWeight: "900", color: "#0F172A", fontSize: 14 },
  pSub: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
    marginTop: 2,
  },
  inputGroup: { marginBottom: 20 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    height: 56,
    paddingHorizontal: 15,
  },
  nativeInput: {
    flex: 1,
    color: "#0F172A",
    fontWeight: "600",
    fontSize: 15,
  },
  flexRow: { flexDirection: "row" },
  dispatchBtn: {
    height: 64,
    backgroundColor: "#2563EB",
    borderRadius: 20,
    marginTop: 20,
    marginBottom: 40,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
    elevation: 8,
    shadowColor: "#2563EB",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 15,
  },
  dispatchBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 30,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#0F172A" },
  modalSub: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    backgroundColor: "#0F172A",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  saveBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
});
