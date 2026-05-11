import { useState, useRef, useEffect, useCallback } from "react";
import { StyleSheet, TouchableOpacity, Text, View, Animated, BackHandler } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { Scanner } from "./components/Scanner";
import { Browser } from "./components/Browser";
import { Landing } from "./components/Landing";
import { ErrorModal } from "./components/ErrorModal";
import { parseAuthUrl, ParsedAuth, ParseResult } from "./utils/parseAuthUrl";
import { loadRecentLinks, addRecentLink, RecentLink } from "./utils/storage";
import { queryClient } from "./utils/queryClient";

const DOT_SIZE = 16;
const EXPANDED_WIDTH = 80;
const EXPANDED_HEIGHT = 40;

function AppInner() {
  const insets = useSafeAreaInsets();
  const [auth, setAuth] = useState<ParsedAuth | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [recentLinks, setRecentLinks] = useState<RecentLink[]>([]);
  const [dotExpanded, setDotExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const canGoBackRef = useRef(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animWidth = useRef(new Animated.Value(DOT_SIZE)).current;
  const animHeight = useRef(new Animated.Value(DOT_SIZE)).current;
  const animRadius = useRef(new Animated.Value(DOT_SIZE / 2)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadRecentLinks().then(setRecentLinks);
  }, []);

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

  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showScanner) {
        setShowScanner(false);
        collapseDot();
        return true;
      }
      if (auth && canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }
      if (auth) {
        setAuth(null);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [showScanner, auth]);

  function handleCanGoBack(canGoBack: boolean) {
    canGoBackRef.current = canGoBack;
  }

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

  const handleScanned = useCallback(async (data: string) => {
    const result = parseAuthUrl(data);
    if (!result.ok) {
      const message =
        result.reason === "unrecognized_url"
          ? "Unrecognized URL. Only ngrok links are supported."
          : "This QR code does not contain a valid auth URL.";
      setErrorMsg(message);
      return;
    }
    const updated = await addRecentLink(result.data);
    setRecentLinks(updated);
    setAuth(result.data);
    setShowScanner(false);
    collapseDot();
  }, []);

  const handleLinkPress = useCallback(async (link: RecentLink) => {
    const updated = await addRecentLink({
      url: link.url,
      username: link.username,
      password: link.password,
    });
    setRecentLinks(updated);
    setAuth({ url: link.url, username: link.username, password: link.password });
  }, []);

  if (showScanner) {
    return (
      <View style={styles.container}>
        <Scanner onScanned={handleScanned} />
        <TouchableOpacity style={styles.closeScanner} onPress={() => { setShowScanner(false); collapseDot(); }}>
          <Text style={styles.closeScannerText}>✕</Text>
        </TouchableOpacity>
        <ErrorModal
          visible={errorMsg !== null}
          message={errorMsg ?? ""}
          onCancel={() => { setErrorMsg(null); setShowScanner(false); collapseDot(); }}
          onRetry={() => { setErrorMsg(null); }}
        />
        <StatusBar style="light" />
      </View>
    );
  }

  if (!auth) {
    return (
      <View style={styles.container}>
        <Landing
          onScan={() => setShowScanner(true)}
          recentLinks={recentLinks}
          onLinkPress={handleLinkPress}
        />
        <StatusBar style="dark" />
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
        onCanGoBack={handleCanGoBack}
      />
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
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppInner />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
