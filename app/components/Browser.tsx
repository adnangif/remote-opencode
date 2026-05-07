import { StyleSheet } from "react-native";
import WebView from "react-native-webview";

interface BrowserProps {
  url: string;
  username: string;
  password: string;
  webViewRef: React.RefObject<WebView | null>;
}

export function Browser({ url, username, password, webViewRef }: BrowserProps) {
  return (
    <WebView
      ref={webViewRef}
      source={{
        uri: url,
        headers: {
          Authorization: "Basic " + btoa(`${username}:${password}`),
        },
      }}
      style={StyleSheet.absoluteFillObject}
      cacheEnabled={false}
      javaScriptEnabled={true}
    />
  );
}
