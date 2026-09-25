"use client";

import { useEffect, useRef, useState } from "react";
import {
  FIELD_KEYS,
  normalizeValue,
  proposeFields,
  type FieldKey,
  type OcrLine,
  type Rect,
  type Suggestions,
} from "./field-mapper";
import { readImage } from "./paddle";
import { checkOllama, GEMMA_MODEL, OLLAMA_MODEL, readWithOllama, validateFields, type CheckedFields } from "./ollama";
import { checkOpenRouter, readWithOpenRouter, type OpenRouterStatus } from "./openrouter";
import styles from "./add.module.css";

export type Evidence = {
  raw: string;
  rect?: Rect;
  preview?: string;
  suggestion?: string;
  acceptValue?: string;
  confidence?: "high" | "low";
  reason?: string | null;
  source?: "ollama" | "openrouter" | "paddle";
};

const LABELS: Record<FieldKey, string> = {
  client_name: "Client name",
  phone_number: "Phone number",
  date: "Date",
  date_promised: "Date promised",
  instructions: "Instructions / article details",
  price: "Price",
};

const PAGE_TILES: Rect[] = [
  { x: 0, y: 0, width: 0.56, height: 0.38 },
  { x: 0.44, y: 0, width: 0.56, height: 0.38 },
  { x: 0, y: 0.31, width: 0.56, height: 0.38 },
  { x: 0.44, y: 0.31, width: 0.56, height: 0.38 },
  { x: 0, y: 0.62, width: 0.56, height: 0.38 },
  { x: 0.44, y: 0.62, width: 0.56, height: 0.38 },
];

function overlapOfSmaller(a: Rect, b: Rect): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const smallerArea = Math.min(a.width * a.height, b.width * b.height);
  return smallerArea ? (width * height) / smallerArea : 0;
}

function mergeLines(lines: OcrLine[]): OcrLine[] {
  const kept: OcrLine[] = [];
  for (const line of [...lines].sort((a, b) => b.score - a.score)) {
    if (!kept.some((existing) => overlapOfSmaller(existing.rect, line.rect) > 0.65)) kept.push(line);
  }
  return kept
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
    .map((line, id) => ({ ...line, id }));
}

function imageBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not make crop")), "image/png"));
}

function rectStyle(rect: Rect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

function normalizedPoint(event: React.PointerEvent<HTMLDivElement>): { x: number; y: number } {
  const box = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
    y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
  };
}

function between(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function PhotoReader({
  onPhotoChange,
  onAuto,
  onModel,
  onField,
  sourceRects,
  demo = false,
}: {
  onPhotoChange: (hasPhoto: boolean) => void;
  onAuto: (suggestions: Suggestions, evidence: Partial<Record<FieldKey, Evidence>>) => void;
  onModel: (fields: CheckedFields, source: "ollama" | "openrouter") => void;
  onField: (field: FieldKey, value: string, evidence: Evidence) => void;
  sourceRects: Partial<Record<FieldKey, Rect>>;
  demo?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lines, setLines] = useState<OcrLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [reader, setReader] = useState<"ollama" | "openrouter" | "paddle" | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "ready" | "missing-model" | "unreachable">("checking");
  const [openRouterStatus, setOpenRouterStatus] = useState<OpenRouterStatus | null>(null);
  const [model, setModel] = useState(OLLAMA_MODEL);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [field, setField] = useState<FieldKey>("client_name");
  const [drawMode, setDrawMode] = useState(false);
  const [draft, setDraft] = useState<Rect | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const fixtureLoaded = useRef(false);

  useEffect(() => {
    alive.current = true;
    void checkOllama(model).then((status) => {
      if (alive.current) setOllamaStatus(status);
    }).catch(() => { if (alive.current) setOllamaStatus("unreachable"); });
    return () => { alive.current = false; abort.current?.abort(); };
  }, [model]);
  useEffect(() => {
    void checkOpenRouter().then((status) => {
      if (alive.current) setOpenRouterStatus(status);
    }).catch(() => { if (alive.current) setOpenRouterStatus(null); });
  }, []);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  useEffect(() => {
    if (!demo || fixtureLoaded.current) return;
    const fixture = new URLSearchParams(window.location.search).get("fixture");
    if (fixture !== "1" && fixture !== "2" && fixture !== "3") return;
    fixtureLoaded.current = true;
    void fetch(`/ocr-fixtures/${fixture}.webp`).then((response) => {
      if (!response.ok) throw new Error("Local test fixture is missing.");
      return response.blob();
    }).then((blob) => {
      if (alive.current) selectFile(new File([blob], `${fixture}.webp`, { type: "image/webp" }));
    }).catch(() => { if (alive.current) setError("Local test fixture is missing."); });
  }, [demo]);
  useEffect(() => {
    if (demo && new URLSearchParams(window.location.search).get("model") === GEMMA_MODEL) setModel(GEMMA_MODEL);
  }, [demo]);

  function selectFile(next: File | null) {
    if (!next) return;
    abort.current?.abort();
    onPhotoChange(true);
    setFile(next);
    setImageUrl(URL.createObjectURL(next));
    setLines([]);
    setError("");
    setNote("");
    setDraft(null);
    setDrawMode(false);
    setFallbackActive(false);
    setSeconds(null);
    retryHealth();
  }

  function retryHealth() {
    setOllamaStatus("checking");
    void checkOllama(model).then((status) => {
      if (alive.current) setOllamaStatus(status);
    }).catch(() => { if (alive.current) setOllamaStatus("unreachable"); });
    void checkOpenRouter().then((status) => {
      if (alive.current) setOpenRouterStatus(status);
    }).catch(() => { if (alive.current) setOpenRouterStatus(null); });
  }

  async function readModel() {
    if (!file || busy) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setReader("ollama");
    setError("");
    setSeconds(null);
    setNote(`Preparing photo, then reading the whole invoice with local ${model === GEMMA_MODEL ? "Gemma 4 E2B" : "Qwen"}. This may take tens of seconds.`);
    try {
      const result = await readWithOllama(file, controller.signal, model);
      if (!alive.current || controller.signal.aborted) return;
      const checked = validateFields(result.fields);
      onModel(checked, "ollama");
      setSeconds(result.seconds);
      const filled = FIELD_KEYS.filter((key) => Boolean(checked[key].filledValue)).length;
      setNote(`Local model finished in ${result.seconds.toFixed(1)}s. ${filled} of 6 fields passed auto-fill checks; review every field and suggestion.`);
    } catch (error) {
      if (!alive.current) return;
      if (controller.signal.aborted) setNote("Model read cancelled. You can retry, use PaddleOCR, or type manually.");
      else setError(error instanceof Error ? error.message : "The local model could not read this photo.");
    } finally {
      if (alive.current) { setBusy(false); setReader(null); }
      if (abort.current === controller) abort.current = null;
    }
  }

  async function readOpenRouter() {
    if (!file || busy) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setReader("openrouter");
    setError("");
    setSeconds(null);
    setNote(`Preparing photo, then reading with OpenRouter (${openRouterStatus?.model ?? "cloud model"}). This can take tens of seconds.`);
    try {
      const result = await readWithOpenRouter(file, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      const checked = validateFields(result.fields);
      onModel(checked, "openrouter");
      setSeconds(result.seconds);
      const filled = FIELD_KEYS.filter((key) => Boolean(checked[key].filledValue)).length;
      setNote(`OpenRouter finished in ${result.seconds.toFixed(1)}s. ${filled} of 6 fields passed auto-fill checks; review every field and suggestion.`);
    } catch (error) {
      if (!alive.current) return;
      if (controller.signal.aborted) setNote("OpenRouter read cancelled. You can retry, use Ollama or PaddleOCR, or type manually.");
      else setError(error instanceof Error ? error.message : "OpenRouter could not read this photo.");
    } finally {
      if (alive.current) { setBusy(false); setReader(null); }
      if (abort.current === controller) abort.current = null;
    }
  }

  function regionCanvas(rect: Rect, padding = 8): HTMLCanvasElement | null {
    const img = image.current;
    if (!img?.complete || !img.naturalWidth) return null;
    const x = Math.max(0, Math.floor(rect.x * img.naturalWidth) - padding);
    const y = Math.max(0, Math.floor(rect.y * img.naturalHeight) - padding);
    const width = Math.min(img.naturalWidth - x, Math.ceil(rect.width * img.naturalWidth) + padding * 2);
    const height = Math.min(img.naturalHeight - y, Math.ceil(rect.height * img.naturalHeight) + padding * 2);
    if (width < 4 || height < 4) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(img, x, y, width, height, 0, 0, width, height);
    return canvas;
  }

  function evidence(raw: string, rect: Rect): Evidence {
    return { raw, rect, preview: regionCanvas(rect)?.toDataURL("image/jpeg", 0.82) ?? "" };
  }

  async function readPaddle() {
    if (!file || busy) return;
    setFallbackActive(true);
    setBusy(true);
    setReader("paddle");
    setError("");
    setNote("Preparing browser OCR. The first read downloads the model files; the photo stays on this device.");
    try {
      let result = await readImage(file);
      const firstSuggestions = proposeFields(result);
      const usefulFields = FIELD_KEYS.filter((key) => firstSuggestions[key]?.value).length;
      const largePhoto = Math.max(image.current?.naturalWidth ?? 0, image.current?.naturalHeight ?? 0) > 1800;
      if (largePhoto && usefulFields < 4) {
        const tiled: OcrLine[] = [];
        for (const [index, tile] of PAGE_TILES.entries()) {
          if (!alive.current) return;
          setNote(`Reading invoice section ${index + 1} of ${PAGE_TILES.length}…`);
          const canvas = regionCanvas(tile, 0);
          if (!canvas) continue;
          const cropLines = await readImage(await imageBlob(canvas), 1280);
          for (const line of cropLines) {
            tiled.push({ ...line, rect: {
              x: tile.x + line.rect.x * tile.width,
              y: tile.y + line.rect.y * tile.height,
              width: line.rect.width * tile.width,
              height: line.rect.height * tile.height,
            } });
          }
        }
        if (tiled.length) result = mergeLines([...(result.length >= 3 ? result : []), ...tiled]);
      }
      if (!alive.current) return;
      setLines(result);
      const suggestions = proposeFields(result);
      const sources: Partial<Record<FieldKey, Evidence>> = {};
      for (const key of FIELD_KEYS) {
        const item = suggestions[key];
        if (item) sources[key] = evidence(item.raw, item.rect);
      }
      onAuto(suggestions, sources);
      const suggestedCount = FIELD_KEYS.filter((key) => Boolean(suggestions[key]?.value)).length;
      const fieldWord = suggestedCount === 1 ? "field" : "fields";
      setNote(suggestedCount >= 3
        ? `Found ${result.length} text regions and suggested ${suggestedCount} ${fieldWord}. Check every value against the photo.`
        : `Found ${result.length} text regions, but only ${suggestedCount} usable ${fieldWord}. Choose a field and draw tightly around its handwriting, or type it below.`);
    } catch {
      if (!alive.current) return;
      setError("OCR could not read this photo. You can still draw around a field or enter it manually.");
      setNote("");
    } finally {
      if (alive.current) { setBusy(false); setReader(null); }
    }
  }

  function useLine(line: OcrLine) {
    const value = normalizeValue(field, line.text);
    onField(field, value, evidence(line.text, line.rect));
    setNote(`${LABELS[field]} selected. Check the value below before saving.`);
  }

  async function readCrop(rect: Rect) {
    const canvas = regionCanvas(rect);
    if (!canvas) return;
    setBusy(true);
    setError("");
    setNote(`Reading ${LABELS[field].toLowerCase()} crop…`);
    try {
      const result = await readImage(await imageBlob(canvas));
      if (!alive.current) return;
      const raw = result.map((line) => line.text).join(field === "instructions" ? "\n" : " ").trim();
      onField(field, normalizeValue(field, raw), evidence(raw, rect));
      setNote(raw ? `${LABELS[field]} crop read. Check the value below.` : "No text found in that area. Type the value below or draw a larger area.");
    } catch {
      if (alive.current) setError("The crop could not be read. Type the value below or try a different area.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawMode || busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = normalizedPoint(event);
    setDraft({ ...start.current, width: 0, height: 0 });
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    setDraft(between(start.current, normalizedPoint(event)));
  }

  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const rect = between(start.current, normalizedPoint(event));
    start.current = null;
    setDraft(null);
    if (rect.width >= 0.01 && rect.height >= 0.01) void readCrop(rect);
  }

  return (
    <section className={styles.photoSection} aria-label="Photo OCR">
      {!imageUrl ? (
        <label className={styles.photoDrop}>
          <input ref={fileInput} type="file" accept="image/*" capture="environment"
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)} className={styles.photoInput} />
          <span className={styles.photoDropTitle}>Take a photo of the job card</span>
          <span className={styles.photoDropHint}>Tap to open the camera, or choose an image from your device.</span>
        </label>
      ) : (
        <div className={styles.photoReview}>
          <div className={styles.ocrControls}>
            <button type="button" onClick={readModel} disabled={busy || ollamaStatus !== "ready"} className={styles.ocrButton}>
              {reader === "ollama" ? "Local model thinking…" : `Read with ${model === GEMMA_MODEL ? "Gemma 4 E2B" : "local Qwen"}`}
            </button>
            <button type="button" onClick={readOpenRouter} disabled={busy || !openRouterStatus?.configured} className={styles.chooseAgain}>
              {reader === "openrouter" ? "OpenRouter thinking…" : "Read with OpenRouter (cloud)"}
            </button>
            {(reader === "ollama" || reader === "openrouter") && <button type="button" onClick={() => abort.current?.abort()} className={styles.chooseAgain}>Cancel read</button>}
            <button type="button" onClick={readPaddle} disabled={busy} className={styles.chooseAgain}>
              {reader === "paddle" ? "PaddleOCR reading…" : "Use PaddleOCR fallback"}
            </button>
            <button type="button" disabled={busy} onClick={() => {
              abort.current?.abort(); onPhotoChange(false); setFile(null); setImageUrl(null); setLines([]); setNote(""); setError(""); setSeconds(null);
              if (fileInput.current) fileInput.current.value = "";
            }} className={styles.chooseAgain}>Choose another photo</button>
          </div>
          {ollamaStatus === "checking" && <p className={styles.ocrNote} role="status">Checking local Ollama…</p>}
          {ollamaStatus === "ready" && <p className={styles.ocrNoteDone}>Local Ollama is ready ({model}).</p>}
          {ollamaStatus === "missing-model" && <p className={styles.ocrNoteError} role="alert">Ollama is running, but {model} is missing. Run <code>ollama pull {model}</code>.</p>}
          {ollamaStatus === "unreachable" && <p className={styles.ocrNoteError} role="alert">The browser cannot reach local Ollama. Start Ollama, include <code>{typeof window === "undefined" ? "this app origin" : window.location.origin}</code> in <code>OLLAMA_ORIGINS</code>, then restart Ollama. You can use PaddleOCR or enter the fields manually.</p>}
          {openRouterStatus?.configured && <p className={styles.ocrNote}>OpenRouter ready ({openRouterStatus.model}). Reading sends this photo to OpenRouter and the selected model provider.</p>}
          {openRouterStatus && !openRouterStatus.configured && <p className={styles.ocrNote}>OpenRouter is off. Set <code>OPENROUTER_API_KEY</code> in <code>.env.local</code> and restart the app to enable it.</p>}
          {(ollamaStatus === "missing-model" || ollamaStatus === "unreachable") && <button type="button" onClick={retryHealth} className={styles.chooseAgain}>Retry Ollama connection</button>}
          {seconds !== null && <p className={styles.ocrNote}>Model call: {seconds.toFixed(1)} seconds</p>}
          {fallbackActive && <><div className={styles.fieldPicker} aria-label="Choose a field from the photo">
            <span className={styles.pickerPrompt}>Field to fill:</span>
            {FIELD_KEYS.map((key) => (
              <button key={key} type="button" onClick={() => setField(key)}
                className={field === key ? styles.fieldChipActive : styles.fieldChip} aria-pressed={field === key}>
                {LABELS[key]}
              </button>
            ))}
          </div>
          <div className={styles.ocrControls}>
            <button type="button" onClick={() => setDrawMode(false)} aria-pressed={!drawMode}
              className={!drawMode ? styles.toolActive : styles.toolButton}>Tap detected text</button>
            <button type="button" onClick={() => setDrawMode(true)} aria-pressed={drawMode}
              className={drawMode ? styles.toolActive : styles.toolButton}>Draw around text</button>
          </div>
          <p className={styles.photoHelp}>{drawMode
            ? `Drag a box around ${LABELS[field].toLowerCase()}. You can include multiple lines.`
            : `Tap a detected text box to use it for ${LABELS[field].toLowerCase()}.`}</p>
          </>}
          <div className={`${styles.imageStage} ${drawMode ? styles.imageDraw : ""}`}
            onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
            onPointerCancel={() => { start.current = null; setDraft(null); }}>
            <img ref={image} src={imageUrl} alt="Job card for OCR and field review" className={styles.preview} draggable={false} />
            {!drawMode && lines.map((line) => (
              <button key={line.id} type="button" title={line.text} aria-label={`Use text: ${line.text}`}
                onClick={() => useLine(line)} className={styles.textBox} style={rectStyle(line.rect)} />
            ))}
            {sourceRects[field] && <div className={styles.sourceBox} style={rectStyle(sourceRects[field])} aria-hidden="true" />}
            {draft && <div className={styles.draftBox} style={rectStyle(draft)} aria-hidden="true" />}
          </div>
          {note && <p className={styles.ocrNote} role="status">{note}</p>}
          {error && <p className={styles.ocrNoteError} role="alert">{error}</p>}
          {lines.length > 0 && (
            <details className={styles.rawText}>
              <summary>All recognized text ({lines.length} regions)</summary>
              <div className={styles.rawPre}>{lines.map((line) => <div key={line.id}>{line.text}</div>)}</div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
