import { StyleSheet, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";

interface BrowserProps {
  url: string;
  username: string;
  password: string;
  webViewRef: React.RefObject<WebView | null>;
}

export function Browser({ url, username, password, webViewRef }: BrowserProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <Text style={styles.urlText} numberOfLines={1}>{url}</Text>
      </View>
      <WebView
        ref={webViewRef}
        source={{
          uri: url,
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        }}
        basicAuthCredential={{ username, password }}
        style={styles.webview}
        cacheEnabled={false}
        javaScriptEnabled={true}
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
    padding: 6,
    alignItems: "center",
  },
  webview: {
    flex: 1,
  },
  urlText: {
    color: "#999",
    fontSize: 12,
  },
});
