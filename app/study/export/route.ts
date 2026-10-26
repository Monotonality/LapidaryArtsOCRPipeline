import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { StudyArchiveRow, StudyEntryRow, StudyValidationRow } from "../actions";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = Array.isArray(value) ? value.join(";") : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows.map((row) =>
    columns.map((c) => csvEscape(row[c])).join(","),
  );
  return [header, ...body].join("\r\n");
}

function attachment(filename: string, body: string, type: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const dataset = params.get("dataset") ?? "entries";
  const format = params.get("format") ?? "csv";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  if (dataset === "entries") {
    const { data, error } = await supabase
      .from("study_entries")
      .select("*")
      .order("condition")
      .order("corpus_label");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as StudyEntryRow[];
    if (format === "json") {
      return attachment(
        `study-entries-${stamp}.json`,
        JSON.stringify(rows, null, 2),
        "application/json",
      );
    }
    const columns = Object.keys(rows[0] ?? {
      id: "",
      condition: "",
      corpus_label: "",
    });
    return attachment(
      `study-entries-${stamp}.csv`,
      toCsv(rows as unknown as Record<string, unknown>[], columns),
      "text/csv",
    );
  }

  if (dataset === "validations") {
    const { data, error } = await supabase
      .from("study_validations")
      .select("*")
      .order("corpus_label");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as StudyValidationRow[];
    if (format === "json") {
      return attachment(
        `study-validations-${stamp}.json`,
        JSON.stringify(rows, null, 2),
        "application/json",
      );
    }
    const columns = Object.keys(rows[0] ?? { id: "" });
    return attachment(
      `study-validations-${stamp}.csv`,
      toCsv(rows as unknown as Record<string, unknown>[], columns),
      "text/csv",
    );
  }

  if (dataset === "archives") {
    const id = params.get("id");
    if (id) {
      const { data, error } = await supabase
        .from("study_archives")
        .select("snapshot")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json(
          { error: "Archive not found." },
          { status: 404 },
        );
      }
      const snapshot = (data as { snapshot: unknown }).snapshot;
      return attachment(
        `study-archive-${id.slice(0, 8)}-${stamp}.json`,
        JSON.stringify(snapshot, null, 2),
        "application/json",
      );
    }

    const { data, error } = await supabase
      .from("study_archives")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = ((data ?? []) as StudyArchiveRow[]).map((a) => ({
      id: a.id,
      label: a.label,
      created_by: a.created_by,
      created_at: a.created_at,
      control_count: a.control_count,
      experimental_count: a.experimental_count,
      validation_count: a.validation_count,
    }));
    if (format === "json") {
      return attachment(
        `study-archives-${stamp}.json`,
        JSON.stringify(rows, null, 2),
        "application/json",
      );
    }
    const columns = Object.keys(rows[0] ?? { id: "" });
    return attachment(
      `study-archives-${stamp}.csv`,
      toCsv(rows as unknown as Record<string, unknown>[], columns),
      "text/csv",
    );
  }

  return NextResponse.json({ error: "Unknown dataset." }, { status: 400 });
}
