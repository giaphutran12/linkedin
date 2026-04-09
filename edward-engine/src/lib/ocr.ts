import { createWorker } from "tesseract.js";

export type OcrResult = {
  text: string;
  confidence: number;
};

export async function runOcrWithConfidence(filePath: string): Promise<OcrResult> {
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(filePath);
    return {
      text: result.data.text,
      confidence: Number(result.data.confidence ?? 0) / 100,
    };
  } finally {
    await worker.terminate();
  }
}

export async function runOcr(filePath: string) {
  const result = await runOcrWithConfidence(filePath);
  return result.text;
}
