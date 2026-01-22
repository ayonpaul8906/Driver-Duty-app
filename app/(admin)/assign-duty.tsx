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
  Platform,
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

export default function AssignDuty() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingDrivers, setFetchingDrivers] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [drivers, setDrivers] = useState<{ label: string; value: string }[]>([]);

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

  useEffect(() => {
    async function fetchDrivers() {
      try {
        const q = query(collection(db, "drivers"), where("active", "==", true), where("activeStatus", "==", "active"));
        const snap = await getDocs(q);
        setDrivers(snap.docs.map((d) => ({ label: d.data().name || "Unnamed", value: d.id })));
      } catch (e) {
        Alert.alert("Sync Error", "Could not fetch fleet data.");
      } finally {
        setFetchingDrivers(false);
      }
    }
    fetchDrivers();
  }, []);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDutyData({ ...dutyData, date: selectedDate.toISOString().split("T")[0] });
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const timeStr = selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setDutyData({ ...dutyData, time: timeStr });
    }
  };

  async function handleAssign() {
    if (!dutyData.driverId || !passenger.name || !dutyData.tourLocation) {
      Alert.alert("Missing Info", "Please select a driver and fill passenger details.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        driverId: dutyData.driverId,
        driverName: dutyData.driverName,
        tourLocation: dutyData.tourLocation,
        notes: dutyData.notes,
        passenger: { ...passenger, heads: Number(passenger.heads) },
        status: "assigned",
        kilometers: 0,
        createdAt: serverTimestamp(),
        tourDate: dutyData.date,
        tourTime: dutyData.time,
      };

      await addDoc(collection(db, "tasks"), payload);
      await updateDoc(doc(db, "drivers", dutyData.driverId), { activeStatus: "assigned" });

      Alert.alert("Success", "Duty dispatched successfully.");
      router.back();
    } catch (e) {
      Alert.alert("Error", "Failed to assign duty.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#0F172A" />
          </TouchableOpacity>
          <View>
            <Text style={styles.brandTitle}>Dispatch <Text style={{ color: "#2563EB" }}>Console</Text></Text>
            <Text style={styles.brandSub}>AMPL LOGISTICS PORTAL</Text>
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
            placeholder={fetchingDrivers ? "Syncing..." : "Select Available Driver"}
            value={dutyData.driverId}
            onChange={(item) => setDutyData({ ...dutyData, driverId: item.value, driverName: item.label })}
            renderLeftIcon={() => <MaterialCommunityIcons style={{ marginRight: 10 }} name="steering" size={20} color="#2563EB" />}
          />

          <TouchableOpacity onPress={() => setModalOpen(true)} style={styles.passengerToggle}>
            <View style={styles.row}>
              <View style={styles.pIconBox}><MaterialCommunityIcons name="account-tie" size={24} color="#fff" /></View>
              <View>
                <Text style={styles.pTitle}>Passenger Manifest</Text>
                <Text style={styles.pSub}>{passenger.name ? `Passenger: ${passenger.name}` : "Tap to add contact details"}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#2563EB" />
          </TouchableOpacity>

          <Input label="Destination" icon="map-marker" placeholder="e.g. Airport Terminal 3" value={dutyData.tourLocation} onChange={(v:string) => setDutyData({ ...dutyData, tourLocation: v })} />

          <View style={styles.flexRow}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ flex: 1, marginRight: 10 }}>
              <Input label="Date" icon="calendar" placeholder="YYYY-MM-DD" value={dutyData.date} editable={false} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={{ flex: 1 }}>
              <Input label="Time" icon="clock-outline" placeholder="HH:MM" value={dutyData.time} editable={false} />
            </TouchableOpacity>
          </View>

          <Input label="Fleet Instructions" icon="note-text-outline" multiline placeholder="Any notes for the driver..." value={dutyData.notes} onChange={(v:string) => setDutyData({ ...dutyData, notes: v })} />
        </View>

        {/* 3D ACTION BUTTON */}
        <TouchableOpacity disabled={loading} onPress={handleAssign} style={styles.dispatchBtn}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <MaterialCommunityIcons name="car-connected" size={24} color="#fff" />
              <Text style={styles.dispatchBtnText}>Confirm & Dispatch</Text>
            </>
          )}
        </TouchableOpacity>

        {showDatePicker && <DateTimePicker value={tempDate} mode="date" display="default" onChange={onDateChange} minimumDate={new Date()} />}
        {showTimePicker && <DateTimePicker value={tempDate} mode="time" display="default" onChange={onTimeChange} />}
      </ScrollView>

      {/* PASSENGER MODAL */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Passenger Sheet</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Input label="Primary Passenger" icon="account" value={passenger.name} onChange={(v:string) => setPassenger({ ...passenger, name: v })} />
              <Input label="Persons (Heads)" icon="account-group" keyboardType="numeric" value={passenger.heads} onChange={(v:string) => setPassenger({ ...passenger, heads: v })} />
              
              <Text style={styles.label}>Rank / Designation</Text>
              <Dropdown
                style={styles.dropdown}
                data={DESIGNATIONS}
                labelField="label"
                valueField="value"
                placeholder="Select Rank"
                value={passenger.designation}
                onChange={(item) => setPassenger({ ...passenger, designation: item.value })}
                renderLeftIcon={() => <MaterialCommunityIcons style={{ marginRight: 10 }} name="briefcase-outline" size={20} color="#2563EB" />}
              />

              <Text style={styles.label}>Department</Text>
              <Dropdown
                style={styles.dropdown}
                data={DEPARTMENTS}
                labelField="label"
                valueField="value"
                placeholder="Select Dept"
                value={passenger.department}
                onChange={(item) => setPassenger({ ...passenger, department: item.value })}
                renderLeftIcon={() => <MaterialCommunityIcons style={{ marginRight: 10 }} name="office-building" size={20} color="#2563EB" />}
              />

              <Input label="Contact Number" icon="phone" keyboardType="phone-pad" maxLength={10} value={passenger.contact} onChange={(v:string) => setPassenger({ ...passenger, contact: v })} />

              <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save Information</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* HELPER COMPONENTS */
function Input({ label, icon, value, onChange, placeholder, multiline, editable = true, ...props }: any) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, multiline && { height: 100, alignItems: 'flex-start', paddingTop: 15 }]}>
        <MaterialCommunityIcons name={icon} size={20} color="#2563EB" style={{ marginRight: 10 }} />
        <TextInput
          placeholder={placeholder}
          style={[styles.nativeInput, multiline && { textAlignVertical: 'top' }]}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 25 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 30, gap: 15 },
  backBtn: { padding: 10, backgroundColor: "#fff", borderRadius: 15, elevation: 3, shadowOpacity: 0.1 },
  brandTitle: { fontSize: 24, fontWeight: "900", color: "#0F172A" },
  brandSub: { fontSize: 10, fontWeight: "800", color: "#94A3B8", letterSpacing: 1.5 },
  card: { backgroundColor: "#fff", borderRadius: 30, padding: 25, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  label: { fontSize: 10, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", marginBottom: 8, marginLeft: 4 },
  dropdown: { height: 56, backgroundColor: "#F8FAFC", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 15, marginBottom: 20 },
  placeholder: { color: "#CBD5E1", fontSize: 15, fontWeight: "600" },
  selectedText: { color: "#0F172A", fontSize: 15, fontWeight: "600" },
  passengerToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F0F7FF", borderWidth: 1, borderColor: "#DBEAFE", padding: 18, borderRadius: 20, marginBottom: 20 },
  pIconBox: { width: 44, height: 44, backgroundColor: "#2563EB", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pTitle: { fontWeight: "900", color: "#0F172A", fontSize: 14 },
  pSub: { fontSize: 11, fontWeight: "700", color: "#2563EB", marginTop: 2 },
  inputGroup: { marginBottom: 20 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", height: 56, paddingHorizontal: 15 },
  nativeInput: { flex: 1, color: "#0F172A", fontWeight: "600", fontSize: 15 },
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
    // 3D Effect / Heavy Shadow
    elevation: 8,
    shadowColor: "#2563EB",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 15,
  },
  dispatchBtnText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#0F172A" },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  saveBtn: { backgroundColor: "#0F172A", padding: 20, borderRadius: 20, alignItems: "center", marginTop: 10, marginBottom: 20 },
  saveBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 }
});