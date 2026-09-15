import { NextResponse } from "next/server";
import { parsePdf } from "@/lib/parsePdf";
import { evaluateIr } from "@/lib/evaluate";
import { getDomain } from "@/lib/domains";
import { getPersona } from "@/lib/personas";
import type { DealInfo } from "@/lib/buildPrompt";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const domainId = formData.get("domainId");
    const personaId = formData.get("personaId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "IR 파일이 필요합니다." }, { status: 400 });
    }
    if (typeof domainId !== "string" || typeof personaId !== "string") {
      return NextResponse.json({ error: "영역과 심사역을 선택해 주세요." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "현재 데모는 PDF 파일만 지원합니다." }, { status: 400 });
    }

    const domain = getDomain(domainId);
    const persona = await getPersona(personaId);
    if (!domain) {
      return NextResponse.json({ error: "알 수 없는 영역입니다." }, { status: 400 });
    }
    if (!persona) {
      return NextResponse.json({ error: "알 수 없는 심사역입니다." }, { status: 400 });
    }

    const dealInfo: DealInfo = {
      stage: (formData.get("stage") as string) || undefined,
      preValuationEok: numberOrUndefined(formData.get("preValuationEok")),
      askAmountEok: numberOrUndefined(formData.get("askAmountEok")),
    };

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parsePdf(buffer);

    const report = await evaluateIr(persona, domain, parsed.markedText, dealInfo);

    return NextResponse.json({
      report,
      meta: { pageCount: parsed.pageCount, truncated: parsed.truncated },
    });
  } catch (err) {
    console.error("Evaluation failed:", err);
    const message = err instanceof Error ? err.message : "평가 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function numberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
