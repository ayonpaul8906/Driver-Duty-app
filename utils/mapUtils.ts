import { Linking, Platform, Alert } from 'react-native';

export const startNavigation = (address: string) => {
  if (!address) {
    Alert.alert("Error", "No address provided for navigation.");
    return;
  }

  const encodedAddress = encodeURIComponent(address);
  
  // Logic to choose between Apple Maps (iOS) and Google Maps (Android)
  const url = Platform.select({
    ios: `maps://app?daddr=${encodedAddress}`,
    android: `google.navigation:q=${encodedAddress}`,
  });

  if (url) {
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback: Open in browser if no map app is found
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
      }
    });
  }
};