import React, { useState, useEffect } from "react";
import { 
  ScrollView, View, Text, StyleSheet, TouchableOpacity, 
  Modal, Alert, ActivityIndicator 
} from "react-native";
import { collection, getDocs, addDoc, serverTimestamp, query, where } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Dropdown } from 'react-native-element-dropdown'; 
import FormInput from "../../components/FormInput"; 

interface DriverOption {
  label: string;
  value: string;
}

export default function AssignDuty() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingDrivers, setFetchingDrivers] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([]);

  // Core Duty State
  const [dutyData, setDutyData] = useState({
    driverId: "",
    driverName: "",
    pickup: "",
    drop: "",
    date: "",
    time: "",
    notes: ""
  });

  // Passenger Detail State
  const [passenger, setPassenger] = useState({
    name: "",
    heads: "",
    designation: "",
    department: "",
    contact: ""
  });

  // Fetch active drivers from the 'drivers' collection
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        // Querying drivers based on the 'active' field in your Firestore
        const q = query(collection(db, "drivers"), where("active", "==", true));
        const querySnapshot = await getDocs(q);
        
        const driversList = querySnapshot.docs.map(doc => ({
          label: doc.data().name || "Unnamed Driver",
          value: doc.id // This is the Driver's UID
        }));

        setDriverOptions(driversList);
      } catch (error) {
        console.error("Error fetching drivers: ", error);
        Alert.alert("Permission Error", "Check Firestore rules for the drivers collection.");
      } finally {
        setFetchingDrivers(false);
      }
    };

    fetchDrivers();
  }, []);

  const handleAssign = async () => {
    // Validation: Ensure driver and basic details are present
    if (!dutyData.driverId || !passenger.name || !dutyData.pickup) {
      Alert.alert("Missing Fields", "Please select a driver and fill in passenger/pickup details.");
      return;
    }

    setLoading(true);
    try {
      // Saving to 'tasks' collection with the driver's unique ID
      await addDoc(collection(db, "tasks"), {
        driverId: dutyData.driverId, // CRITICAL: Links task to Driver's Dashboard
        driverName: dutyData.driverName,
        pickup: dutyData.pickup,
        drop: dutyData.drop,
        date: dutyData.date,
        time: dutyData.time,
        notes: dutyData.notes,
        passenger: passenger, // Nested passenger details modal data
        status: "assigned",
        kilometers: 0,
        createdAt: serverTimestamp()
      });

      Alert.alert("Success", "Duty has been assigned successfully.");
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to assign duty. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.title}>Assign New Duty</Text>
        </View>

        <View style={styles.section}>
          {/* --- Driver Dropdown --- */}
          <Text style={styles.label}>Select Driver</Text>
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            inputSearchStyle={styles.inputSearchStyle}
            iconStyle={styles.iconStyle}
            data={driverOptions}
            search
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder={fetchingDrivers ? "Syncing drivers..." : "Choose a Driver"}
            searchPlaceholder="Search by name..."
            value={dutyData.driverId}
            onChange={item => {
              setDutyData({
                ...dutyData, 
                driverId: item.value, 
                driverName: item.label 
              });
            }}
            renderLeftIcon={() => (
              <MaterialCommunityIcons style={styles.icon} color="#2563EB" name="steering" size={20} />
            )}
          />
          
          <TouchableOpacity 
            style={styles.passengerToggle} 
            onPress={() => setModalVisible(true)}
          >
            <View>
              <Text style={styles.toggleTitle}>Passenger Information</Text>
              <Text style={styles.toggleSub}>
                {passenger.name ? `Passenger: ${passenger.name}` : "Tap to add contact details"}
              </Text>
            </View>
            <MaterialCommunityIcons name="account-details-outline" size={24} color="#2563EB" />
          </TouchableOpacity>

          <FormInput 
            label="Pickup Point" 
            placeholder="e.g. Terminal 1, Airport" 
            value={dutyData.pickup}
            onChangeText={(txt) => setDutyData({...dutyData, pickup: txt})}
          />
          <FormInput 
            label="Drop Point" 
            placeholder="e.g. City Hotel" 
            value={dutyData.drop}
            onChangeText={(txt) => setDutyData({...dutyData, drop: txt})}
          />
          
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <FormInput 
                label="Duty Date" 
                placeholder="DD/MM/YYYY" 
                value={dutyData.date}
                onChangeText={(txt) => setDutyData({...dutyData, date: txt})}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormInput 
                label="Duty Time" 
                placeholder="HH:MM AM/PM" 
                value={dutyData.time}
                onChangeText={(txt) => setDutyData({...dutyData, time: txt})}
              />
            </View>
          </View>

          <FormInput
            label="Internal Notes"
            placeholder="e.g. Wait for delayed flight"
            multiline
            value={dutyData.notes}
            onChangeText={(txt) => setDutyData({...dutyData, notes: txt})}
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, loading && { opacity: 0.7 }]} 
          onPress={handleAssign}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm Assignment</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* --- Passenger Details Modal --- */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Passenger Sheet</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <FormInput 
                label="Primary Passenger Name" 
                value={passenger.name} 
                onChangeText={(t) => setPassenger({...passenger, name: t})} 
              />
              <FormInput 
                label="Number of Heads" 
                keyboardType="numeric"
                value={passenger.heads} 
                onChangeText={(t) => setPassenger({...passenger, heads: t})} 
              />
              <FormInput 
                label="Official Designation" 
                value={passenger.designation} 
                onChangeText={(t) => setPassenger({...passenger, designation: t})} 
              />
              <FormInput 
                label="Department" 
                value={passenger.department} 
                onChangeText={(t) => setPassenger({...passenger, department: t})} 
              />
              <FormInput 
                label="Primary Contact No" 
                keyboardType="phone-pad"
                value={passenger.contact} 
                onChangeText={(t) => setPassenger({...passenger, contact: t})} 
              />
              
              <TouchableOpacity 
                style={styles.saveBtn} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.saveBtnText}>Save Passenger Info</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 25, gap: 15, marginTop: 40 },
  backBtn: { padding: 5 },
  title: { fontSize: 24, fontWeight: "bold", color: "#0F172A" },
  section: { backgroundColor: "#fff", padding: 15, borderRadius: 20, elevation: 3, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },
  label: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8, marginLeft: 4, textTransform: "uppercase" },
  row: { flexDirection: "row" },
  
  // Professional Dropdown Styling
  dropdown: {
    height: 55,
    borderColor: '#E2E8F0',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  icon: { marginRight: 10 },
  placeholderStyle: { fontSize: 16, color: '#94A3B8' },
  selectedTextStyle: { fontSize: 16, color: '#1E293B', fontWeight: "500" },
  inputSearchStyle: { height: 45, fontSize: 16, borderRadius: 10 },
  iconStyle: { width: 22, height: 22 },

  passengerToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0F7FF",
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 20,
  },
  toggleTitle: { fontSize: 15, fontWeight: "700", color: "#1E40AF" },
  toggleSub: { fontSize: 12, color: "#3B82F6", marginTop: 2 },
  button: {
    height: 58,
    backgroundColor: "#2563EB",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 60,
    elevation: 5,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 }
  },
  buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "bold" },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.7)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#0F172A" },
  saveBtn: { backgroundColor: "#1E293B", padding: 18, borderRadius: 15, alignItems: "center", marginTop: 20, marginBottom: 10 },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 }
});