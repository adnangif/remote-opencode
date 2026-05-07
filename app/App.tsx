import { useState, useRef, useEffect } from "react";
import { StyleSheet, TouchableOpacity, Text, View, Alert, Animated } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Scanner } from "./components/Scanner";
import { Browser } from "./components/Browser";
import { Landing } from "./components/Landing";
import { parseAuthUrl, ParsedAuth } from "./utils/parseAuthUrl";

const DOT_SIZE = 16;
const EXPANDED_WIDTH = 80;
const EXPANDED_HEIGHT = 40;

function AppInner() {
  const insets = useSafeAreaInsets();
  const [auth, setAuth] = useState<ParsedAuth | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [dotExpanded, setDotExpanded] = useState(false);
  const webViewRef = useRef<WebView | null>(null);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animWidth = useRef(new Animated.Value(DOT_SIZE)).current;
  const animHeight = useRef(new Animated.Value(DOT_SIZE)).current;
  const animRadius = useRef(new Animated.Value(DOT_SIZE / 2)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;

  function expandDot() {
    setDotExpanded(true);
    Animated.parallel([
      Animated.spring(animWidth, { toValue: EXPANDED_WIDTH, useNativeDriver: false }),
      Animated.spring(animHeight, { toValue: EXPANDED_HEIGHT, useNativeDriver: false }),
      Animated.spring(animRadius, { toValue: EXPANDED_HEIGHT / 2, useNativeDriver: false }),
      Animated.timing(labelOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  }

  function collapseDot() {
    setDotExpanded(false);
    Animated.parallel([
      Animated.spring(animWidth, { toValue: DOT_SIZE, useNativeDriver: false }),
      Animated.spring(animHeight, { toValue: DOT_SIZE, useNativeDriver: false }),
      Animated.spring(animRadius, { toValue: DOT_SIZE / 2, useNativeDriver: false }),
      Animated.timing(labelOpacity, { toValue: 0, duration: 100, useNativeDriver: false }),
    ]).start();
  }

  useEffect(() => {
    if (dotExpanded) {
      revertTimer.current = setTimeout(collapseDot, 5000);
      return () => {
        if (revertTimer.current) clearTimeout(revertTimer.current);
      };
    }
  }, [dotExpanded]);

  function handleDotPress() {
    if (!dotExpanded) {
      expandDot();
    } else {
      if (revertTimer.current) clearTimeout(revertTimer.current);
      setDotExpanded(false);
      setShowScanner(true);
      collapseDot();
    }
  }

  function handleScanned(data: string) {
    const parsed = parseAuthUrl(data);
    if (!parsed) {
      Alert.alert("Invalid QR", "This QR code does not contain a valid auth URL.");
      return;
    }
    setAuth(parsed);
    setShowScanner(false);
    collapseDot();
  }

  if (showScanner) {
    return (
      <View style={styles.container}>
        <Scanner onScanned={handleScanned} />
        <TouchableOpacity style={styles.closeScanner} onPress={() => { setShowScanner(false); collapseDot(); }}>
          <Text style={styles.closeScannerText}>✕</Text>
        </TouchableOpacity>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!auth) {
    return (
      <View style={styles.container}>
        <Landing onScan={() => setShowScanner(true)} />
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
      <Animated.View
        style={[
          styles.scanDot,
          {
            bottom: 28 + insets.bottom,
            width: animWidth,
            height: animHeight,
            borderRadius: animRadius,
          },
        ]}
      >
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
          activeOpacity={0.7}
          onPress={handleDotPress}
        >
          <Animated.Text style={[styles.scanDotText, { opacity: labelOpacity }]}>
            Scan
          </Animated.Text>
        </TouchableOpacity>
      </Animated.View>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scanDot: {
    position: "absolute",
    right: 20,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    overflow: "hidden",
  },
  scanDotText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  closeScanner: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeScannerText: {
    color: "#fff",
    fontSize: 18,
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}
