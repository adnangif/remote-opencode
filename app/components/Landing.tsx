import { StyleSheet, TouchableOpacity, View, Text, Image, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecentLinksList } from "./RecentLinksList";
import { RecentLink } from "../utils/storage";

interface LandingProps {
  onScan: () => void;
  recentLinks: RecentLink[];
  onLinkPress: (link: RecentLink) => void;
}

export function Landing({ onScan, recentLinks, onLinkPress }: LandingProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Image
          source={require("../assets/wordmark-light.png")}
          style={styles.wordmark}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>Scan a QR code to connect</Text>
        <TouchableOpacity style={styles.cameraButton} onPress={onScan} activeOpacity={0.7}>
          <Image source={require("../assets/camera-icon.png")} style={styles.cameraImage} resizeMode="contain" />
        </TouchableOpacity>
        <Text style={styles.hint}>Tap to scan</Text>
        <RecentLinksList links={recentLinks} onLinkPress={onLinkPress} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
  },
  wordmark: {
    width: 280,
    height: 80,
    marginBottom: 8,
  },
  subtitle: {
    color: "#888",
    fontSize: 16,
    marginBottom: 24,
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
  cameraImage: {
    width: 56,
    height: 56,
    tintColor: "#fff",
  },
  hint: {
    color: "#666",
    fontSize: 14,
    marginTop: 20,
  },
});
