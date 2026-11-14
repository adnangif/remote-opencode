import { useQuery } from "@tanstack/react-query";
import { RecentLink } from "./storage";

async function fetchHealth(link: RecentLink): Promise<boolean> {
  try {
    const url = `${link.url}/api/info`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const headers: Record<string, string> = {};
    if (link.username && link.password) {
      const credentials = btoa(`${link.username}:${link.password}`);
      headers.Authorization = `Basic ${credentials}`;
    }

    const res = await fetch(url, {
      signal: controller.signal,
      headers,
    });

    clearTimeout(timer);
    // Unknown routes fall back to the web UI's HTML, so require the JSON server info.
    return res.ok && (res.headers.get("content-type") ?? "").includes("application/json");
  } catch {
    return false;
  }
}

export function useHealthCheck(link: RecentLink | null, refetchInterval = 30_000) {
  const { data } = useQuery({
    queryKey: ["health", link?.id],
    queryFn: () => fetchHealth(link!),
    enabled: !!link,
    refetchInterval,
    staleTime: 15_000,
  });

  return { isHealthy: data ?? null };
}
