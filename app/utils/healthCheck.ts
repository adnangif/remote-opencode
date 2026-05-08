import { useQuery } from "@tanstack/react-query";
import { RecentLink } from "./storage";

async function fetchHealth(link: RecentLink): Promise<boolean> {
  try {
    const url = `${link.url}/global/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const credentials = btoa(`${link.username}:${link.password}`);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    clearTimeout(timer);
    return res.ok;
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
