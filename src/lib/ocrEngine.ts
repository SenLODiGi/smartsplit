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
const FOOD_BEVERAGE_INDICATORS = /\b(?:kottu|roti|curry|meal|dhal|paan|sambol|lager|juice|water|rice|noodle|biriyani|hopper|pizza|burger|sandwich|pasta|steak|soup|salad|chicken|fish|prawn|mutton|beef|pork|cheese|egg|coffee|tea|shake|dessert|ice\s*cream|cake|brownie|beer|wine|soda|coke|sprite|portion|side|dish|special|combo|sub|bread|butter|jam|milk|biscuit|snack|roll|pastry|pie|fries|chips|nuggets|wrap|heineken|carlsberg|lion|mojito|margarita|espresso|latte|cappuccino)\b/i;

// Regular expressions for detecting and capturing receipt metadata
const PHONE_REGEX = /(?:tel|telephone|phone|ph|mobile|mob|hotline|fax|contact)\s*[:.]?\s*([+\d\s()-]{7,20})|(?:\+94|0094)\s*[\d\s-]{8,12}|\b0(?:11|7[0-8]|81|91|2\d|3\d|4\d|5\d)[\d\s-]{7,10}\b/i;
const DATE_REGEX = /\b(?:date|dated|dt)?\s*[:.]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}|20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/i;
const TIME_REGEX = /\b(?:time\s*[:.]?\s*)?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)\b/i;
const TABLE_REGEX = /\b(?:table|tbl|tab|table\s*no\.?)\s*[:#-]?\s*([A-Za-z0-9-]+)\b/i;
const SERVER_REGEX = /\b(?:server|waiter|steward|cashier|operator|staff|clerk)\s*[:.-]?\s*([A-Za-z0-9]+)\b/i;
const RECEIPT_NO_REGEX = /\b(?:receipt|bill|invoice|inv|order|token|check|chk|trans|txn)\s*(?:#|no\.?|num|number)?\s*[:.-]?\s*([A-Za-z0-9-]+)\b/i;
const TAX_NO_REGEX = /\b(?:vat|tin|svat|brn|reg|gst|sscl|nbt)\s*(?:#|no\.?|reg|number)?\s*[:.-]?\s*([A-Za-z0-9-]+)\b/i;

const STREET_INDICATORS = /\b(?:galle\s*road|main\s*street|beach\s*road|temple\s*road|high\s*level\s*road|baseline\s*road|duplication\s*road|kandy\s*road|negombo\s*road|peradeniya\s*road|havelock\s*road|reid\s*avenue|bauddhaloka\s*mawatha|dharmapala\s*mawatha)\b|\b(?:road|rd\.?|street|st\.?|lane|ln\.?|avenue|ave\.?|mawatha|mw\.?|place|pl\.?|drive|dr\.?|highway|bldg|building|floor|suite|apt|apartment|po\s*box|p\.o\.\s*box)\b/i;
const CITY_COUNTRY_INDICATORS = /\b(?:colombo\s*(?:0?[1-9]|1[0-5])?|kandy|galle|negombo|ella|mirissa|jaffna|matara|kurunegala|nuwara\s*eliya|batticaloa|bentota|hikkaduwa|sri\s*lanka)\b/i;

function cleanMonetaryNumber(str: string): number {
  return parseFloat(str.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0;
}

/**
 * Intelligent receipt parser:
 * 1. Accurately identifies and isolates receipt metadata (Address, Phone, Date, Table, Invoice #, etc.)
 * 2. Filters out noise, headers, footers, and summary totals before extracting line items
 * 3. Extracts item description, quantity, unit price, and total price correctly
 * 4. Calculates realistic per-item confidence and flags uncertain items
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

  const metadata: any = {};
  const items: ExpenseItem[] = [];
  const discrepancies: string[] = [];

  // Helper to extract the last valid monetary number from a line
  const extractTrailingMonetaryNumber = (str: string): { amount: number; rawMatched: string } | null => {
    const matches = str.match(/(?:(?:rs\.?|lkr|\$|€|£)\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*$/i);
    if (!matches || matches.length === 0) return null;
    const amount = cleanMonetaryNumber(matches[1]);
    return amount > 0 && amount < 10000000 ? { amount, rawMatched: matches[0] } : null;
  };

  // 1. First Pass: Extract Metadata & Headers across lines
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const lower = line.toLowerCase();

    // Merchant Candidate (top 6 lines that are not noise or addresses)
    if (i < 6 && merchant === 'Restaurant / Merchant') {
      const cleanCandidate = line.replace(/[^\w\s&'-]/g, '').trim();
      const isNoise = /^(?:tax invoice|receipt|cash bill|bill|welcome|customer copy|original|duplicate|tel:|phone:|no:|table|st:|street|road|pvt|ltd|reg|gst|vat)/i.test(line);
      const isAddressLine = STREET_INDICATORS.test(line) || CITY_COUNTRY_INDICATORS.test(line);

      if (cleanCandidate.length >= 3 && !isNoise && !isAddressLine && !/\d{4}/.test(cleanCandidate)) {
        merchant = cleanCandidate;
        metadata.businessName = cleanCandidate;
      }
    }

    // Phone / Contact
    const phoneMatch = line.match(PHONE_REGEX);
    if (phoneMatch && !metadata.phone && !FOOD_BEVERAGE_INDICATORS.test(line)) {
      metadata.phone = (phoneMatch[1] || phoneMatch[0]).trim();
    }

    // Date & Time
    const dateMatch = line.match(DATE_REGEX);
    const timeMatch = line.match(TIME_REGEX);
    if (dateMatch && !metadata.dateTime) {
      metadata.dateTime = `${dateMatch[1]} ${timeMatch ? timeMatch[1] : ''}`.trim();
      const parsed = new Date(dateMatch[1]);
      if (!isNaN(parsed.getTime())) {
        date = parsed.toISOString().slice(0, 10);
      }
    }

    // Table & Server
    const tableMatch = line.match(TABLE_REGEX);
    if (tableMatch && !metadata.tableNo && !FOOD_BEVERAGE_INDICATORS.test(line)) {
      metadata.tableNo = tableMatch[1].trim();
    }

    const serverMatch = line.match(SERVER_REGEX);
    if (serverMatch && !metadata.serverName && !FOOD_BEVERAGE_INDICATORS.test(line)) {
      metadata.serverName = serverMatch[1].trim();
    }

    // Receipt / Invoice #
    const receiptMatch = line.match(RECEIPT_NO_REGEX);
    if (receiptMatch && !metadata.receiptNo && !FOOD_BEVERAGE_INDICATORS.test(line)) {
      metadata.receiptNo = receiptMatch[1].trim();
    }

    // Tax / VAT / TIN #
    const taxMatch = line.match(TAX_NO_REGEX);
    if (taxMatch && !metadata.taxNo && !FOOD_BEVERAGE_INDICATORS.test(line)) {
      metadata.taxNo = taxMatch[1].trim();
    }

    // Address & City lines
    const hasStreet = STREET_INDICATORS.test(line);
    const hasCity = CITY_COUNTRY_INDICATORS.test(line);
    if ((hasStreet || hasCity) && !FOOD_BEVERAGE_INDICATORS.test(line)) {
      if (hasStreet && !metadata.address) {
        metadata.address = line.trim();
      }
      if (hasCity && !hasStreet && !metadata.city) {
        metadata.city = line.trim();
      } else if (hasCity && !metadata.city && !metadata.address) {
        metadata.city = line.trim();
      }
    }
  }

  // 2. Second Pass: Extract Summary Totals and Line Items
  for (let idx = 0; idx < allLines.length; idx++) {
    const line = allLines[idx];
    const lower = line.toLowerCase();

    // Check for Service Charge
    if (
      lower.includes('service charge') ||
      lower.includes('svc chg') ||
      lower.includes('service 10%') ||
      lower.includes('sc 10%') ||
      /^(?:service|svc)\b/i.test(line)
    ) {
      const parsed = extractTrailingMonetaryNumber(line);
      if (parsed && parsed.amount > 0) serviceCharge = parsed.amount;
      continue;
    }

    // Check for Tax / VAT
    if (
      (lower.includes('tax') || lower.includes('vat') || lower.includes('gst') || lower.includes('sscl') || lower.includes('nbt')) &&
      !lower.includes('tax invoice') && !lower.includes('tax no')
    ) {
      const parsed = extractTrailingMonetaryNumber(line);
      if (parsed && parsed.amount > 0) tax = parsed.amount;
      continue;
    }

    // Check for Subtotal
    if (
      lower.includes('subtotal') ||
      lower.includes('sub total') ||
      lower.includes('sub-total') ||
      lower.includes('gross amount') ||
      lower.includes('item total')
    ) {
      const parsed = extractTrailingMonetaryNumber(line);
      if (parsed && parsed.amount > 0) subtotal = parsed.amount;
      continue;
    }

    // Check for Grand Total
    if (
      lower.includes('grand total') ||
      lower.includes('net total') ||
      lower.includes('total amount') ||
      lower.includes('total due') ||
      lower.includes('amount due') ||
      lower.includes('balance due') ||
      (/^total\b/i.test(line) && !lower.includes('subtotal') && !lower.includes('item'))
    ) {
      const parsed = extractTrailingMonetaryNumber(line);
      if (parsed && parsed.amount > 0) total = parsed.amount;
      continue;
    }

    // Skip summary lines, payment lines, separators, footers
    if (
      /^[-=_*#\s]{3,}$/.test(line) ||
      /^(?:cash|change|balance|paid|tendered|visa|mastercard|amex|debit|card|auth\s*code)\b/i.test(lower) ||
      /^(?:thank\s*you|visit\s*again|welcome|feedback|have\s*a\s*nice\s*day|powered\s*by|printed\s*on|customer\s*copy)/i.test(lower)
    ) {
      continue;
    }

    // Skip column headers (e.g. "Item Qty Price Amount")
    const headerWords = ['item', 'desc', 'description', 'qty', 'quantity', 'price', 'rate', 'amount', 'total'];
    const headerWordCount = headerWords.filter((w) => lower.includes(w)).length;
    if (headerWordCount >= 2) {
      continue;
    }

    // Skip top metadata lines (Merchant name, Address, City, Phone, Table, Receipt #)
    if (
      line.trim() === merchant ||
      (metadata.address && line.includes(metadata.address)) ||
      (metadata.city && line.includes(metadata.city))
    ) {
      continue;
    }

    // Skip metadata lines matching patterns when line is NOT a food item
    const isPhoneLine = PHONE_REGEX.test(line) && !FOOD_BEVERAGE_INDICATORS.test(line);
    const isDateTimeLine = (DATE_REGEX.test(line) || TIME_REGEX.test(line)) && (/\b(?:date|time|dt|dated)\b/i.test(line) || !FOOD_BEVERAGE_INDICATORS.test(line));
    const isTableLine = (TABLE_REGEX.test(line) || SERVER_REGEX.test(line)) && !FOOD_BEVERAGE_INDICATORS.test(line);
    const isReceiptNoLine = RECEIPT_NO_REGEX.test(line) && !FOOD_BEVERAGE_INDICATORS.test(line);
    const isTaxNoLine = TAX_NO_REGEX.test(line) && !FOOD_BEVERAGE_INDICATORS.test(line);
    const isAddressLine = (STREET_INDICATORS.test(line) || CITY_COUNTRY_INDICATORS.test(line)) && !FOOD_BEVERAGE_INDICATORS.test(line);

    if (isPhoneLine || isDateTimeLine || isTableLine || isReceiptNoLine || isTaxNoLine || isAddressLine) {
      continue;
    }

    // 3. Line Item Candidate Parsing
    const parsedPrice = extractTrailingMonetaryNumber(line);
    if (!parsedPrice || parsedPrice.amount <= 0) continue;

    const totalPrice = parsedPrice.amount;
    const textBeforePrice = line.slice(0, line.length - parsedPrice.rawMatched.length).trim();
    if (textBeforePrice.length < 2) continue;

    let itemName = textBeforePrice;
    let qty = 1;
    let unitPrice = totalPrice;

    // Pattern A: Multi-price format -> "Lion Lager 2 x 800.00" or "Roast Paan 2 @ 200.00"
    const multiPriceMatch = textBeforePrice.match(/^(.*?)\s+([1-9][0-9]?)\s*(?:x|@|\*)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*$/i);
    if (multiPriceMatch) {
      itemName = multiPriceMatch[1].trim();
      qty = parseInt(multiPriceMatch[2], 10) || 1;
      unitPrice = cleanMonetaryNumber(multiPriceMatch[3]) || Math.round((totalPrice / qty) * 100) / 100;
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

    // Clean leading/trailing symbols from itemName
    itemName = itemName.replace(/^[-*•.#\d\s]+/, '').replace(/[-*•._\s]+$/, '').trim();

    // Final sanity check: must contain letters and not be an address or invoice keyword
    if (
      itemName.length >= 2 &&
      /[a-zA-Z]/.test(itemName) &&
      !/^(?:address|tel|date|table|server|receipt|invoice|total|tax|subtotal|vat|cashier)\b/i.test(itemName)
    ) {
      // Calculate realistic item confidence
      const tesseractConf = lineConfidenceMap.get(line.toLowerCase());
      let confidence = typeof tesseractConf === 'number' ? tesseractConf : 0.88;

      if (Math.abs(qty * unitPrice - totalPrice) < 0.05) {
        confidence = Math.min(0.98, confidence + 0.08);
      }
      if (FOOD_BEVERAGE_INDICATORS.test(itemName)) {
        confidence = Math.min(0.99, confidence + 0.04);
      }

      const isUncertain = totalPrice < 15 || itemName.length < 3 || /[^\w\s()&'./-]/.test(itemName);
      if (isUncertain) {
        confidence = Math.max(0.48, confidence - 0.25);
      }

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

  // 4. Mathematical Cross-Checking & Totals
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

