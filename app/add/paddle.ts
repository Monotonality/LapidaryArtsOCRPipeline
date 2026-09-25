import type { OcrLine } from "./field-mapper";
import { toLines } from "./field-mapper";

type Reader = Awaited<ReturnType<typeof import("@paddleocr/paddleocr-js")["PaddleOCR"]["create"]>>;
let readerPromise: Promise<Reader> | null = null;

async function getReader(): Promise<Reader> {
  if (!readerPromise) {
    readerPromise = import("@paddleocr/paddleocr-js")
      .then(({ PaddleOCR }) => PaddleOCR.create({
        lang: "en",
        ocrVersion: "PP-OCRv6",
        worker: true,
        // Match the ORT version in package-lock.json so the worker loads the
        // matching WASM binary instead of guessing a CDN version.
        ortOptions: {
          backend: "auto",
          wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/",
        },
      }))
      .catch((error) => {
        readerPromise = null;
        throw error;
      });
  }
  return readerPromise;
}

export async function readImage(image: Blob, maxSide?: number): Promise<OcrLine[]> {
  const reader = await getReader();
  const [result] = await reader.predict(image, maxSide ? { textDetLimitSideLen: maxSide } : undefined);
  if (!result) throw new Error("OCR returned no result");
  return toLines(result.items, result.image.width, result.image.height);
}
