export function connectSse(url: string) {
  return new EventSource(url);
}
