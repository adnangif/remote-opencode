import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RecentLink } from "../utils/storage";
import { useHealthCheck } from "../utils/healthCheck";
import { timeAgo } from "../utils/timeAgo";

interface RecentLinksListProps {
  links: RecentLink[];
  onLinkPress: (link: RecentLink) => void;
}

function LinkItem({ link, onPress }: { link: RecentLink; onPress: () => void }) {
  const { isHealthy } = useHealthCheck(link);

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.6}>
      <View
        style={[
          styles.dot,
          isHealthy === true && styles.dotGreen,
          isHealthy === false && styles.dotRed,
          isHealthy === null && styles.dotGrey,
        ]}
      />
      <View style={styles.textContainer}>
        <Text style={styles.urlText} numberOfLines={1}>{link.url.replace(/^https?:\/\//, "")}</Text>
        <Text style={styles.timeText}>{timeAgo(link.lastAccessedAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function RecentLinksList({ links, onLinkPress }: RecentLinksListProps) {
  if (links.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No recent connections</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {links.map((link) => (
        <LinkItem key={link.id} link={link} onPress={() => onLinkPress(link)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 24,
    marginTop: 32,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 6,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  dotGreen: {
    backgroundColor: "#34C759",
  },
  dotRed: {
    backgroundColor: "#FF3B30",
  },
  dotGrey: {
    backgroundColor: "#C7C7CC",
  },
  textContainer: {
    flex: 1,
  },
  urlText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  timeText: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: "#C7C7CC",
    textAlign: "center",
    paddingVertical: 12,
  },
});
