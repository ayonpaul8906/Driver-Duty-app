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
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../services/firebase";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function ProfessionalProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // UI States
  const [editMode, setEditMode] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [hidePass, setHidePass] = useState(true);

  // Data States
  const [profile, setProfile] = useState({ name: "", phone: "", email: "" });
  const [passwords, setPasswords] = useState({ old: "", new: "", confirm: "" });

  useEffect(() => {
    // 🔥 FIX: Listen for Auth State to avoid the "Infinite Loading" bug
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchProfile(user.uid, user.email || "");
      } else {
        setLoading(false);
        router.replace("/"); // Redirect to login if no user
      }
    });

    return unsubscribe;
  }, []);

  const fetchProfile = async (uid: string, email: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfile({
          name: data.name || "Driver",
          phone: data.phone || "",
          email: email,
        });
      }
    } catch (e) {
      Alert.alert("Sync Error", "Unable to load profile data.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInfo = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setUpdating(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: profile.name,
        phone: profile.phone,
      });
      setEditMode(false);
      Alert.alert("Success", "Profile information updated.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handlePasswordChange = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) return;

    if (passwords.new !== passwords.confirm) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }

    setUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, passwords.old);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwords.new);
      
      setShowPassModal(false);
      setPasswords({ old: "", new: "", confirm: "" });
      Alert.alert("Success", "Password updated successfully.");
    } catch (error: any) {
      Alert.alert("Security Error", "Current password incorrect or session expired.");
    } finally {
      setUpdating(false);
    }
  };


  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{marginTop: 10, color: '#94A3B8'}}>Syncing Profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER SECTION */}
      <View style={styles.headerBackground}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{profile.name.charAt(0)}</Text>
            </View>
            <Text style={styles.headerNameText}>{profile.name}</Text>
            <Text style={styles.headerEmailText}>{profile.email}</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* GENERAL INFO CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>General Info</Text>
            <TouchableOpacity onPress={() => editMode ? handleUpdateInfo() : setEditMode(true)}>
              {updating && editMode ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <View style={styles.editActionRow}>
                  <Text style={[styles.editText, editMode && {color: '#10B981'}]}>
                    {editMode ? "SAVE" : "EDIT"}
                  </Text>
                  <MaterialCommunityIcons 
                    name={editMode ? "check-circle" : "pencil-circle"} 
                    size={20} 
                    color={editMode ? "#10B981" : "#2563EB"} 
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <EditableRow 
            label="Full Name" 
            value={profile.name} 
            icon="account-outline"
            editable={editMode}
            onChangeText={(t:string) => setProfile({...profile, name: t})}
          />
          <EditableRow 
            label="Phone Number" 
            value={profile.phone} 
            icon="phone-outline"
            editable={editMode}
            keyboardType="phone-pad"
            onChangeText={(t:string) => setProfile({...profile, phone: t})}
          />
        </View>

        {/* SECURITY CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security</Text>
          <TouchableOpacity style={styles.passwordBtn} onPress={() => setShowPassModal(true)}>
            <View style={styles.row}>
              <MaterialCommunityIcons name="lock-reset" size={22} color="#2563EB" />
              <Text style={styles.passwordBtnText}>Change Password</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* PASSWORD MODAL */}
      <Modal visible={showPassModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Password</Text>
              <TouchableOpacity onPress={() => setShowPassModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Current Password</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput 
                  style={styles.modalInput} 
                  secureTextEntry={hidePass} 
                  value={passwords.old}
                  onChangeText={(t) => setPasswords({...passwords, old: t})}
                />
                <TouchableOpacity onPress={() => setHidePass(!hidePass)}>
                  <MaterialCommunityIcons name={hidePass ? "eye-outline" : "eye-off-outline"} size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalInputLabel}>New Password</Text>
              <TextInput 
                style={styles.modalInputSingle} 
                secureTextEntry={hidePass} 
                value={passwords.new}
                onChangeText={(t) => setPasswords({...passwords, new: t})}
              />

              <Text style={styles.modalInputLabel}>Confirm New Password</Text>
              <TextInput 
                style={styles.modalInputSingle} 
                secureTextEntry={hidePass} 
                value={passwords.confirm}
                onChangeText={(t) => setPasswords({...passwords, confirm: t})}
              />
            </View>

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handlePasswordChange}>
              {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Change Password</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EditableRow({ label, value, icon, editable, ...props }: any) {
  return (
    <View style={styles.rowContainer}>
      <View style={styles.iconBox}><MaterialCommunityIcons name={icon} size={20} color="#2563EB" /></View>
      <View style={styles.inputStack}>
        <Text style={styles.rowLabel}>{label}</Text>
        {editable ? (
          <TextInput style={styles.rowInputActive} value={value} {...props} autoFocus />
        ) : (
          <Text style={styles.rowValueText}>{value || "Not set"}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  centerBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerBackground: { backgroundColor: "#2563EB", height: 220, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, elevation: 10 },
  headerContent: { alignItems: "center", marginTop: 20 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10 },
  avatarInitial: { fontSize: 36, fontWeight: "bold", color: "#fff" },
  headerNameText: { fontSize: 24, fontWeight: "900", color: "#fff", marginTop: 12 },
  headerEmailText: { fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  scrollContent: { padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 20, elevation: 4, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  cardTitle: { fontSize: 12, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1 },
  editActionRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  editText: { fontSize: 12, fontWeight: "900", color: "#2563EB" },
  rowContainer: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  inputStack: { flex: 1, marginLeft: 15 },
  rowLabel: { fontSize: 10, fontWeight: "800", color: "#94A3B8", textTransform: "uppercase" },
  rowValueText: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  rowInputActive: { fontSize: 16, fontWeight: "700", color: "#2563EB", borderBottomWidth: 1, borderBottomColor: "#DBEAFE", paddingVertical: 2 },
  passwordBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAFC", padding: 16, borderRadius: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 15 },
  passwordBtnText: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 20 },
  logoutBtnText: { fontSize: 15, fontWeight: "800", color: "#EF4444" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end" },
  modalBody: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 30 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
  modalInputGroup: { gap: 15 },
  modalInputLabel: { fontSize: 11, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase" },
  passwordInputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 12, paddingRight: 15, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalInput: { flex: 1, padding: 15, fontSize: 16, fontWeight: "700", color: "#1E293B" },
  modalInputSingle: { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 15, fontSize: 16, fontWeight: "700", color: "#1E293B", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalSubmitBtn: { backgroundColor: "#2563EB", height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 25 },
  modalSubmitText: { color: "#fff", fontSize: 16, fontWeight: "900" },
});