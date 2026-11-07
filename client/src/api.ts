export async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch("/api" + url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Erreur");
  return data as T;
}
