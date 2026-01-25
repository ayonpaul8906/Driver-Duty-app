import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../../services/firebase";

interface Task {
  id: string;
  passenger?: { name: string };
  tourLocation: string;
  tourTime: string;
  kilometers: number;
  status: string;
  createdAt: any;
  date?: string;
}

export default function DutyHistory() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groupedTasks, setGroupedTasks] = useState<{ [key: string]: Task[] }>(
    {},
  );

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Query completed tasks for this driver
    const q = query(
      collection(db, "tasks"),
      where("driverId", "==", user.uid),
      where("status", "==", "completed"),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[];

      groupTasks(tasks);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const groupTasks = (tasks: Task[]) => {
    const groups: { [key: string]: Task[] } = {};

    tasks.forEach((task) => {
      let dateKey = "";
      const taskDate = task.createdAt?.toDate
        ? task.createdAt.toDate()
        : new Date(task.date || "");
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      if (taskDate.toDateString() === today.toDateString()) {
        dateKey = "Today";
      } else if (taskDate.toDateString() === yesterday.toDateString()) {
        dateKey = "Yesterday";
      } else {
        dateKey = taskDate
          .toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
          .toUpperCase();
      }

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(task);
    });

    setGroupedTasks(groups);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Duty History</Text>
          <Text style={styles.subTitle}>YOUR PREVIOUS LOGS</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : Object.keys(groupedTasks).length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="history" size={80} color="#E2E8F0" />
          <Text style={styles.emptyText}>No history found</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {Object.keys(groupedTasks).map((date) => (
            <View key={date} style={styles.section}>
              <Text style={styles.sectionHeader}>{date}</Text>
              {groupedTasks[date].map((task) => (
                <View key={task.id} style={styles.logCard}>
                  <View style={styles.logLeft}>
                    <View style={styles.iconCircle}>
                      <MaterialCommunityIcons
                        name="account-check"
                        size={20}
                        color="#2563EB"
                      />
                    </View>
                    <View style={styles.logInfo}>
                      <Text style={styles.passengerName}>
                        {task.passenger?.name || "Corporate Guest"}
                      </Text>
                      <View style={styles.locationRow}>
                        <MaterialCommunityIcons
                          name="map-marker"
                          size={14}
                          color="#94A3B8"
                        />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {task.tourLocation}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.logRight}>
                    <Text style={styles.kmText}>{task.kilometers} KM</Text>
                    <Text style={styles.timeText}>{task.tourTime}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 15,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
  subTitle: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  scrollContent: { padding: 20 },
  section: { marginBottom: 25 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 5,
  },
  logCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  logLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logInfo: { flex: 1 },
  passengerName: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  locationText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
    marginLeft: 4,
    flex: 1,
  },
  logRight: { alignItems: "flex-end", marginLeft: 10 },
  kmText: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  timeText: { fontSize: 10, fontWeight: "700", color: "#94A3B8", marginTop: 2 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#CBD5E1",
    marginTop: 10,
    textTransform: "uppercase",
  },
});
