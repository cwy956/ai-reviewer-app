import { getPath } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

PDFParse.setWorker(getPath());

export interface ParsedPdf {
  pageCount: number;
  pages: { page: number; text: string }[];
  markedText: string;
  truncated: boolean;
}

const MAX_CHARS = 120_000;

export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const pages = result.pages.map((p) => ({ page: p.num, text: p.text.trim() }));
    const full = pages
      .map((p) => `[p.${String(p.page).padStart(2, "0")}]\n${p.text}`)
      .join("\n\n");

    const truncated = full.length > MAX_CHARS;
    const markedText = truncated ? `${full.slice(0, MAX_CHARS)}\n\n[...이후 내용 생략...]` : full;

    return { pageCount: result.total, pages, markedText, truncated };
  } finally {
    await parser.destroy();
  }
}
