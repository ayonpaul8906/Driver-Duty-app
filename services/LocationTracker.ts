// app/services/LocationTracker.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Alert } from "react-native";
import { db } from "./firebase";

export const LOCATION_TASK_NAME = "background-location-task";

// Background task – writes GPS to Firestore
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("Background task error:", error);
    return;
  }

  if (!data) return;

  const { locations } = data;
  const location = locations[0];

  try {
    const savedUid = await AsyncStorage.getItem("driver_uid");
    if (location && savedUid) {
      await setDoc(
        doc(db, "drivers", savedUid),
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          lastUpdated: serverTimestamp(),
          locationstatus: "online",
        },
        { merge: true },
      );
      // console.log("BG location saved:", savedUid, location.coords);
    }
  } catch (e) {
    console.error("BG Sync Failed:", e);
  }
});

// Start background tracking
export const startBackgroundTracking = async (): Promise<"tracking" | "error"> => {
  try {
    // 1. Foreground permission
    const fgResult = await Location.requestForegroundPermissionsAsync();
    if (fgResult.status !== "granted") {
      Alert.alert(
        "Location required",
        "Please allow location to use DutySync.",
      );
      return "error";
    }

    // 2. Background permission
    const bgResult = await Location.requestBackgroundPermissionsAsync();
    if (bgResult.status !== "granted") {
      Alert.alert(
        "Enable background location",
        "In Android Settings, set DutySync location to 'Allow all the time' for live tracking.",
      );
      return "error";
    }

    // 3. Avoid double start
    const isStarted = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    );
    if (!isStarted) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 30000, // 30s
        distanceInterval: 10, // meters
        foregroundService: {
          notificationTitle: "AMPL Active Tracking",
          notificationBody: "Reporting location for active duty...",
          notificationColor: "#2563EB",
        },
        deferredUpdatesInterval: 30000,
        deferredUpdatesDistance: 10,
        showsBackgroundLocationIndicator: true, // iOS pill
      });
    }

    return "tracking";
  } catch (error) {
    console.error("Tracking Engine Error:", error);
    return "error";
  }
};

export const stopBackgroundTracking = async () => {
  const registered = await TaskManager.isTaskRegisteredAsync(
    LOCATION_TASK_NAME,
  );
  if (registered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
};
