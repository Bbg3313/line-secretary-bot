export type TaskStatus = "pending" | "in_progress" | "done";

const STORAGE_KEY = "line-secretary-task-status";

export function getStoredStatus(): Record<string, TaskStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, TaskStatus> = {};
    for (const [id, s] of Object.entries(parsed)) {
      if (s === "pending" || s === "in_progress" || s === "done") out[id] = s;
    }
    return out;
  } catch {
    return {};
  }
}

export function setStoredStatus(id: string, status: TaskStatus): void {
  if (typeof window === "undefined") return;
  try {
    const prev = getStoredStatus();
    prev[id] = status;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
  } catch {
    // ignore
  }
}
