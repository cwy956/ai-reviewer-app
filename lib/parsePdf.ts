import { getPath } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import type { ExtractionQuality } from "./reportSchema";

PDFParse.setWorker(getPath());

export interface ParsedPdf {
  pageCount: number;
  pages: { page: number; text: string }[];
  markedText: string;
  truncated: boolean;
}

const MAX_CHARS = 120_000;
// A page with under this many extracted characters is treated as "failed to extract" (scanned
// image, broken font embedding, etc.) rather than a genuinely sparse page — real sparse-but-valid
// pages (e.g. a single chart title) still clear this easily.
const EMPTY_PAGE_CHAR_THRESHOLD = 15;
// Above this fraction of empty pages, the resulting score rests on too little real material to
// trust at face value.
const LOW_CONFIDENCE_RATIO = 0.4;

/** Computed from the already-parsed per-page text — never by the model — so a deck that's mostly
 * unreadable (scanned pages, broken PDF export, etc.) doesn't get scored with the same apparent
 * confidence as a fully extracted one. */
export function assessExtractionQuality(parsed: ParsedPdf): ExtractionQuality {
  const emptyPageCount = parsed.pages.filter((p) => p.text.length < EMPTY_PAGE_CHAR_THRESHOLD).length;
  const pageCount = parsed.pages.length;
  const emptyPageRatio = pageCount > 0 ? emptyPageCount / pageCount : 0;
  return {
    pageCount,
    emptyPageCount,
    emptyPageRatio,
    lowConfidence: emptyPageRatio > LOW_CONFIDENCE_RATIO,
  };
}

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
