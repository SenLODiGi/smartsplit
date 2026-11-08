import { createWorker } from 'tesseract.js';
import { OCRResult, ExpenseItem, ReceiptMetadata } from '../types';

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

export interface OCRLineInfo {
  text: string;
  confidence: number;
}

/**
 * Runs Tesseract.js v7 locally in the browser with progress streaming and line confidence
 */
export async function runLocalTesseractOCR(
  imageSource: string,
  onProgress?: OCRProgressCallback
): Promise<{ text: string; lines: OCRLineInfo[] }> {
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
    const rawLines = result?.data?.lines || [];

    const lines: OCRLineInfo[] = rawLines.map((l: any) => ({
      text: (l.text || '').trim(),
      confidence: typeof l.confidence === 'number' ? Math.round(l.confidence) / 100 : 0.9,
    })).filter((l: OCRLineInfo) => l.text.length > 0);

    if (onProgress) onProgress('Finalizing extraction...', 100);
    return { text, lines };
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

// Culinary and retail indicator keywords (protect legitimate products from address false positives)
export const FOOD_BEVERAGE_INDICATORS = /\b(?:kottu|roti|curry|meal|dhal|paan|sambol|lager|juice|water|rice|noodle|biriyani|hopper|pizza|burger|sandwich|pasta|steak|soup|salad|chicken|fish|prawn|mutton|beef|pork|cheese|egg|coffee|tea|shake|dessert|ice\s*cream|cake|brownie|beer|wine|soda|coke|sprite|portion|side|dish|special|combo|sub|bread|butter|jam|milk|biscuit|snack|roll|pastry|pie|fries|chips|nuggets|wrap|heineken|carlsberg|lion|mojito|margarita|espresso|latte|cappuccino)\b/i;

// Regular expressions for detecting and capturing receipt metadata
export const PHONE_REGEX = /(?:tel|telephone|phone|ph|mobile|mob|hotline|fax|contact)\s*[:.]?\s*([+\d\s()-]{7,20})|(?:\+94|0094)\s*[\d\s-]{6,15}|\b0(?:11|7[0-8]|81|91|2\d|3\d|4\d|5\d)[\d\s-]{6,12}\b/i;
export const DATE_REGEX = /\b(?:date|dated|dt)?\s*[:.]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}|20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/i;
export const TIME_REGEX = /\b(?:time\s*[:.]?\s*)?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)\b/i;
export const TABLE_REGEX = /\b(?:table|tbl|tab|table\s*no\.?)\s*[:#-]?\s*([A-Za-z0-9-]+)\b/i;
export const SERVER_REGEX = /\b(?:server|waiter|steward|cashier|operator|staff|clerk)\s*[:.-]?\s*([A-Za-z0-9]+)\b/i;
export const RECEIPT_NO_REGEX = /\b(?:receipt|bill|invoice|inv|order|token|check|chk|trans|txn)\s*(?:#|no\.?|num|number)?\s*[:.-]?\s*([A-Za-z0-9-]+)\b/i;
export const TAX_NO_REGEX = /\b(?:vat|tin|svat|brn|reg|gst|sscl|nbt)\s*(?:#|no\.?|reg|number)?\s*[:.-]?\s*([A-Za-z0-9-]+)\b/i;

export const STREET_INDICATORS = /\b(?:galle\s*road|main\s*street|beach\s*road|temple\s*road|high\s*level\s*road|baseline\s*road|duplication\s*road|kandy\s*road|negombo\s*road|peradeniya\s*road|havelock\s*road|reid\s*avenue|bauddhaloka\s*mawatha|dharmapala\s*mawatha)\b|\b(?:road|rd\.?|street|st\.?|lane|ln\.?|avenue|ave\.?|mawatha|mw\.?|place|pl\.?|drive|dr\.?|highway|bldg|building|floor|suite|apt|apartment|po\s*box|p\.o\.\s*box)\b/i;
export const CITY_COUNTRY_INDICATORS = /\b(?:colombo\s*(?:0?[1-9]|1[0-5])?|kandy|galle|negombo|ella|mirissa|jaffna|matara|kurunegala|nuwara\s*eliya|batticaloa|bentota|hikkaduwa|sri\s*lanka)\b/i;

export function cleanMonetaryNumber(str: string): number {
  return parseFloat(str.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0;
}

export function extractTrailingMonetaryNumber(str: string): { amount: number; rawMatched: string } | null {
  const matches = str.match(/(?:(?:rs\.?|lkr|\$|€|£)\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*$/i);
  if (!matches || matches.length === 0) return null;
  const amount = cleanMonetaryNumber(matches[1]);
  return amount > 0 && amount < 10000000 ? { amount, rawMatched: matches[0] } : null;
}

export type LineCategory = 'RECEIPT_METADATA' | 'PURCHASED_ITEM' | 'TOTAL_INFO' | 'OTHER';

export interface ClassifiedLine {
  line: string;
  category: LineCategory;
  type: string;
  metadataField?: keyof ReceiptMetadata;
  extractedValue?: string | number;
}

/**
 * Robust line classifier categorizing every OCR text line into:
 * A. RECEIPT_METADATA (Business, Address, Phone, Date/Time, Table, Receipt/Trans #, Tax #)
 * B. PURCHASED_ITEM (Food, Drinks, Groceries, Goods)
 * C. TOTAL_INFO (Subtotal, Tax, VAT, Service Charge, Discount, Grand Total)
 * D. OTHER (Separators, Column Headers, Payment Info, Greetings, Footers)
 */
export function classifyReceiptLine(
  rawLine: string,
  index: number,
  allLines: string[],
  currentMetadata: ReceiptMetadata
): ClassifiedLine {
  const line = rawLine.trim();
  const lower = line.toLowerCase();

  // 1. Category D: OTHER (Separators, Headers, Payment, Footers)
  if (/^[-=_*#~.\s]{3,}$/.test(line)) {
    return { line, category: 'OTHER', type: 'SEPARATOR' };
  }

  // Column Headers (e.g. "Item Qty Price Amount")
  const headerKeywords = ['item', 'desc', 'description', 'qty', 'quantity', 'price', 'rate', 'amount', 'total'];
  const headerMatches = headerKeywords.filter((w) => lower.includes(w)).length;
  if (headerMatches >= 2 && !/[0-9]{2,}/.test(line)) {
    return { line, category: 'OTHER', type: 'COLUMN_HEADER' };
  }

  // Payment / Tender / Change
  if (/^(?:cash|change|balance|paid|tendered|visa|mastercard|amex|debit|credit|auth\s*code|eftpos)\b/i.test(lower)) {
    return { line, category: 'OTHER', type: 'PAYMENT_INFO' };
  }

  // Promotional greetings / Footers
  if (
    /^(?:thank\s*you|visit\s*again|welcome|feedback|have\s*a\s*(?:nice|pleasant|great)\s*day|powered\s*by|printed\s*on|customer\s*copy|merchant\s*copy|original|duplicate)/i.test(
      lower
    )
  ) {
    return { line, category: 'OTHER', type: 'FOOTER_PROMO' };
  }

  // 2. Category C: TOTAL_INFO
  // Service Charge
  if (
    lower.includes('service charge') ||
    lower.includes('svc chg') ||
    lower.includes('service 10%') ||
    lower.includes('sc 10%') ||
    /^(?:service|svc)\s*[:.]?\s*[\d.]+/i.test(lower)
  ) {
    const val = extractTrailingMonetaryNumber(line);
    return { line, category: 'TOTAL_INFO', type: 'SERVICE_CHARGE', extractedValue: val?.amount };
  }

  // Subtotal
  if (
    lower.includes('subtotal') ||
    lower.includes('sub total') ||
    lower.includes('sub-total') ||
    lower.includes('gross amount') ||
    lower.includes('item total')
  ) {
    const val = extractTrailingMonetaryNumber(line);
    return { line, category: 'TOTAL_INFO', type: 'SUBTOTAL', extractedValue: val?.amount };
  }

  // Tax / VAT
  if (
    (/\b(?:tax|vat|gst|sscl|nbt)\b/i.test(lower) && !lower.includes('invoice') && !lower.includes('reg') && !lower.includes('tin') && !lower.includes('table')) ||
    /\bvat\s*\(\d+%\)/i.test(lower)
  ) {
    const val = extractTrailingMonetaryNumber(line);
    if (val && val.amount > 0) {
      return { line, category: 'TOTAL_INFO', type: 'TAX', extractedValue: val?.amount };
    }
  }

  // Discount
  if (/\b(?:discount|disc|less\s*disc|promo)\b/i.test(lower)) {
    const val = extractTrailingMonetaryNumber(line);
    return { line, category: 'TOTAL_INFO', type: 'DISCOUNT', extractedValue: val?.amount };
  }

  // Grand Total
  if (
    lower.includes('grand total') ||
    lower.includes('net total') ||
    lower.includes('total amount') ||
    lower.includes('total due') ||
    lower.includes('amount due') ||
    lower.includes('balance due') ||
    (/^total\b/i.test(lower) && !lower.includes('item'))
  ) {
    const val = extractTrailingMonetaryNumber(line);
    return { line, category: 'TOTAL_INFO', type: 'GRAND_TOTAL', extractedValue: val?.amount };
  }

  // 3. Category A: RECEIPT_METADATA
  const hasFoodIndicator = FOOD_BEVERAGE_INDICATORS.test(line);

  // Phone / Contact
  if (
    /\b(?:tel|telephone|phone|ph|mobile|mob|hotline|fax|contact)\s*[:.]?/i.test(lower) ||
    PHONE_REGEX.test(line)
  ) {
    if (!hasFoodIndicator) {
      return { line, category: 'RECEIPT_METADATA', type: 'PHONE', metadataField: 'phone' };
    }
  }

  // Date / Time
  if (
    /\b(?:date|dated|dt)\s*[:.]?/i.test(lower) ||
    /\b(?:time)\s*[:.]?/i.test(lower) ||
    DATE_REGEX.test(line) ||
    TIME_REGEX.test(line)
  ) {
    if (!hasFoodIndicator) {
      return { line, category: 'RECEIPT_METADATA', type: 'DATETIME', metadataField: 'dateTime' };
    }
  }

  // Table / Seating / Staff
  if (
    /\b(?:table|tbl|tab|seat)\s*[:#-]?/i.test(lower) ||
    /\b(?:server|waiter|steward|cashier|operator|station)\s*[:.-]?/i.test(lower)
  ) {
    if (!hasFoodIndicator) {
      return { line, category: 'RECEIPT_METADATA', type: 'TABLE_STAFF', metadataField: 'tableNo' };
    }
  }

  // Receipt / Bill / Invoice / Transaction
  if (
    /\b(?:receipt|bill|invoice|inv|order|token|check|chk|trans|txn|transaction)\s*(?:#|no\.?|num)?\s*[:.-]?/i.test(lower)
  ) {
    if (!hasFoodIndicator) {
      return { line, category: 'RECEIPT_METADATA', type: 'RECEIPT_TRANS', metadataField: 'receiptNo' };
    }
  }

  // Tax Registration / VAT TIN #
  if (
    /\b(?:vat|tin|svat|brn|reg|gst|sscl|nbt)\s*(?:#|no\.?|reg|number)\s*[:.-]?/i.test(lower) ||
    TAX_NO_REGEX.test(line)
  ) {
    if (!hasFoodIndicator) {
      return { line, category: 'RECEIPT_METADATA', type: 'TAX_REG', metadataField: 'taxNo' };
    }
  }

  // Street Address
  if (STREET_INDICATORS.test(line) && !hasFoodIndicator) {
    return { line, category: 'RECEIPT_METADATA', type: 'ADDRESS', metadataField: 'address' };
  }

  // City / Country / Postal
  if (CITY_COUNTRY_INDICATORS.test(line) && !hasFoodIndicator) {
    return { line, category: 'RECEIPT_METADATA', type: 'CITY_COUNTRY', metadataField: 'city' };
  }

  // Top Business Name (First 1-3 lines of receipt)
  if (index < 3 && !currentMetadata.businessName) {
    const isCleanBusiness =
      line.length >= 3 &&
      !/[0-9]{3,}/.test(line) &&
      !/^(?:welcome|receipt|tax|bill)/i.test(lower) &&
      !extractTrailingMonetaryNumber(line);
    if (isCleanBusiness) {
      return { line, category: 'RECEIPT_METADATA', type: 'BUSINESS_NAME', metadataField: 'businessName' };
    }
  }

  // 4. Category B: PURCHASED_ITEM
  // Must have a valid trailing monetary number (item price)
  const parsedPrice = extractTrailingMonetaryNumber(line);
  if (parsedPrice && parsedPrice.amount > 0) {
    const textBeforePrice = line.slice(0, line.length - parsedPrice.rawMatched.length).trim();
    if (textBeforePrice.length >= 2 && /[a-zA-Z]/.test(textBeforePrice)) {
      const isMetadataPrefix = /^(?:tel|phone|date|time|table|tab|server|waiter|cashier|trans|bill|receipt|inv|address|st|road|colombo)\b/i.test(textBeforePrice);
      if (!isMetadataPrefix) {
        return { line, category: 'PURCHASED_ITEM', type: 'FOOD_OR_PRODUCT' };
      }
    }
  }

  // Default to OTHER (unclassified / noise)
  return { line, category: 'OTHER', type: 'UNCLASSIFIED' };
}

/**
 * Intelligent receipt parser:
 * 1. Accurately classifies every OCR line into RECEIPT_METADATA, PURCHASED_ITEM, TOTAL_INFO, or OTHER
 * 2. ONLY lines classified as PURCHASED_ITEM are extracted as bill expense_items
 * 3. Metadata (Address, Phone, Date, Table, Invoice #, etc.) is isolated in ReceiptMetadata
 * 4. Extracts item description, quantity, unit price, and total price correctly
 * 5. Mathematically checks subtotal, tax, service charge, and grand total
 */
export function parseReceiptText(
  rawInput: string | { text: string; lines: OCRLineInfo[] },
  defaultCurrency: string = 'LKR',
  rawLinesInput?: OCRLineInfo[]
): OCRResult {
  const rawText = typeof rawInput === 'string' ? rawInput : rawInput.text;
  const lineConfidenceMap = new Map<string, number>();

  if (typeof rawInput !== 'string' && Array.isArray(rawInput.lines)) {
    rawInput.lines.forEach((l) => lineConfidenceMap.set(l.text.trim().toLowerCase(), l.confidence));
  } else if (Array.isArray(rawLinesInput)) {
    rawLinesInput.forEach((l) => lineConfidenceMap.set(l.text.trim().toLowerCase(), l.confidence));
  }

  const allLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let merchant = 'Restaurant / Merchant';
  let date = new Date().toISOString().slice(0, 10);
  let subtotal = 0;
  let serviceCharge = 0;
  let tax = 0;
  let total = 0;

  const metadata: ReceiptMetadata = {};
  const items: ExpenseItem[] = [];
  const discrepancies: string[] = [];

  // 1. First Pass: Classify all lines and extract Metadata + Totals
  const classifiedLines: ClassifiedLine[] = [];

  for (let i = 0; i < allLines.length; i++) {
    const cl = classifyReceiptLine(allLines[i], i, allLines, metadata);
    classifiedLines.push(cl);

    if (cl.category === 'RECEIPT_METADATA') {
      if (cl.type === 'BUSINESS_NAME' && !metadata.businessName) {
        metadata.businessName = cl.line;
        merchant = cl.line;
      } else if (cl.type === 'PHONE' && !metadata.phone) {
        const phoneMatch = cl.line.match(PHONE_REGEX);
        metadata.phone = (phoneMatch ? phoneMatch[1] || phoneMatch[0] : cl.line).trim();
      } else if (cl.type === 'DATETIME' && !metadata.dateTime) {
        const dateMatch = cl.line.match(DATE_REGEX);
        const timeMatch = cl.line.match(TIME_REGEX);
        metadata.dateTime = `${dateMatch ? dateMatch[1] : ''} ${timeMatch ? timeMatch[1] : ''}`.trim() || cl.line;
        if (dateMatch) {
          const parsed = new Date(dateMatch[1]);
          if (!isNaN(parsed.getTime())) date = parsed.toISOString().slice(0, 10);
        }
      } else if (cl.type === 'TABLE_STAFF') {
        const tableMatch = cl.line.match(TABLE_REGEX);
        const serverMatch = cl.line.match(SERVER_REGEX);
        if (tableMatch && !metadata.tableNo) metadata.tableNo = tableMatch[1].trim();
        if (serverMatch && !metadata.serverName) metadata.serverName = serverMatch[1].trim();
        if (!metadata.tableNo && !metadata.serverName) metadata.tableNo = cl.line;
      } else if (cl.type === 'RECEIPT_TRANS') {
        const receiptMatch = cl.line.match(RECEIPT_NO_REGEX);
        if (receiptMatch && !metadata.receiptNo) metadata.receiptNo = receiptMatch[1].trim();
        if (!metadata.receiptNo) metadata.receiptNo = cl.line;
      } else if (cl.type === 'TAX_REG') {
        const taxMatch = cl.line.match(TAX_NO_REGEX);
        if (taxMatch && !metadata.taxNo) metadata.taxNo = taxMatch[1].trim();
        if (!metadata.taxNo) metadata.taxNo = cl.line;
      } else if (cl.type === 'ADDRESS' && !metadata.address) {
        metadata.address = cl.line;
      } else if (cl.type === 'CITY_COUNTRY' && !metadata.city) {
        metadata.city = cl.line;
      }
    } else if (cl.category === 'TOTAL_INFO') {
      if (cl.type === 'SUBTOTAL' && typeof cl.extractedValue === 'number') {
        subtotal = cl.extractedValue;
      } else if (cl.type === 'SERVICE_CHARGE' && typeof cl.extractedValue === 'number') {
        serviceCharge = cl.extractedValue;
      } else if (cl.type === 'TAX' && typeof cl.extractedValue === 'number') {
        tax = cl.extractedValue;
      } else if (cl.type === 'GRAND_TOTAL' && typeof cl.extractedValue === 'number') {
        total = cl.extractedValue;
      }
    }
  }

  // 2. Second Pass: Extract Line Items ONLY from Category B (PURCHASED_ITEM)
  for (let i = 0; i < classifiedLines.length; i++) {
    const cl = classifiedLines[i];
    if (cl.category !== 'PURCHASED_ITEM') {
      // NEVER process metadata, totals, or other noise as purchased items
      continue;
    }

    const line = cl.line;
    const parsedPrice = extractTrailingMonetaryNumber(line);
    if (!parsedPrice || parsedPrice.amount <= 0) continue;

    const totalPrice = parsedPrice.amount;
    const textBeforePrice = line.slice(0, line.length - parsedPrice.rawMatched.length).trim();
    if (textBeforePrice.length < 2) continue;

    let itemName = textBeforePrice;
    let qty = 1;
    let unitPrice = totalPrice;

    // Pattern A1: Multi-price format -> "Lion Lager 2 x 800.00" or "Roast Paan 2 @ 200.00"
    const multiPriceMatch = textBeforePrice.match(
      /^(.*?)\s+([1-9][0-9]?)\s*(?:x|@|\*)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*$/i
    );
    // Pattern A2: Space-separated columns -> "Roast Paan (Portion) 2 250.00"
    const spaceColMatch = textBeforePrice.match(
      /^(.*?)\s+([1-9][0-9]?)\s+([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*$/
    );

    if (multiPriceMatch) {
      itemName = multiPriceMatch[1].trim();
      qty = parseInt(multiPriceMatch[2], 10) || 1;
      unitPrice = cleanMonetaryNumber(multiPriceMatch[3]) || Math.round((totalPrice / qty) * 100) / 100;
    } else if (spaceColMatch) {
      const candidateQty = parseInt(spaceColMatch[2], 10) || 1;
      const candidateUnitPrice = cleanMonetaryNumber(spaceColMatch[3]);
      if (candidateUnitPrice > 0 && Math.abs(candidateQty * candidateUnitPrice - totalPrice) < 1.0) {
        itemName = spaceColMatch[1].trim();
        qty = candidateQty;
        unitPrice = candidateUnitPrice;
      }
    } else {
      // Pattern B: Trailing column quantity -> "Chicken Kottu Roti    1" or "Roast Paan (Portion)  2"
      const trailingQtyMatch = textBeforePrice.match(/^(.*?)\s+([1-9][0-9]?)\s*$/);
      if (trailingQtyMatch && trailingQtyMatch[1].trim().length >= 2) {
        itemName = trailingQtyMatch[1].trim();
        qty = parseInt(trailingQtyMatch[2], 10) || 1;
        unitPrice = Math.round((totalPrice / qty) * 100) / 100;
      } else {
        // Pattern C: Leading quantity -> "2x Lion Lager" or "2 Lion Lager"
        const leadingQtyMatch = textBeforePrice.match(/^([1-9][0-9]?)\s*(?:x|\*|@|\s)\s*(.+)$/i);
        if (leadingQtyMatch && leadingQtyMatch[2].trim().length >= 2) {
          qty = parseInt(leadingQtyMatch[1], 10) || 1;
          itemName = leadingQtyMatch[2].trim();
          unitPrice = Math.round((totalPrice / qty) * 100) / 100;
        }
      }
    }

    // Clean leading bullets or numbering from itemName (preserve branded names like 7-Up)
    itemName = itemName
      .replace(/^[-*•#~]+\s*/, '')
      .replace(/^\d+[\.\)]\s+/, '')
      .replace(/[-*•._\s]+$/, '')
      .trim();

    // Sanity filter: Must have at least 2 characters, contain letters, and not be pure metadata
    const isMetadataText = /^(?:address|tel|telephone|phone|date|time|table|server|waiter|cashier|receipt|invoice|total|tax|subtotal|vat)\b/i.test(itemName);
    const hasRoadWithoutFood = (STREET_INDICATORS.test(itemName) || CITY_COUNTRY_INDICATORS.test(itemName)) && !FOOD_BEVERAGE_INDICATORS.test(itemName);

    if (itemName.length >= 2 && /[a-zA-Z]/.test(itemName) && !isMetadataText && !hasRoadWithoutFood) {
      const tesseractConf = lineConfidenceMap.get(line.toLowerCase());
      let confidence = typeof tesseractConf === 'number' ? tesseractConf : 0.90;

      if (Math.abs(qty * unitPrice - totalPrice) < 0.05) {
        confidence = Math.min(0.99, confidence + 0.08);
      }
      if (FOOD_BEVERAGE_INDICATORS.test(itemName)) {
        confidence = Math.min(0.99, confidence + 0.04);
      }

      const isUncertain = totalPrice < 15 || itemName.length < 3 || /[^\w\s()&'./-]/.test(itemName);

      items.push({
        id: `item_${Date.now()}_${items.length}`,
        name: itemName,
        quantity: qty,
        unitPrice: Math.round(unitPrice * 100) / 100,
        totalPrice: Math.round(totalPrice * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        isUncertain,
        rawLine: line,
      });
    }
  }

  // 3. Mathematical Cross-Checking & Totals Verification
  const computedItemsSubtotal = items.reduce((sum, item) => sum + (item.totalPrice || item.quantity * item.unitPrice), 0);

  if (subtotal === 0 && computedItemsSubtotal > 0) {
    subtotal = computedItemsSubtotal;
  }

  if (total === 0) {
    total = Math.round((subtotal + serviceCharge + tax) * 100) / 100;
  } else {
    const expectedTotal = Math.round((subtotal + serviceCharge + tax) * 100) / 100;
    if (Math.abs(expectedTotal - total) > 1.0) {
      discrepancies.push(
        `Extracted grand total (${total.toFixed(2)}) differs from calculated sum of items and charges (${expectedTotal.toFixed(2)}).`
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
    metadata,
  };
}

