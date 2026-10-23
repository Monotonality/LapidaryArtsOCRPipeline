import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { isValidLabel } from "@/app/study/corpus";

const BUCKET = "study-corpus";

function imageResponse(body: Uint8Array): NextResponse {
  const bytes = new Uint8Array(body.byteLength);
  bytes.set(body);
  return new NextResponse(bytes.buffer, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ label: string }> },
) {
  const { label } = await context.params;

  if (!isValidLabel(label)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (process.env.NODE_ENV === "development") {
    try {
      const local = await readFile(
        path.join(process.cwd(), "public", "corpus", `${label}.jpg`),
      );
      return imageResponse(new Uint8Array(local));
    } catch {
      // Fall through to Storage if the local corpus is not prepared.
    }
  }

  const { data, error } = await createAdmin()
    .storage.from(BUCKET)
    .download(`${label}.jpg`);

  if (error || !data) {
    return new NextResponse("Not found", { status: 404 });
  }

  return imageResponse(new Uint8Array(await data.arrayBuffer()));
}
