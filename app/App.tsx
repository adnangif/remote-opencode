import { useState, useRef } from "react";
import { StyleSheet, TouchableOpacity, Text, View, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { Scanner } from "./components/Scanner";
import { Browser } from "./components/Browser";
import { parseAuthUrl, ParsedAuth } from "./utils/parseAuthUrl";

export default function App() {
  const [auth, setAuth] = useState<ParsedAuth | null>(null);
  const webViewRef = useRef<WebView | null>(null);

  function handleScanned(data: string) {
    const parsed = parseAuthUrl(data);
    if (!parsed) {
      Alert.alert("Invalid QR", "This QR code does not contain a valid auth URL.");
      return;
    }
    setAuth(parsed);
  }

  function handleRescan() {
    setAuth(null);
  }

  if (!auth) {
    return (
      <View style={styles.container}>
        <Scanner onScanned={handleScanned} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Browser
        url={auth.url}
        username={auth.username}
        password={auth.password}
        webViewRef={webViewRef}
      />
      <TouchableOpacity style={styles.scanButton} onPress={handleRescan}>
        <Text style={styles.scanButtonText}>Scan</Text>
      </TouchableOpacity>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scanButton: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
