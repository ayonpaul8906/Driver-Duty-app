import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

const LOCATION_TASK_NAME = 'background-location-task';

// 1. Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("Background Location Error:", error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    const location = locations[0];

    // FIX: Firebase auth might not be ready in background thread
    // We try to get the current user, but we use setDoc with merge 
    // to ensure we don't crash if the document doesn't exist yet.
    const user = auth.currentUser;

    if (location && user?.uid) {
      try {
        const driverRef = doc(db, "drivers", user.uid);
        
        // Use setDoc with { merge: true } instead of updateDoc.
        // updateDoc fails if the document doesn't exist, setDoc creates it.
        await setDoc(driverRef, {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          lastUpdated: serverTimestamp(),
          locationstatus: "online",
          driverId: user.uid
        }, { merge: true });

        console.log("📍 Location Synced to Firebase:", location.coords.latitude);
      } catch (e) {
        console.log("❌ Firebase Background Update Failed", e);
      }
    } else {
      console.log("⚠️ Tracking active but User UID not found in background context.");
    }
  }
});

// 2. Export functions
export const startBackgroundTracking = async () => {
  // Foreground permissions
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    console.log("Foreground permission denied");
    return;
  }

  // Background permissions (Crucial for "Always On")
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') {
    console.log("Background permission denied");
    return;
  }

  const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isStarted) {
    console.log("Tracking already running");
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High, // Changed to High for better precision
    timeInterval: 10000, 
    distanceInterval: 5, // Reduced to 5 meters for smoother live tracking
    deferredUpdatesInterval: 1000,
    // Required for Android to stay alive
    foregroundService: {
      notificationTitle: "AMPL Live Tracking",
      notificationBody: "Reporting live location to dispatch console...",
      notificationColor: "#2563EB",
    },
    pausesLocationUpdatesAutomatically: false, // iOS: Prevents system from stopping updates
  });
  
  console.log("🚀 Background Tracking Started");
};

export const stopBackgroundTracking = async () => {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log("🛑 Background Tracking Stopped");
  }
};