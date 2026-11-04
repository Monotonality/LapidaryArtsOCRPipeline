import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function localDemo(request: NextRequest) {
  return (
    process.env.NODE_ENV === "development" &&
    (request.headers.get("host") === "localhost:3000" ||
      request.headers.get("host") === "127.0.0.1:3000")
  );
}

async function authorized(request: NextRequest) {
  if (localDemo(request)) return true;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.status !== "deleted";
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let jpegBuffer: Buffer;

    try {
      // First attempt with sharp directly (works if sharp supports the format)
      jpegBuffer = await sharp(buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      // Fallback for HEIC/HEIF using heic-decode
      const { default: decode } = await import("heic-decode");
      const { width, height, data } = await decode({ buffer });
      jpegBuffer = await sharp(data, { raw: { width, height, channels: 4 } })
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    }

    return new NextResponse(new Uint8Array(jpegBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to convert image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
