import { createWorker } from 'tesseract.js';
import { OCRResult, ExpenseItem } from '../types';

export interface OCRProgressCallback {
  (status: string, progress: number): void;
}

/**
 * Validates uploaded image format and file size
 */
export function validateReceiptImage(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Please upload a valid receipt image (JPG, JPEG, or PNG).',
    };
  }

  // 15 MB limit
  if (file.size > 15 * 1024 * 1024) {
    return {
      valid: false,
      error: 'Image file is too large. Please select a photo under 15MB.',
    };
  }

  return { valid: true };
}

/**
 * Preprocesses receipt image on an HTML5 canvas:
 * 1. Resizes to optimal resolution (max 1800px) to balance OCR speed and clarity
 * 2. Converts to high-contrast grayscale
 * 3. Normalizes light/dark thresholds to maximize Tesseract character recognition
 */
export async function preprocessReceiptImage(
  imageSource: string | File | Blob
): Promise<{ processedDataUrl: string; originalDataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    let sourceDataUrl = '';

    const handleLoadedImage = (img: HTMLImageElement, rawUrl: string) => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 1800;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({
            processedDataUrl: rawUrl,
            originalDataUrl: rawUrl,
            width: img.width,
            height: img.height,
          });
        }

        // Draw image resized
        ctx.drawImage(img, 0, 0, width, height);

        // Get pixel data for contrast enhancement & binarization
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Find min and max brightness for adaptive contrast stretch
        let minLum = 255;
        let maxLum = 0;

        for (let i = 0; i < data.length; i += 4) {
          // Grayscale luminance formula
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (lum < minLum) minLum = lum;
          if (lum > maxLum) maxLum = lum;
        }

        const lumRange = Math.max(1, maxLum - minLum);

        // Apply contrast stretch and slight threshold darkening on text
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          let normalized = ((lum - minLum) / lumRange) * 255;

          // Increase contrast: darken ink, whiten paper background
          if (normalized < 130) {
            normalized = Math.max(0, normalized * 0.7);
          } else {
            normalized = Math.min(255, normalized * 1.15 + 10);
          }

          data[i] = normalized;     // R
          data[i + 1] = normalized; // G
          data[i + 2] = normalized; // B
        }

        ctx.putImageData(imgData, 0, 0);
        const processed = canvas.toDataURL('image/jpeg', 0.88);

        resolve({
          processedDataUrl: processed,
          originalDataUrl: rawUrl,
          width,
          height,
        });
      } catch (err) {
        console.warn('Canvas preprocessing notice:', err);
        resolve({
          processedDataUrl: rawUrl,
          originalDataUrl: rawUrl,
          width: img.width,
          height: img.height,
        });
      }
    };

    if (typeof imageSource === 'string') {
      sourceDataUrl = imageSource;
      const img = new Image();
      img.onload = () => handleLoadedImage(img, sourceDataUrl);
      img.onerror = reject;
      img.src = imageSource;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        sourceDataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => handleLoadedImage(img, sourceDataUrl);
        img.onerror = reject;
        img.src = sourceDataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageSource);
    }
  });
}

/**
 * Runs Tesseract.js v7 locally in the browser with progress streaming
 */
export async function runLocalTesseractOCR(
  imageSource: string,
  onProgress?: OCRProgressCallback
): Promise<string> {
  let worker: any = null;
  try {
    if (onProgress) onProgress('Initializing OCR engine...', 10);

    worker = await createWorker('eng', 1, {
      logger: (m: any) => {
        if (m && m.status && typeof m.progress === 'number' && onProgress) {
          let friendlyStatus = 'Processing image...';
          if (m.status.includes('loading')) friendlyStatus = 'Loading language model...';
          else if (m.status.includes('recognizing')) friendlyStatus = 'Recognizing text & numbers...';
          else if (m.status.includes('init')) friendlyStatus = 'Configuring OCR worker...';

          const pct = Math.min(100, Math.max(10, Math.round(m.progress * 90) + 10));
          onProgress(friendlyStatus, pct);
        }
      },
    });

    if (onProgress) onProgress('Extracting text from receipt...', 60);
    const result = await worker.recognize(imageSource);
    const text = result?.data?.text || '';

    if (onProgress) onProgress('Finalizing extraction...', 100);
    return text;
  } catch (err: any) {
    console.error('Tesseract local OCR error:', err);
    throw new Error(err.message || 'Tesseract OCR recognition failed.');
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {}
    }
  }
}

/**
 * Heuristic receipt parser that extracts merchant, date, items, subtotal, tax, service charge, and total
 */
export function parseReceiptText(rawText: string, defaultCurrency: string = 'LKR'): OCRResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let merchant = 'Restaurant / Merchant';
  let date = new Date().toISOString().slice(0, 10);
  let subtotal = 0;
  let serviceCharge = 0;
  let tax = 0;
  let total = 0;
  const items: ExpenseItem[] = [];
  const discrepancies: string[] = [];

  // Noise words to skip when identifying merchant name
  const headerIgnoreRegex = /^(tax invoice|receipt|cash bill|bill|welcome|customer copy|original|duplicate|tel:|phone:|no:|table|st:|street|road|pvt|ltd|reg|gst|vat)/i;

  // 1. Merchant Extraction: inspect top 6 non-empty lines
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const candidate = lines[i].replace(/[^\w\s&'-]/g, '').trim();
    if (candidate.length >= 3 && !headerIgnoreRegex.test(candidate) && !/\d{4}/.test(candidate)) {
      merchant = candidate;
      break;
    }
  }

  // 2. Date Extraction
  const dateRegexes = [
    /\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/,                     // YYYY-MM-DD
    /\b(\d{1,2}[-/.]\d{1,2}[-/.](?:20)?\d{2})\b/,               // DD/MM/YYYY or DD-MM-YY
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:20)?\d{2})\b/i, // DD Mon YYYY
  ];

  for (const line of lines) {
    let matchedDate = false;
    for (const r of dateRegexes) {
      const match = line.match(r);
      if (match) {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime())) {
          date = parsed.toISOString().slice(0, 10);
          matchedDate = true;
          break;
        }
      }
    }
    if (matchedDate) break;
  }

  // Helper to extract the last valid decimal/number in a string
  const extractTrailingNumber = (str: string): number | null => {
    // Matches numbers like "4,200.00", "24650.00", "4200", "190.50"
    const matches = str.match(/(?:(?:rs\.?|lkr|\$|€|£)\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi);
    if (!matches || matches.length === 0) return null;
    const lastMatch = matches[matches.length - 1].replace(/[^\d.]/g, '');
    const num = parseFloat(lastMatch);
    return isNaN(num) ? null : num;
  };

  // 3. Scan lines for Summary totals and Line Items
  const summaryKeywords = [
    'subtotal',
    'sub total',
    'sub-total',
    'service charge',
    'svc chg',
    'service',
    'tax',
    'vat',
    'gst',
    'sscl',
    'grand total',
    'net total',
    'total amount',
    'total due',
    'amount due',
    'total',
    'cash',
    'change',
    'balance',
    'paid',
    'visa',
    'mastercard',
  ];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const lower = line.toLowerCase();

    // Check for Service Charge
    if (lower.includes('service charge') || lower.includes('svc chg') || lower.includes('service 10%') || lower.includes('sc 10%')) {
      const val = extractTrailingNumber(line);
      if (val !== null && val > 0) serviceCharge = val;
      continue;
    }

    // Check for Tax / VAT
    if (lower.includes('tax') || lower.includes('vat') || lower.includes('gst') || lower.includes('sscl')) {
      const val = extractTrailingNumber(line);
      if (val !== null && val > 0) tax = val;
      continue;
    }

    // Check for Subtotal
    if (lower.includes('subtotal') || lower.includes('sub total') || lower.includes('sub-total')) {
      const val = extractTrailingNumber(line);
      if (val !== null && val > 0) subtotal = val;
      continue;
    }

    // Check for Grand Total
    if (
      lower.includes('grand total') ||
      lower.includes('net total') ||
      lower.includes('total amount') ||
      lower.includes('total due') ||
      lower.includes('amount due') ||
      (/^total\b/i.test(line) && !lower.includes('subtotal') && !lower.includes('item'))
    ) {
      const val = extractTrailingNumber(line);
      if (val !== null && val > 0) total = val;
      continue;
    }

    // If it's another non-item summary/footer line, skip
    const isSummaryLine = summaryKeywords.some((kw) => lower.includes(kw));
    if (isSummaryLine) continue;

    // Line Item parsing candidate
    const price = extractTrailingNumber(line);
    if (price !== null && price > 0 && price < 1000000) {
      // Remove the trailing price from the line to parse the name and quantity
      const textWithoutPrice = line
        .replace(/(?:(?:rs\.?|lkr|\$|€|£)\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*$/i, '')
        .trim();

      // Check for leading or embedded quantity (e.g. "2x Pizza", "2 Lamprais", "Mojito 4 x 1950")
      let qty = 1;
      let unitPrice = price;

      const leadingQtyMatch = textWithoutPrice.match(/^([1-9][0-9]?)\s*(?:x|\*|@|\s)\s*(.*)/i);
      const multiPriceMatch = textWithoutPrice.match(/(.*?)\s+([1-9][0-9]?)\s*(?:x|\*|@)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);

      let itemName = textWithoutPrice;

      if (multiPriceMatch) {
        itemName = multiPriceMatch[1].trim();
        qty = parseInt(multiPriceMatch[2], 10) || 1;
        unitPrice = parseFloat(multiPriceMatch[3]) || price / qty;
      } else if (leadingQtyMatch) {
        qty = parseInt(leadingQtyMatch[1], 10) || 1;
        itemName = leadingQtyMatch[2].trim();
        unitPrice = Math.round((price / qty) * 100) / 100;
      }

      // Clean item name of noise characters
      itemName = itemName.replace(/^[-*•.#\d\s]+/, '').replace(/[-*•._]+$/, '').trim();

      // Validate that itemName has substantive word characters
      if (itemName.length >= 2 && /[a-zA-Z]/.test(itemName)) {
        items.push({
          id: `ocr_item_${Date.now()}_${items.length}`,
          name: itemName,
          quantity: qty,
          unitPrice,
          totalPrice: price,
          confidence: 0.95,
        });
      }
    }
  }

  // 4. Mathematical cross-checking & fallbacks
  const computedItemsSubtotal = items.reduce((sum, item) => sum + (item.totalPrice || item.quantity * item.unitPrice), 0);

  if (subtotal === 0 && computedItemsSubtotal > 0) {
    subtotal = computedItemsSubtotal;
  }

  if (total === 0) {
    total = Math.round((subtotal + serviceCharge + tax) * 100) / 100;
  } else {
    // Check if total matches sum of components
    const expectedTotal = Math.round((subtotal + serviceCharge + tax) * 100) / 100;
    if (Math.abs(expectedTotal - total) > 1.0) {
      discrepancies.push(
        `Extracted grand total (${total.toFixed(2)}) differs from calculated sum (${expectedTotal.toFixed(2)}). Please verify items and charges.`
      );
    }
  }

  return {
    merchant: merchant || 'Restaurant / Cafe',
    date,
    currency: defaultCurrency,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    serviceCharge: Math.round(serviceCharge * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
    discrepancies,
    rawText,
  };
}
