import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import TaskCard from "../../components/TaskCard";

// Define the Task structure
interface Task {
  id: string;
  passengerName: string;
  pickup: string;
  drop: string;
  status: "assigned" | "in-progress" | "completed";
  date: string;
}

export default function MyDutiesScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // We filter by driverName to match your current database logic
    const q = query(
      collection(db, "tasks"),
      where("driverName", "==", user.displayName || "")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[];

      // Sort: Put 'assigned' and 'in-progress' at the top
      const sortedTasks = taskList.sort((a, b) => {
        if (a.status === "completed" && b.status !== "completed") return 1;
        if (a.status !== "completed" && b.status === "completed") return -1;
        return 0;
      });

      setTasks(sortedTasks);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const renderItem = ({ item }: { item: Task }) => (
    <TaskCard
      passenger={item.passengerName}
      pickup={item.pickup}
      drop={item.drop}
      status={item.status}
      onPress={() => {
        if (item.status !== "completed") {
          // Navigate to the dashboard or specific update modal
          router.push("/(driver)/dashboard"); 
        }
      }}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.title}>Duty History</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="calendar-blank" size={60} color="#CBD5E1" />
          <Text style={styles.emptyText}>No duties found in your record.</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0F172A",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    marginTop: 10,
    color: "#94A3B8",
    fontSize: 16,
  },
  listPadding: {
    padding: 20,
    paddingBottom: 40,
  },
});