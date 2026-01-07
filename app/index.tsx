import { Redirect } from "expo-router";
import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { ActivityIndicator, View } from "react-native";
import LandingPage from "../components/LandingPage"; // We will move landing UI here

export default function RootIndex() {
  const { user, role, loading } = useContext(AuthContext);
  const [hasStarted, setHasStarted] = useState(false);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // 1. If user is logged in, bypass landing and go to their role-based dashboard
  if (user && role) {
    if (role === "admin") return <Redirect href="/(admin)/dashboard" />;
    return <Redirect href="/(driver)/dashboard" />;
  }

  // 2. If NOT logged in, show the Beautiful Landing Page
  // When they click "Get Started", we send them to /(auth)/login
  return <LandingPage onGetStarted={() => setHasStarted(true)} />;
}