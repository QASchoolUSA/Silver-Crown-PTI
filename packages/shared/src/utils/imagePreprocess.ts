/**
 * Automatic background image preprocessor for document OCR.
 * Uses Bradley-Roth Adaptive Thresholding (Binarization) & Grayscale Normalization
 * to eliminate phone camera shadows, cab lighting glare, and background paper texture.
 * Turns phone photos into scanner-quality black-and-white document images.
 */
export async function optimizeDocumentImageForOCR(
  file: File | Blob,
  maxDimension: number = 2048
): Promise<{ base64Data: string; mimeType: string }> {
  // If running outside browser (e.g. Node/Cloud Function tests), return simple FileReader base64
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const b64 = await blobToBase64(file);
    return { base64Data: b64, mimeType: (file as File).type || 'image/jpeg' };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      // Maintain aspect ratio while scaling to maxDimension (2048px)
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      // Create in-memory canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        blobToBase64(file).then((b64) =>
          resolve({ base64Data: b64, mimeType: (file as File).type || 'image/jpeg' })
        );
        return;
      }

      // Draw image onto canvas
      ctx.drawImage(img, 0, 0, width, height);

      try {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // 1. Convert RGBA to Grayscale
        const grayscale = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
          // Luminance formula
          const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          grayscale[i / 4] = gray;
        }

        // 2. Compute Integral Image (Summed Area Table for O(1) local mean calculations)
        const integral = new Uint32Array(width * height);
        for (let x = 0; x < width; x++) {
          let sum = 0;
          for (let y = 0; y < height; y++) {
            const index = y * width + x;
            sum += grayscale[index];
            if (x === 0) {
              integral[index] = sum;
            } else {
              integral[index] = integral[index - 1] + sum;
            }
          }
        }

        // 3. Bradley-Roth Adaptive Binarization
        const S = Math.max(16, Math.floor(width / 16)); // Window size
        const s2 = Math.floor(S / 2);
        const t = 0.15; // Threshold percentage (15% darker than surrounding area = ink text)

        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            const index = y * width + x;

            const x1 = Math.max(x - s2, 0);
            const x2 = Math.min(x + s2, width - 1);
            const y1 = Math.max(y - s2, 0);
            const y2 = Math.min(y + s2, height - 1);

            const count = (x2 - x1) * (y2 - y1);

            // Sum = I(x2, y2) - I(x1, y2) - I(x2, y1) + I(x1, y1)
            const sum =
              integral[y2 * width + x2] -
              integral[y1 * width + x2] -
              integral[y2 * width + x1] +
              integral[y1 * width + x1];

            // If pixel luminance is 15% darker than surrounding average, set black (text), else set white (paper)
            const pixelVal = grayscale[index];
            const isDarkText = pixelVal * count < sum * (1.0 - t);
            const outputVal = isDarkText ? 0 : 255;

            const dataIndex = index * 4;
            data[dataIndex] = outputVal; // R
            data[dataIndex + 1] = outputVal; // G
            data[dataIndex + 2] = outputVal; // B
            data[dataIndex + 3] = 255; // Alpha
          }
        }

        ctx.putImageData(imageData, 0, 0);
      } catch (e) {
        console.warn('Bradley adaptive thresholding notice, proceeding with standard render:', e);
      }

      // Export high-quality JPEG base64
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const cleanB64 = dataUrl.split(',')[1] || dataUrl;
      resolve({ base64Data: cleanB64, mimeType: 'image/jpeg' });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      blobToBase64(file).then((b64) =>
        resolve({ base64Data: b64, mimeType: (file as File).type || 'image/jpeg' })
      );
    };

    img.src = objectUrl;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.split(',')[1] || res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
