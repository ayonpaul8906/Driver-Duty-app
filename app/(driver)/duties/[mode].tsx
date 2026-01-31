// app/(driver)/duties/[mode].tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "../../../services/firebase"; 
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface TaskRecord {
  id: string;
  status: string;
  tourLocation?: string;
  tourTime?: string;
  passenger?: {
    name?: string;
    phone?: string;
    heads?: number;
  };
  createdAt?: any;
  date?: string;
  pickup?: string;
  drop?: string;
}

export default function DriverDutyRecords() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode: string }>(); // "all" | "active"
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const qTasks = query(
      collection(db, "tasks"),
      where("driverId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(qTasks, (snap) => {
      let list: TaskRecord[] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<TaskRecord, "id">),
      }));

      if (mode === "active") {
        list = list.filter(
          (t) => t.status === "assigned" || t.status === "in-progress",
        );
      }

      setTasks(list);
      setLoading(false);
    });

    return () => unsub();
  }, [mode]);

  const filteredTasks = tasks.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.passenger?.name?.toLowerCase().includes(q) ||
      t.tourLocation?.toLowerCase().includes(q) ||
      `${t.pickup || ""} ${t.drop || ""}`.toLowerCase().includes(q)
    );
  });

  const title = mode === "active" ? "My Active Duties" : "My All Duties";

  return (
    <SafeAreaView style={styles.container}>
      {/* Top blue bar */}
      <View style={styles.topStripe} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => router.push("/(driver)/dashboard" as any)}
              style={styles.backButton}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={22}
                color="#475569"
              />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.subtitleRow}>
                <MaterialCommunityIcons
                  name="filter-variant"
                  size={14}
                  color="#2563EB"
                />
                <Text style={styles.subtitleText}>Personal duty history</Text>
              </View>
            </View>
          </View>

          <View style={styles.entriesBox}>
            <Text style={styles.entriesCount}>{filteredTasks.length}</Text>
            <Text style={styles.entriesLabel}>Entries</Text>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchWrapper}>
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color="#94A3B8"
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search my duties..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* LIST */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading your duties...</Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filteredTasks.map((task) => {
              const statusStyle =
                task.status === "completed"
                  ? styles.statusCompleted
                  : task.status === "in-progress"
                  ? styles.statusInProgress
                  : styles.statusAssigned;

              return (
                <View key={task.id} style={styles.card}>
                  {/* Status */}
                  <View style={styles.cardTopRow}>
                    <View style={[styles.statusPill, statusStyle]}>
                      <Text style={styles.statusText}>{task.status}</Text>
                    </View>
                  </View>

                  {/* Passenger + heads + time */}
                  <View style={styles.cardPassengerBlock}>
                    <Text style={styles.passengerName}>
                      {task.passenger?.name || "Corporate Guest"}
                    </Text>
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons
                          name="account-group"
                          size={14}
                          color="#3B82F6"
                        />
                        <Text style={styles.metaText}>
                          {task.passenger?.heads || 0}
                        </Text>
                      </View>
                      {task.tourTime ? (
                        <View style={styles.metaItem}>
                          <MaterialCommunityIcons
                            name="calendar-clock"
                            size={14}
                            color="#3B82F6"
                          />
                          <Text style={styles.metaText}>{task.tourTime}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Route */}
                  <View style={styles.routeBox}>
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={18}
                      color="#EF4444"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.routeText}>
                      {task.tourLocation ||
                        `${task.pickup || ""} → ${task.drop || ""}`}
                    </Text>
                  </View>

                  {/* Footer: driver + ID */}
                  <View style={styles.cardFooter}>
                    <View style={styles.driverRow}>
                      <View style={styles.driverAvatar}>
                        <MaterialCommunityIcons
                          name="account"
                          size={18}
                          color="#FFFFFF"
                        />
                      </View>
                      <View>
                        <Text style={styles.driverYou}>You</Text>
                        <Text style={styles.driverTitle}>AMPL Driver</Text>
                      </View>
                    </View>
                    <Text style={styles.idBadge}>
                      ID: {task.id.slice(-6).toUpperCase()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!loading && filteredTasks.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons
                name="filter-variant"
                size={32}
                color="#E5E7EB"
              />
            </View>
            <Text style={styles.emptyTitle}>Zero entries found</Text>
            <Text style={styles.emptySubtitle}>
              No duties match your current filter.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  topStripe: { height: 6, width: "100%", backgroundColor: "#2563EB" },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  subtitleText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  entriesBox: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  entriesCount: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2563EB",
  },
  entriesLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  searchWrapper: {
    marginBottom: 16,
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 16,
    top: "50%",
    marginTop: -12,
  },
  searchInput: {
    height: 56,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingLeft: 44,
    paddingRight: 16,
    fontWeight: "700",
    color: "#111827",
    fontSize: 14,
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    flexBasis: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusCompleted: { backgroundColor: "#DCFCE7" },
  statusInProgress: { backgroundColor: "#FEF3C7" },
  statusAssigned: { backgroundColor: "#DBEAFE" },
  statusText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "#1F2933",
  },
  cardPassengerBlock: {
    marginBottom: 10,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  routeBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#4B5563",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  driverYou: {
    fontSize: 9,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
  },
  driverTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },
  idBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyState: {
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E5E7EB",
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#CBD5F5",
    marginTop: 4,
  },
});
