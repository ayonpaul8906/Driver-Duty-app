import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../services/firebase";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const loginEmail = email.trim();
    const loginPassword = password;

    if (!loginEmail || !loginPassword) {
      Alert.alert("Required", "Please enter your corporate credentials.");
      return;
    }

    if (loading) return;

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      
      // Redirect to root which handles role-based routing
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Decorative Background Elements */}
      <View style={styles.topAccent} />
      <View style={[styles.blurCircle, styles.circleLeft]} />
      <View style={[styles.blurCircle, styles.circleRight]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.innerContainer}>
          
          {/* Branding Area */}
          <View style={styles.branding}>
            <View style={styles.logoBox}>
              <MaterialCommunityIcons name="truck-delivery" size={40} color="#fff" />
            </View>
            <Text style={styles.brandName}>
              Duty<Text style={{ color: "#2563EB" }}>Sync</Text>
            </Text>
            <Text style={styles.brandSub}>Fleet & Driver Management Console</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <View style={styles.spaceY}>
              
              {/* Email Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Corporate Email</Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons name="email-outline" size={20} color="#94A3B8" />
                  <TextInput
                    style={styles.input}
                    placeholder="name@company.com"
                    placeholderTextColor="#CBD5E1"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Access Password</Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color="#94A3B8" />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#CBD5E1"
                    secureTextEntry
                    autoCorrect={false}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={handleLogin}
                  />
                </View>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <View style={styles.row}>
                    <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
                    <Text style={styles.buttonText}>Verifying Identity...</Text>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <MaterialCommunityIcons name="shield-check-outline" size={20} color="#fff" />
                    <Text style={[styles.buttonText, { marginLeft: 8 }]}>Authorize Login</Text>
                  </View>
                )}
              </TouchableOpacity>

            </View>
          </View>

          {/* Footer Info */}
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} DutySync Systems. Secure Admin Access.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  topAccent: {
    position: "absolute",
    top: 0,
    width: "100%",
    height: 4,
    backgroundColor: "#2563EB",
  },
  blurCircle: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.1,
  },
  circleLeft: {
    top: -100,
    left: -100,
    backgroundColor: "#2563EB",
  },
  circleRight: {
    bottom: -100,
    right: -100,
    backgroundColor: "#6366F1",
  },
  keyboardView: { flex: 1 },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  branding: { alignItems: "center", marginBottom: 40 },
  logoBox: {
    width: 70,
    height: 70,
    backgroundColor: "#2563EB",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 8,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  brandName: { fontSize: 32, fontWeight: "900", color: "#0F172A", letterSpacing: -1 },
  brandSub: { fontSize: 13, color: "#64748B", fontWeight: "600", marginTop: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 10,
    shadowColor: "#64748B",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  spaceY: { gap: 20 },
  inputGroup: {},
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    color: "#0F172A",
    fontWeight: "600",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2563EB",
    height: 60,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    elevation: 4,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonDisabled: { backgroundColor: "#94A3B8" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  row: { flexDirection: "row", alignItems: "center" },
  footerText: {
    marginTop: 32,
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});