import { imageToBase64, parseFields, type ModelFields } from "./ollama";

export type OpenRouterStatus = { configured: boolean; model: string };

export async function checkOpenRouter(signal?: AbortSignal): Promise<OpenRouterStatus> {
  const response = await fetch("/api/openrouter/read", { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`OpenRouter check failed (${response.status}).`);
  return await response.json() as OpenRouterStatus;
}

export async function readWithOpenRouter(file: File, signal: AbortSignal): Promise<{ fields: ModelFields; seconds: number }> {
  const image = await imageToBase64(file);
  if (signal.aborted) throw signal.reason ?? new DOMException("Cancelled", "AbortError");
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(new Error("OpenRouter timed out after 300 seconds.")), 300_000);
  const onAbort = () => timeout.abort(signal.reason);
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetch("/api/openrouter/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: `data:image/jpeg;base64,${image}` }),
      signal: timeout.signal,
      cache: "no-store",
    });
    const data: unknown = await response.json();
    if (!response.ok) {
      const message = data && typeof data === "object" && "error" in data ? data.error : null;
      throw new Error(typeof message === "string" ? message : `OpenRouter returned ${response.status}.`);
    }
    if (!data || typeof data !== "object" || !("fields" in data) || !("seconds" in data)) {
      throw new Error("OpenRouter returned an invalid response.");
    }
    // Recheck the route's JSON before it reaches the shared autofill validator.
    return { fields: parseFields(JSON.stringify(data.fields)), seconds: Number(data.seconds) };
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
