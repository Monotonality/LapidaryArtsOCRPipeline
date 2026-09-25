import { NextResponse, type NextRequest } from "next/server";
import { INVOICE_SCHEMA, parseFields, SYSTEM_PROMPT } from "@/app/add/ollama";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
const IMAGE_PATTERN = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/;

function model() {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

function localDemo(request: NextRequest) {
  return process.env.NODE_ENV === "development" &&
    (request.headers.get("host") === "localhost:3000" || request.headers.get("host") === "127.0.0.1:3000");
}

async function authorized(request: NextRequest) {
  if (localDemo(request)) return true;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
  return profile?.status !== "deleted";
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Sign in to use OpenRouter." }, { status: 401 });
  return NextResponse.json({ configured: Boolean(process.env.OPENROUTER_API_KEY?.trim()), model: model() }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let originHost: string | null = null;
  try { if (origin) originHost = new URL(origin).host; } catch { /* Reject malformed origins. */ }
  if (!originHost || !host || originHost !== host) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  if (!(await authorized(request))) return NextResponse.json({ error: "Sign in to use OpenRouter." }, { status: 401 });
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Set OPENROUTER_API_KEY in .env.local and restart the app." }, { status: 503 });

  let image: unknown;
  try {
    const body: unknown = await request.json();
    image = body && typeof body === "object" && "image" in body ? body.image : null;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof image !== "string" || image.length > 8_000_000 || !IMAGE_PATTERN.test(image)) {
    return NextResponse.json({ error: "Send a JPEG data URL smaller than 6 MB." }, { status: 400 });
  }

  const started = performance.now();
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": request.nextUrl.origin,
        "X-Title": "Lapidary Arts OCR Pipeline",
      },
      body: JSON.stringify({
        model: model(),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: `Extract the six fields and return only the JSON object described by this schema: ${JSON.stringify(INVOICE_SCHEMA)}` },
            { type: "image_url", image_url: { url: image } },
          ] },
        ],
        max_tokens: 8192,
        temperature: 1,
        top_p: 0.95,
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(270_000)]),
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 250);
      return NextResponse.json({ error: `OpenRouter returned ${response.status}: ${detail}` }, { status: 502 });
    }
    const data: unknown = await response.json();
    const choice = data && typeof data === "object" && "choices" in data && Array.isArray(data.choices)
      ? data.choices[0] : null;
    const message = choice && typeof choice === "object" && "message" in choice ? choice.message : null;
    const content = message && typeof message === "object" && "content" in message ? message.content : null;
    // Reasoning/thinking is separate in OpenRouter responses and is never parsed or returned.
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("OpenRouter returned no final field JSON. Retry or use a local reader.");
    }
    const fields = parseFields(content);
    return NextResponse.json({ fields, seconds: (performance.now() - started) / 1000 }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "OpenRouter timed out. Retry or use a local reader."
      : error instanceof Error ? error.message : "OpenRouter could not read this photo.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    console.info(`OpenRouter invoice read: ${((performance.now() - started) / 1000).toFixed(1)}s`);
  }
}
