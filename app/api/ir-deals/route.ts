import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/supabaseClient";
import { listLatestMailEvaluationsFor, listPlatformSubmissionSummaries } from "@/lib/evaluations/store";
import { getDomain } from "@/lib/domains";

export interface IrDeal {
  source: "mail" | "platform";
  key: string;
  msgNum: number | null;
  evaluationId: number | null;
  title: string;
  subtitle: string;
  date: string | null;
  domainId: string | null;
  domainLabel: string;
  evaluation: {
    totalScore: number;
    investmentAttractivenessScore: number | null;
    evaluatedAt: string;
    personaName: string;
  } | null;
}

export async function GET() {
  try {
    const { data: mails, error } = await getSupabase()
      .from("classified_mails")
      .select("msg_num, subject, from_address, mail_date, has_attachment, domain_id, priority, processed_at")
      .eq("category", "ir")
      .order("mail_date", { ascending: false, nullsFirst: false });
    if (error) throw new Error(`IR 목록 조회 실패: ${error.message}`);

    const msgNums = (mails ?? []).map((m) => m.msg_num as number);
    const mailEvaluations = await listLatestMailEvaluationsFor(msgNums);

    const mailDeals: IrDeal[] = (mails ?? []).map((m) => {
      const domainId = (m.domain_id as string | null) ?? null;
      const domain = domainId ? getDomain(domainId) : undefined;
      const evaluation = mailEvaluations.get(m.msg_num as number) ?? null;
      return {
        source: "mail",
        key: `mail-${m.msg_num}`,
        msgNum: m.msg_num as number,
        evaluationId: evaluation?.id ?? null,
        title: m.subject as string,
        subtitle: m.from_address as string,
        date: (m.mail_date as string) ?? (m.processed_at as string),
        domainId,
        domainLabel: domain?.label ?? "미분류",
        evaluation: evaluation
          ? {
              totalScore: evaluation.totalScore,
              investmentAttractivenessScore: evaluation.investmentAttractivenessScore,
              evaluatedAt: evaluation.evaluatedAt,
              personaName: evaluation.personaName,
            }
          : null,
      };
    });

    const platformSubmissions = await listPlatformSubmissionSummaries();
    const platformDeals: IrDeal[] = platformSubmissions.map((s) => {
      const domain = getDomain(s.domainId);
      return {
        source: "platform",
        key: `platform-${s.id}`,
        msgNum: null,
        evaluationId: s.id,
        title: s.companyName || "(기업명 미입력)",
        subtitle: s.attachmentFilename,
        date: s.evaluatedAt,
        domainId: s.domainId,
        domainLabel: domain?.label ?? "미분류",
        evaluation: {
          totalScore: s.totalScore,
          investmentAttractivenessScore: s.investmentAttractivenessScore,
          evaluatedAt: s.evaluatedAt,
          personaName: s.personaName,
        },
      };
    });

    const deals = [...mailDeals, ...platformDeals].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    return NextResponse.json({ deals });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "조회에 실패했습니다." }, { status: 500 });
  }
}
