import AsyncStorage from "@react-native-async-storage/async-storage";
import { ParsedAuth } from "./parseAuthUrl";

const STORAGE_KEY = "recent_links";

export interface RecentLink {
  id: string;
  url: string;
  username: string;
  password: string;
  lastAccessedAt: number;
}

function makeId(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

export async function loadRecentLinks(): Promise<RecentLink[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentLink[];
  } catch {
    return [];
  }
}

export async function saveRecentLinks(links: RecentLink[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

export async function addRecentLink(auth: ParsedAuth): Promise<RecentLink[]> {
  const links = await loadRecentLinks();
  const id = makeId(auth.url);

  const existingIdx = links.findIndex((l) => l.id === id);
  if (existingIdx !== -1) {
    links[existingIdx].lastAccessedAt = Date.now();
    links[existingIdx].username = auth.username;
    links[existingIdx].password = auth.password;
    const [existing] = links.splice(existingIdx, 1);
    links.unshift(existing);
  } else {
    links.unshift({
      id,
      url: auth.url,
      username: auth.username,
      password: auth.password,
      lastAccessedAt: Date.now(),
    });
  }

  const trimmed = links.slice(0, 4);
  await saveRecentLinks(trimmed);
  return trimmed;
}

export async function removeRecentLink(id: string): Promise<RecentLink[]> {
  const links = await loadRecentLinks();
  const filtered = links.filter((l) => l.id !== id);
  await saveRecentLinks(filtered);
  return filtered;
}
