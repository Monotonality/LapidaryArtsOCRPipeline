"use client";

import { useActionState, useRef, useState } from "react";
import { createRecord } from "./actions";
import {
  runOcr,
  parseOcrText,
  preloadOcrModel,
  type OcrModelKind,
  type OcrProgressHandler,
} from "./ocr";
import styles from "./add.module.css";

type Mode = "form" | "photo";
type OcrState = "idle" | "model" | "reading" | "done" | "error";

type RecordFields = {
  client_name: string;
  phone_number: string;
  date: string;
  date_promised: string;
  instructions: string;
  price: string;
};

const EMPTY: RecordFields = {
  client_name: "",
  phone_number: "",
  date: "",
  date_promised: "",
  instructions: "",
  price: "",
};

export function AddRecord() {
  const [mode, setMode] = useState<Mode>("form");

  const [form, setForm] = useState<RecordFields>(EMPTY);
  const [state, formAction, saving] = useActionState(createRecord, {});

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [model, setModel] = useState<OcrModelKind>("handwritten");
  const [ocrState, setOcrState] = useState<OcrState>("idle");
  const [ocrText, setOcrText] = useState("");
  const [ocrNote, setOcrNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const readStartedRef = useRef(false);

  const handleModelProgress: OcrProgressHandler = ({ file, loaded, total }) => {
    const pct = Math.round((loaded / total) * 100);
    setOcrNote(`Downloading ${file} — ${pct}% (one-time)`);
  };

  function set<K extends keyof RecordFields>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function clearAll() {
    setForm(EMPTY);
    setImageUrl(null);
    setOcrState("idle");
    setOcrText("");
    setOcrNote("");
    readStartedRef.current = false;
    if (fileRef.current) fileRef.current.value = "";
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrState("idle");
    setOcrText("");
    setOcrNote("");
    readStartedRef.current = false;
    const url = URL.createObjectURL(file);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(url);

    preloadOcrModel(model, handleModelProgress)
      .then(() => {
        if (!readStartedRef.current) {
          setOcrNote("Reader ready — press Read card.");
          setOcrState("idle");
        }
      })
      .catch(() => {
        if (!readStartedRef.current) {
          setOcrState("idle");
          setOcrNote("");
        }
      });
  }

  async function handleOcr() {
    if (!imageUrl) return;
    readStartedRef.current = true;
    setOcrState("reading");
    setOcrNote(
      model === "handwritten"
        ? "Reading the card…"
        : "Reading the card… (printed)",
    );
    try {
      const img = document.createElement("img");
      img.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
      });

      const canvas = document.createElement("canvas");
      const maxW = 1200;
      const scale = Math.min(1, maxW / img.naturalWidth);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas context unavailable");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const text = await runOcr(canvas, model, handleModelProgress);

      if (!text.trim()) {
        setOcrState("error");
        setOcrNote("No text recognized — enter the details by hand below.");
        return;
      }

      const parsed = parseOcrText(text);
      setForm((f) => ({
        ...f,
        client_name: parsed.client_name || f.client_name,
        phone_number: parsed.phone_number || f.phone_number,
        date: parsed.date || f.date,
        date_promised: parsed.date_promised || f.date_promised,
        price: parsed.price || f.price,
        instructions: parsed.instructions || f.instructions,
      }));
      setOcrText(text.trim());
      setOcrState("done");
      setOcrNote(
        "Read complete — check the suggested fields below before saving.",
      );
    } catch (err) {
      console.error(err);
      setOcrState("error");
      setOcrNote(
        "Reading failed — enter the details by hand below. If you want to retry, choose the photo again.",
      );
    }
  }

  return (
    <div className={styles.stage}>
      <div className={styles.tabs} role="tablist" aria-label="Add a record">
        <button
          role="tab"
          aria-selected={mode === "form"}
          onClick={() => setMode("form")}
          className={mode === "form" ? styles.tabActive : styles.tab}
        >
          Form
        </button>
        <button
          role="tab"
          aria-selected={mode === "photo"}
          onClick={() => setMode("photo")}
          className={mode === "photo" ? styles.tabActive : styles.tab}
        >
          Photo
        </button>
      </div>

      {mode === "photo" && (
        <section className={styles.photoSection}>
          {!imageUrl ? (
            <label className={styles.photoDrop}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPickFile}
                className={styles.photoInput}
              />
              <span className={styles.photoDropTitle}>
                Take a photo of the job card
              </span>
              <span className={styles.photoDropHint}>
                Tap to open the camera, or choose an image from your device.
              </span>
            </label>
          ) : (
            <div className={styles.photoReview}>
              <img
                src={imageUrl}
                alt="Job card to read"
                className={styles.preview}
              />
              <div className={styles.ocrControls}>
                <label className={styles.ocrModel}>
                  <span>Handwriting</span>
                  <select
                    value={model}
                    onChange={(e) =>
                      setModel(e.target.value as OcrModelKind)
                    }
                    disabled={ocrState === "reading" || ocrState === "model"}
                    className={styles.select}
                  >
                    <option value="handwritten">Handwritten</option>
                    <option value="printed">Printed</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleOcr}
                  disabled={ocrState === "reading" || ocrState === "model"}
                  className={styles.ocrButton}
                >
                  {ocrState === "reading"
                    ? "Reading…"
                    : ocrState === "model"
                      ? "Preparing…"
                      : "Read card"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl(null);
                    setOcrState("idle");
                    setOcrText("");
                    setOcrNote("");
                    readStartedRef.current = false;
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className={styles.chooseAgain}
                >
                  Choose another photo
                </button>
              </div>
              {ocrNote && (
                <p
                  className={
                    ocrState === "error"
                      ? styles.ocrNoteError
                      : ocrState === "done"
                        ? styles.ocrNoteDone
                        : styles.ocrNote
                  }
                >
                  {ocrNote}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {ocrText && (
        <details className={styles.rawText}>
          <summary>OCR output</summary>
          <pre className={styles.rawPre}>{ocrText}</pre>
        </details>
      )}

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="client_name" value={form.client_name} />
        <input type="hidden" name="phone_number" value={form.phone_number} />
        <input type="hidden" name="date" value={form.date} />
        <input type="hidden" name="date_promised" value={form.date_promised} />
        <input type="hidden" name="instructions" value={form.instructions} />
        <input type="hidden" name="price" value={form.price} />

        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Client name</span>
            <input
              type="text"
              value={form.client_name}
              onChange={(e) => set("client_name", e.target.value)}
              required
              autoComplete="off"
              placeholder="e.g. Margaret Ellison"
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Phone number</span>
            <input
              type="tel"
              value={form.phone_number}
              onChange={(e) => set("phone_number", e.target.value)}
              autoComplete="off"
              placeholder="e.g. 214-555-0137"
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Date promised</span>
            <input
              type="date"
              value={form.date_promised}
              onChange={(e) => set("date_promised", e.target.value)}
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Price</span>
            <input
              type="text"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              autoComplete="off"
              placeholder="e.g. 125.50"
              className={styles.input}
            />
          </label>

          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.fieldLabel}>
              Instructions / article details
            </span>
            <textarea
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              rows={4}
              placeholder="e.g. Ring sizing; reset two stones."
              className={styles.textarea}
            />
          </label>
        </div>

        {state.error && (
          <p role="alert" className={styles.alertError}>
            {state.error}
          </p>
        )}

        <div className={styles.formActions}>
          <button
            type="submit"
            disabled={saving}
            className={styles.saveButton}
          >
            {saving ? "Saving…" : "Save record"}
          </button>
          <button type="button" onClick={clearAll} className={styles.clearButton}>
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}