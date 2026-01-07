
import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TextInputProps, 
  KeyboardTypeOptions 
} from "react-native";

interface FormInputProps extends TextInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  multiline = false,
  keyboardType = "default",
  secureTextEntry = false,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused, // Dynamic border color
          multiline && styles.multilineContainer,
        ]}
      >
        <TextInput
          style={[styles.input, multiline && styles.multilineInput]}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569", // Slate-600
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0", // Slate-200
    paddingHorizontal: 14,
    height: 52,
    justifyContent: "center",
    // Subtle shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    // Elevation for Android
    elevation: 1,
  },
  inputContainerFocused: {
    borderColor: "#2563EB", // Blue-600 focus color
    backgroundColor: "#F8FAFC",
  },
  input: {
    fontSize: 16,
    color: "#1E293B", // Slate-800
    width: "100%",
  },
  multilineContainer: {
    height: 100,
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  multilineInput: {
    textAlignVertical: "top", // Ensures text starts at the top on Android
    height: "100%",
  },
});

export default FormInput;