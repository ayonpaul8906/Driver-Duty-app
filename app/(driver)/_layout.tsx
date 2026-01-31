import React from "react";
import { Stack } from "expo-router";

export default function DriverRootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Tabs group as one screen */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Duties stack screen (no tab) */}
      <Stack.Screen name="duties" options={{ headerShown: false }} />
    </Stack>
  );
}
