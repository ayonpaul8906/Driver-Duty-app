import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { startNavigation } from "../utils/mapUtils"; // Ensure you have created this utility

interface TaskCardProps {
  passenger: string;
  pickup: string;
  drop: string;
  status: "assigned" | "in-progress" | "completed";
  onPress: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  passenger, 
  pickup, 
  drop, 
  status, 
  onPress 
}) => {
  
  // Dynamic styling based on status
  const getStatusConfig = () => {
    switch (status) {
      case "completed":
        return { label: "Completed", color: "#22C55E", icon: "check-circle" };
      case "in-progress":
        return { label: "In Progress", color: "#F59E0B", icon: "clock-fast" };
      default:
        return { label: "Assigned", color: "#2563EB", icon: "account-clock" };
    }
  };

  const config = getStatusConfig();

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress} 
      activeOpacity={0.7}
      disabled={status === "completed"} // Disable clicks for finished tasks
    >
      {/* Top Row: Passenger & Status */}
      <View style={styles.row}>
        <View style={styles.passengerContainer}>
          <MaterialCommunityIcons name="account-tie" size={20} color="#64748B" />
          <Text style={styles.passengerName}>{passenger}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: config.color + "15" }]}>
          <Text style={[styles.badgeText, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Trip Details with Native Navigation Hooks */}
      <View style={styles.locationContainer}>
        <View style={styles.iconColumn}>
          <MaterialCommunityIcons name="circle-outline" size={16} color="#2563EB" />
          <View style={styles.verticalLine} />
          <MaterialCommunityIcons name="map-marker" size={18} color="#EF4444" />
        </View>
        
        <View style={styles.textColumn}>
          {/* Pickup Section */}
          <View style={styles.locationItem}>
            <View style={styles.locationHeaderRow}>
              <Text style={styles.locationLabel}>PICKUP</Text>
              <TouchableOpacity 
                onPress={() => startNavigation(pickup)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="navigation-variant" size={18} color="#2563EB" />
              </TouchableOpacity>
            </View>
            <Text style={styles.locationText} numberOfLines={1}>{pickup}</Text>
          </View>

          {/* Drop Section */}
          <View style={[styles.locationItem, { marginTop: 12 }]}>
            <View style={styles.locationHeaderRow}>
              <Text style={styles.locationLabel}>DROP</Text>
              <TouchableOpacity 
                onPress={() => startNavigation(drop)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="google-maps" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <Text style={styles.locationText} numberOfLines={1}>{drop}</Text>
          </View>
        </View>
      </View>

      {status !== "completed" && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Tap to update duty logs</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  passengerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 15,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconColumn: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginRight: 12,
  },
  verticalLine: {
    width: 1,
    height: 30,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  textColumn: {
    flex: 1,
  },
  locationItem: {
    justifyContent: "center",
  },
  locationHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 15,
    color: "#334155",
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
  },
  footerText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  }
});

export default TaskCard;