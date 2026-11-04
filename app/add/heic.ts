export async function isHeic(file: File): Promise<boolean> {
  const type = (file.type || "").toLowerCase();
  if (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence"
  ) {
    return true;
  }
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".heic") || name.endsWith(".heif") || name.endsWith(".hif")) {
    return true;
  }
  try {
    if (file.size >= 12) {
      const slice = file.slice(0, 32);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes.length >= 12) {
        const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
        if (ftyp === "ftyp") {
          const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
          const heicBrands = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"];
          if (heicBrands.includes(brand)) {
            return true;
          }
        }
      }
    }
  } catch {
    // If slice fails, rely on type/name checks
  }
  return false;
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  // 1. First attempt: Client-side decoding via heic-decode and in-memory canvas
  try {
    if (typeof window !== "undefined") {
      const { default: decode } = await import("heic-decode");
      const buffer = await file.arrayBuffer();
      const { width, height, data } = await decode({ buffer });

      const scale = Math.min(1, 1600 / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext("2d");

      if (tempCtx) {
        const imgData = tempCtx.createImageData(width, height);
        imgData.data.set(data);
        tempCtx.putImageData(imgData, 0, 0);

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
          tempCanvas.width = 0;
          tempCanvas.height = 0;

          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.9)
          );

          if (blob && blob.size > 0) {
            const newName = file.name.replace(/\.hei[cf]$/i, "") + ".jpg";
            return new File([blob], newName, { type: "image/jpeg" });
          }
        }
      }
    }
  } catch (clientError) {
    console.warn("Client HEIC decoding failed, trying server-side conversion fallback:", clientError);
  }

  // 2. Second attempt: Server-side conversion route (/api/convert-image)
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/convert-image", {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) {
        const newName = file.name.replace(/\.hei[cf]$/i, "") + ".jpg";
        return new File([blob], newName, { type: "image/jpeg" });
      }
    }
  } catch (serverError) {
    console.warn("Server HEIC conversion failed:", serverError);
  }

  throw new Error("Could not decode this HEIC photo. Please select or take a JPEG or PNG photo.");
}
