const listeners = new Set<() => void>();

/** Scan / camera activity that browsers do not treat as mouse or keyboard input. */
export function reportUserActivity(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeUserActivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
