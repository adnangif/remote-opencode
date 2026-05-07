import { StyleSheet, TouchableOpacity, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface LandingProps {
  onScan: () => void;
}

export function Landing({ onScan }: LandingProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Text style={styles.title}>Opencode Remote</Text>
      <Text style={styles.subtitle}>Scan a QR code to connect</Text>
      <TouchableOpacity style={styles.cameraButton} onPress={onScan} activeOpacity={0.7}>
        <View style={styles.cameraIcon}>
          <View style={styles.cameraBody} />
          <View style={styles.cameraLens} />
        </View>
      </TouchableOpacity>
      <Text style={styles.hint}>Tap to scan</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#666",
    fontSize: 16,
    marginBottom: 48,
  },
  cameraButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 12,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  cameraIcon: {
    width: 48,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBody: {
    width: 48,
    height: 32,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: "#fff",
    position: "absolute",
    bottom: 0,
  },
  cameraLens: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: "#fff",
    position: "absolute",
    bottom: 7,
  },
  hint: {
    color: "#666",
    fontSize: 14,
    marginTop: 20,
  },
});
