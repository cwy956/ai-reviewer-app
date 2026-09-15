import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parsePdf } from "@/lib/parsePdf";
import { evaluateIr } from "@/lib/evaluate";
import { getDomain } from "@/lib/domains";
import { getPersona } from "@/lib/personas";
import type { DealInfo } from "@/lib/buildPrompt";

export const runtime = "nodejs";
export const maxDuration = 120;

async function isInternalRequest(): Promise<boolean> {
  const password = process.env.INTERNAL_ACCESS_PASSWORD;
  if (!password) return false;
  const cookieStore = await cookies();
  return cookieStore.get("internal_auth")?.value === password;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const domainId = formData.get("domainId");
    const personaId = formData.get("personaId");
    const requestedMode = formData.get("mode") === "internal" ? "internal" : "external";
    // Never trust the client-supplied mode alone — the internal-only investment-attractiveness
    // axis must not leak to anonymous startups hitting this same public endpoint from "/".
    const mode = requestedMode === "internal" && (await isInternalRequest()) ? "internal" : "external";

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

    const report = await evaluateIr(persona, domain, parsed.markedText, dealInfo, mode);

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
