import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updatePassword, updateProfile, signOut } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import { auth, db } from "../../../services/firebase";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function ProfessionalProfile() {
  const router = useRouter();
  const user = auth.currentUser;
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    email: "",
    photoURL: "",
  });
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfile({
          name: data.name || "",
          phone: data.phone || "",
          email: user.email || "",
          photoURL: user.photoURL || "",
        });
      }
    } catch (e) {
      Alert.alert("Sync Error", "Unable to load profile data.");
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setProfile({ ...profile, photoURL: result.assets[0].uri });
    }
  };

  const handleUpdate = async () => {
    if (!user) return;
    if (showSecurity && newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: profile.name,
        phone: profile.phone,
      });

      await updateProfile(user, {
        displayName: profile.name,
        photoURL: profile.photoURL,
      });

      if (showSecurity && newPassword.length >= 6) {
        await updatePassword(user, newPassword);
        setShowSecurity(false);
        setNewPassword("");
        setConfirmPassword("");
      }

      Alert.alert("Profile Updated", "Your changes have been saved successfully.");
    } catch (error: any) {
      Alert.alert("Update Failed", error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topAccent} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            
            {/* PROFILE HERO */}
            <View style={styles.heroSection}>
              <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
                {profile.photoURL ? (
                  <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{profile.name.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.cameraBtn}>
                  <MaterialCommunityIcons name="camera" size={16} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text style={[styles.userName, {color:"#0b0a0a"}]}>{profile.name}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.verifiedBadge}>
                  <MaterialCommunityIcons name="check-decagram" size={14} color="#0b0a0a" />
                  <Text style={[styles.verifiedText, { color: "#0b0a0a" }]}>Verified Driver</Text>
                </View>
              </View>
            </View>

            <View style={styles.contentBody}>
              {/* ACCOUNT SETTINGS GROUP */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Account Information</Text>
                
                <ProfileRow 
                  label="Display Name" 
                  value={profile.name} 
                  icon="account-outline"
                  onChangeText={(t:string) => setProfile({...profile, name: t})} 
                />
                
                <ProfileRow 
                  label="Mobile Number" 
                  value={profile.phone} 
                  icon="phone-outline"
                  keyboardType="phone-pad"
                  onChangeText={(t:string) => setProfile({...profile, phone: t})} 
                />

                <View style={styles.readOnlyRow}>
                  <MaterialCommunityIcons name="email-outline" size={20} color="#94A3B8" />
                  <View style={{marginLeft: 15}}>
                    <Text style={styles.readOnlyLabel}>Email Address</Text>
                    <Text style={styles.readOnlyValue}>{profile.email}</Text>
                  </View>
                </View>
              </View>

              {/* SECURITY SECTION */}
              <View style={styles.card}>
                <TouchableOpacity 
                  style={styles.expandHeader} 
                  onPress={() => setShowSecurity(!showSecurity)}
                >
                  <View style={styles.row}>
                    <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#2563EB" />
                    <Text style={styles.cardTitle}>Security & Password</Text>
                  </View>
                  <MaterialCommunityIcons 
                    name={showSecurity ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color="#94A3B8" 
                  />
                </TouchableOpacity>

                {showSecurity && (
                  <View style={styles.expandBody}>
                    <ProfileRow 
                      label="New Password" 
                      value={newPassword} 
                      icon="lock-outline"
                      secureTextEntry
                      onChangeText={setNewPassword} 
                    />
                    <ProfileRow 
                      label="Confirm Password" 
                      value={confirmPassword} 
                      icon="lock-check-outline"
                      secureTextEntry
                      onChangeText={setConfirmPassword} 
                    />
                  </View>
                )}
              </View>

              {/* SAVE BUTTON */}
              <TouchableOpacity 
                style={[styles.primaryBtn, updating && { opacity: 0.7 }]} 
                onPress={handleUpdate}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save-outline" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Update Profile</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* LOGOUT */}
              <TouchableOpacity style={styles.logoutBtn} onPress={() => signOut(auth)}>
                <MaterialCommunityIcons name="logout-variant" size={20} color="#EF4444" />
                <Text style={styles.logoutText}>Sign Out from Console</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* --- REUSABLE COMPONENTS --- */
function ProfileRow({ label, value, icon, ...props }: any) {
  return (
    <View style={styles.rowContainer}>
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name={icon} size={20} color="#2563EB" />
      </View>
      <View style={styles.inputStack}>
        <Text style={styles.rowLabel}>{label}</Text>
        <TextInput 
          style={styles.rowInput} 
          value={value} 
          placeholderTextColor="#CBD5E1"
          {...props} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  topAccent: { position: "absolute", top: 0, width: "100%", height: 180, backgroundColor: "#2563EB" },
  centerBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  heroSection: { alignItems: "center", paddingVertical: 40 },
  avatarWrapper: { position: "relative" },
  avatarImage: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: "#fff" },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#fff" },
  avatarText: { fontSize: 40, fontWeight: "900", color: "#fff" },
  cameraBtn: { position: "absolute", bottom: 5, right: 5, backgroundColor: "#2563EB", width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  userName: { fontSize: 24, fontWeight: "900", color: "#fff", marginTop: 15 },
  badgeRow: { marginTop: 8 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  verifiedText: { color: "#fff", fontSize: 10, fontWeight: "900", marginLeft: 5, textTransform: "uppercase" },
  contentBody: { paddingHorizontal: 20, marginTop: -20 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 15, elevation: 4, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15 },
  sectionTitle: { fontSize: 11, fontWeight: "900", color: "#94A3B8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 20 },
  rowContainer: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  inputStack: { flex: 1, marginLeft: 15 },
  rowLabel: { fontSize: 10, fontWeight: "800", color: "#94A3B8", textTransform: "uppercase" },
  rowInput: { fontSize: 16, fontWeight: "700", color: "#1E293B", paddingVertical: 4 },
  readOnlyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, opacity: 0.6 },
  readOnlyLabel: { fontSize: 10, fontWeight: "800", color: "#94A3B8", textTransform: "uppercase" },
  readOnlyValue: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  expandHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "900", color: "#0F172A", marginLeft: 15 },
  expandBody: { marginTop: 25 },
  primaryBtn: { backgroundColor: "#2563EB", height: 60, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, elevation: 8, shadowColor: "#2563EB", shadowOpacity: 0.3, marginTop: 10 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 20, gap: 10 },
  logoutText: { color: "#EF4444", fontSize: 14, fontWeight: "900" },
});