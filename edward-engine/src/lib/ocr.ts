import { createWorker } from "tesseract.js";

export async function runOcr(filePath: string) {
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(filePath);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
