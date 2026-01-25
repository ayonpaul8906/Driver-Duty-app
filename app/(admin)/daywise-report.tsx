import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function DaywiseReport() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const dateString = selectedDate.toISOString().split('T')[0];

  useEffect(() => {
    setLoading(true);
    const qTasks = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    const qDrivers = query(collection(db, "users"), where("role", "==", "driver"));

    const unsubDrivers = onSnapshot(qDrivers, (driverSnap) => {
      const drivers = driverSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

      const unsubTasks = onSnapshot(qTasks, (taskSnap) => {
        const allTasks = taskSnap.docs.map(doc => {
          const data = doc.data();
          const taskDate = data.createdAt?.toDate 
            ? data.createdAt.toDate().toISOString().split('T')[0] 
            : data.date;
          return { id: doc.id, ...data, dateOnly: taskDate };
        });

        const filtered = allTasks
          .filter(t => t.dateOnly === dateString)
          .map(t => ({
            ...t,
            driverName: drivers.find(d => d.id === t.driverId)?.name || "Not Assigned"
          }));

        setTasks(filtered);
        setLoading(false);
      });
      return () => unsubTasks();
    });
    return () => unsubDrivers();
  }, [dateString]);

  /* ================= NEW BULLETPROOF EXPORT (CSV METHOD) ================= */
  const exportToExcel = async () => {
    if (tasks.length === 0) {
      Alert.alert("Empty Report", "No records found for this date.");
      return;
    }

    try {
      setExporting(true);

      // 1. Create CSV Header
      let csvContent = "Date,Passenger,Driver,Location,Time,Status,Opening KM,Closing KM,Total KM,Fuel Qty,Fuel Amount\n";

      // 2. Add Rows
      tasks.forEach(t => {
        const opening = t.openingKm || 0;
        const closing = t.closingKm || 0;
        const totalKm = closing > 0 ? closing - opening : 0;
        
        // Clean text to avoid CSV breaking (removing commas)
        const name = (t.passenger?.name || "N/A").replace(/,/g, "");
        const driver = (t.driverName || "N/A").replace(/,/g, "");
        const loc = (t.tourLocation || "N/A").replace(/,/g, "");

        csvContent += `${t.dateOnly},${name},${driver},${loc},${t.tourTime || "N/A"},${t.status},${opening},${closing},${totalKm},${t.fuelQuantity || 0},${t.fuelAmount || 0}\n`;
      });

      // 3. Define path and filename
      const filename = `AMPL_Report_${dateString}.csv`;
      const fileUri = FileSystem.cacheDirectory + filename;

      // 4. Write File (Text encoding is much safer than Base64)
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // 5. Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Operational Report',
        });
      } else {
        Alert.alert("Error", "Sharing is not available on this device.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Export Failed", "There was an error generating the report.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topRibbon} />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#64748B" />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Daywise <Text style={{ color: "#6366F1" }}>Report</Text></Text>
            <Text style={styles.subTitle}>OPERATIONAL ANALYTICS</Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={exportToExcel} 
          disabled={exporting}
          style={[styles.exportBtn, exporting && { opacity: 0.7 }]}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="file-chart" size={18} color="#fff" />
              <Text style={styles.exportText}>EXPORT</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.dateSelector}>
        <View style={styles.dateRow}>
          <View style={styles.calendarIcon}>
            <MaterialCommunityIcons name="calendar-month" size={24} color="#6366F1" />
          </View>
          <View>
            <Text style={styles.dateLabel}>SELECTED DATE</Text>
            <Text style={styles.dateValue}>{selectedDate.toDateString()}</Text>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-down" size={24} color="#CBD5E1" />
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowPicker(false);
            if (date) setSelectedDate(date);
          }}
        />
      )}

      <View style={styles.listHeader}>
        <Text style={[styles.colLabel, { flex: 2 }]}>PASSENGER / DRIVER</Text>
        <Text style={[styles.colLabel, { flex: 1.5 }]}>LOCATION</Text>
        <Text style={[styles.colLabel, { flex: 0.8, textAlign: 'right' }]}>USAGE</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="database-off" size={64} color="#E2E8F0" />
            <Text style={styles.emptyTitle}>No records found</Text>
          </View>
        ) : (
          tasks.map(task => (
            <View key={task.id} style={styles.row}>
              <View style={{ flex: 2 }}>
                <Text style={styles.passengerName} numberOfLines={1}>{task.passenger?.name || "Corporate Guest"}</Text>
                <Text style={styles.driverName}>{task.driverName}</Text>
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.locationText} numberOfLines={1}>{task.tourLocation || "Local Trip"}</Text>
                <Text style={styles.timeText}>{task.tourTime || "No Time"}</Text>
              </View>
              <View style={{ flex: 0.8, alignItems: 'flex-end' }}>
                <Text style={styles.kmValue}>
                  {task.closingKm ? `${task.closingKm - task.openingKm}` : '--'}
                </Text>
                <View style={[styles.badge, { backgroundColor: task.status === 'completed' ? '#DCFCE7' : '#DBEAFE' }]}>
                  <Text style={[styles.badgeText, { color: task.status === 'completed' ? '#15803D' : '#1E40AF' }]}>
                    {task.status?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  topRibbon: { height: 6, backgroundColor: "#6366F1" },
  header: { padding: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 15 },
  backBtn: { width: 44, height: 44, backgroundColor: "#fff", borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowOpacity: 0.05 },
  title: { fontSize: 26, fontWeight: "900", color: "#0F172A" },
  subTitle: { fontSize: 9, fontWeight: "900", color: "#94A3B8", letterSpacing: 1.5, marginTop: 2 },
  exportBtn: { backgroundColor: "#059669", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, elevation: 4 },
  exportText: { color: "#fff", fontWeight: "900", fontSize: 10, letterSpacing: 1 },
  dateSelector: { marginHorizontal: 24, backgroundColor: "#fff", padding: 20, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 25 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  calendarIcon: { width: 44, height: 44, backgroundColor: '#EEF2FF', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateLabel: { fontSize: 8, fontWeight: "900", color: "#94A3B8", letterSpacing: 1 },
  dateValue: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginTop: 2 },
  listHeader: { flexDirection: "row", paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "#F1F5F9", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E2E8F0" },
  colLabel: { fontSize: 9, fontWeight: "900", color: "#94A3B8", letterSpacing: 1 },
  scrollContent: { paddingBottom: 20 },
  row: { flexDirection: "row", paddingHorizontal: 24, paddingVertical: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  passengerName: { fontSize: 14, fontWeight: "900", color: "#0F172A" },
  driverName: { fontSize: 10, fontWeight: "800", color: "#6366F1", textTransform: 'uppercase', marginTop: 3 },
  locationText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  timeText: { fontSize: 10, fontWeight: "600", color: "#94A3B8", marginTop: 3 },
  kmValue: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  badgeText: { fontSize: 8, fontWeight: "900" },
  centerBox: { height: 300, justifyContent: "center", alignItems: "center" },
  emptyBox: { padding: 80, alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A", marginTop: 15 },
});