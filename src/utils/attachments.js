/**
 * File attachments — read a browser File into something a JSON backend can take.
 *
 * The library stays transport-agnostic: attachments ride on the SAME
 * `inputParams` object every other piece of per-message data uses, as
 * `inputParams.files`, so a backend that already reads inputParams needs no new
 * endpoint, no multipart handling, and no CORS change. A consumer that doesn't
 * care simply ignores the key.
 *
 * Base64 rather than multipart is a deliberate trade: it costs ~33% size, and
 * in exchange the whole feature is one JSON field that survives proxies,
 * logging and replay. Files here are the kind a person drops into a chat — a
 * spreadsheet, a PDF, a config — not video, so the ceiling matters more than
 * the overhead. `maxFileSizeMb` keeps it honest.
 */

/** Default ceiling per file. Generous for documents, small enough to stay JSON. */
export const DEFAULT_MAX_FILE_MB = 10;

/** Default ceiling on how many files ride along with one message. */
export const DEFAULT_MAX_FILES = 5;

/**
 * @typedef {object} ConvEngineAttachment
 * @property {string} name      Original filename.
 * @property {string} mimeType  Browser-reported MIME type ('' if unknown).
 * @property {number} size      Size in bytes.
 * @property {string} content   Base64 of the file bytes (no data: prefix).
 * @property {string} encoding  Always 'base64' — explicit so a backend never guesses.
 */

/**
 * Read one File into a plain, JSON-safe object.
 *
 * @param {File} file
 * @returns {Promise<ConvEngineAttachment>}
 */
export function readFileAsAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      // readAsDataURL gives "data:<mime>;base64,<payload>" — the payload alone
      // is what a backend wants, and splitting on the FIRST comma is safe
      // because base64 never contains one.
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve({
        name: file.name,
        mimeType: file.type || '',
        size: file.size,
        content: comma >= 0 ? result.slice(comma + 1) : '',
        encoding: 'base64',
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validate a picked file against the configured limits.
 *
 * @returns {string|null} A human-readable reason to refuse it, or null if fine.
 */
export function rejectionReason(file, { maxFileSizeMb = DEFAULT_MAX_FILE_MB, accept = '' } = {}) {
  const maxBytes = maxFileSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${maxFileSizeMb} MB.`;
  }
  const patterns = String(accept || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (patterns.length) {
    const name = file.name.toLowerCase();
    const type = (file.type || '').toLowerCase();
    const ok = patterns.some((p) => {
      if (p.startsWith('.')) return name.endsWith(p);
      if (p.endsWith('/*')) return type.startsWith(p.slice(0, -1));
      return type === p;
    });
    if (!ok) return `${file.name} isn't a supported file type.`;
  }
  return null;
}

/** Bytes → "12.3 KB" / "1.1 MB", for the chip label. */
export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
