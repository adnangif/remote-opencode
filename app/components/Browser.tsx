import { useState, useCallback } from "react";
import { StyleSheet, View, Text, Linking, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";

interface BrowserProps {
  url: string;
  username: string;
  password: string;
  webViewRef: React.RefObject<WebView | null>;
  onCanGoBack?: (canGoBack: boolean) => void;
}

export function Browser({ url, username, password, webViewRef, onCanGoBack }: BrowserProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  const handleNavigationStateChange = useCallback((navState: { canGoBack?: boolean }) => {
    onCanGoBack?.(navState.canGoBack ?? false);
  }, [onCanGoBack]);

  function handleShouldStartLoad(request: { url: string }) {
    const { url: navUrl } = request;

    if (navUrl.startsWith("https://") || navUrl.startsWith("http://")) {
      return true;
    }

    Linking.canOpenURL(navUrl).then((supported) => {
      if (supported) {
        Linking.openURL(navUrl);
      }
    });

    return false;
  }

  function handleRefresh() {
    webViewRef.current?.reload();
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        {loading ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <View style={styles.statusDot} />
        )}

        <TouchableOpacity style={styles.refreshButton} activeOpacity={0.6} onPress={handleRefresh}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        basicAuthCredential={username && password ? { username, password } : undefined}
        userAgent="OpencodeRemote/1.0"
        style={styles.webview}
        cacheEnabled={false}
        javaScriptEnabled={true}
        nestedScrollEnabled={true}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
      <View style={{ height: insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    backgroundColor: "#1a1a1a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#34C759",
  },
  urlPill: {
    flex: 1,
    backgroundColor: "#252525",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginHorizontal: 8,
  },
  urlText: {
    color: "#aaa",
    fontSize: 12,
  },
  refreshButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIcon: {
    color: "#999",
    fontSize: 16,
  },
  webview: {
    flex: 1,
  },
});
