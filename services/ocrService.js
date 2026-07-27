// Servicio de OCR usando Tesseract.js
const Tesseract = require('tesseract.js');
const logger = require('../utils/logger');

/**
 * Extrae texto de una imagen usando Tesseract.js
 * @param {Buffer|string} imageData - Imagen en buffer o base64
 * @param {object} options - Opciones de OCR
 * @returns {Promise<object>} { text, confidence, words, lines }
 */
async function extractTextFromImage(imageData, options = {}) {
  const {
    logger = false,
    language = 'spa+eng'
  } = options;

  let worker = null;
  try {
    worker = await Tesseract.createWorker(language, 1, {
      logger: logger ? m => console.log(`[OCR] ${m.status}: ${Math.round(m.progress * 100)}%`) : null
    });

    const result = await worker.recognize(imageData);

    return {
      text: result.data.text,
      confidence: result.data.confidence / 100, // Normalizar a 0-1
      words: result.data.words,
      lines: result.data.lines,
      paragraphs: result.data.paragraphs
    };
  } catch (error) {
    logger.error({ err: error.message }, 'OCR error');
    throw error;
  } finally {
    // Garantizar liberación del worker nativo aunque recognize() lance.
    if (worker) {
      try { await worker.terminate(); } catch (_) { /* noop */ }
    }
  }
}

/**
 * Versión simplificada para imágenes pequeñas
 * @param {Buffer|string} imageData
 * @returns {Promise<object>}
 */
async function extractTextSimple(imageData) {
  const result = await Tesseract.recognize(imageData, 'spa+eng', {
    logger: false
  });

  return {
    text: result.data.text,
    confidence: result.data.confidence / 100,
    words: result.data.words
  };
}

/**
 * Procesa una imagen y devuelve texto estructurado
 * @param {Buffer} imageBuffer - Buffer de la imagen
 * @returns {Promise<object>}
 */
async function procesarImagen(imageBuffer) {
  logger.info('Processing image via OCR');

  const ocrResult = await extractTextFromImage(imageBuffer, { logger: true });

  logger.info({ confidence: (ocrResult.confidence * 100).toFixed(1) }, 'OCR text extracted');
  logger.debug({ preview: ocrResult.text.substring(0, 200).replace(/\n/g, ' ') }, 'OCR preview');

  return ocrResult;
}

module.exports = {
  extractTextFromImage,
  extractTextSimple,
  procesarImagen
};
