"use client";

import { useEffect, useRef, useState } from "react";
import { FIELD_KEYS, validateFields, type CheckedFields } from "./reader";
import { checkOpenRouter, readWithOpenRouter, type OpenRouterStatus } from "./openrouter";
import styles from "./add.module.css";

export type Evidence = {
  raw: string;
  suggestion?: string;
  acceptValue?: string;
  confidence?: "high" | "low";
  reason?: string | null;
};

export function PhotoReader({
  onPhotoChange,
  onModel,
  demo = false,
}: {
  onPhotoChange: (hasPhoto: boolean) => void;
  onModel: (fields: CheckedFields) => void;
  demo?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openRouterStatus, setOpenRouterStatus] = useState<OpenRouterStatus | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const fixtureLoaded = useRef(false);

  useEffect(() => {
    alive.current = true;
    void checkOpenRouter().then((status) => {
      if (alive.current) setOpenRouterStatus(status);
    }).catch(() => {
      if (alive.current) setOpenRouterStatus(null);
    });
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

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
    }).catch(() => {
      if (alive.current) setError("Local test fixture is missing.");
    });
  }, [demo]);

  function selectFile(next: File | null) {
    if (!next) return;
    abort.current?.abort();
    onPhotoChange(true);
    setFile(next);
    setImageUrl(URL.createObjectURL(next));
    setError("");
    setNote("");
    setSeconds(null);
  }

  async function readPhoto() {
    if (!file || busy) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    setSeconds(null);
    const modelName = openRouterStatus?.model ?? "AI model";
    setNote(`Reading invoice with OpenRouter (${modelName})…`);
    try {
      const result = await readWithOpenRouter(file, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      const checked = validateFields(result.fields);
      onModel(checked);
      setSeconds(result.seconds);
      const filled = FIELD_KEYS.filter((key) => Boolean(checked[key].filledValue)).length;
      setNote(`AI reader finished in ${result.seconds.toFixed(1)}s. ${filled} of 6 fields passed auto-fill checks; review suggestions below.`);
    } catch (err) {
      if (!alive.current) return;
      if (controller.signal.aborted) {
        setNote("Read cancelled. You can retry or enter values manually.");
      } else {
        setError(err instanceof Error ? err.message : "Could not read this photo.");
      }
    } finally {
      if (alive.current) setBusy(false);
      if (abort.current === controller) abort.current = null;
    }
  }

  return (
    <section className={styles.photoSection} aria-label="Photo OCR">
      {!imageUrl ? (
        <label className={styles.photoDrop}>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            className={styles.photoInput}
          />
          <span className={styles.photoDropTitle}>Take a photo of the job card</span>
          <span className={styles.photoDropHint}>Tap to open the camera, or choose an image from your device.</span>
        </label>
      ) : (
        <div className={styles.photoReview}>
          <div className={styles.ocrControls}>
            <button
              type="button"
              onClick={readPhoto}
              disabled={busy || !openRouterStatus?.configured}
              className={styles.ocrButton}
            >
              {busy ? "Reading invoice…" : "Read invoice with AI"}
            </button>
            {busy && (
              <button
                type="button"
                onClick={() => abort.current?.abort()}
                className={styles.chooseAgain}
              >
                Cancel read
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                abort.current?.abort();
                onPhotoChange(false);
                setFile(null);
                setImageUrl(null);
                setNote("");
                setError("");
                setSeconds(null);
                if (fileInput.current) fileInput.current.value = "";
              }}
              className={styles.chooseAgain}
            >
              Choose another photo
            </button>
          </div>

          {openRouterStatus?.configured && (
            <p className={styles.ocrNote}>
              AI Reader ready ({openRouterStatus.model}).
            </p>
          )}
          {openRouterStatus && !openRouterStatus.configured && (
            <p className={styles.ocrNoteError} role="alert">
              AI Reader is not configured. Set <code>OPENROUTER_API_KEY</code> in <code>.env.local</code> and restart the app.
            </p>
          )}

          <img
            src={imageUrl}
            alt="Job card for OCR and field review"
            className={styles.preview}
            draggable={false}
          />

          {note && <p className={styles.ocrNote} role="status">{note}</p>}
          {seconds !== null && <p className={styles.ocrNote}>Response time: {seconds.toFixed(1)}s</p>}
          {error && <p className={styles.ocrNoteError} role="alert">{error}</p>}
        </div>
      )}
    </section>
  );
}
