import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/supabaseClient";
import { listLatestEvaluationsFor } from "@/lib/mail/evaluationStore";
import { getDomain } from "@/lib/domains";

export async function GET() {
  try {
    const { data: mails, error } = await getSupabase()
      .from("classified_mails")
      .select("msg_num, subject, from_address, mail_date, has_attachment, domain_id, priority, processed_at")
      .eq("category", "ir")
      .order("mail_date", { ascending: false, nullsFirst: false });
    if (error) throw new Error(`IR 목록 조회 실패: ${error.message}`);

    const msgNums = (mails ?? []).map((m) => m.msg_num as number);
    const evaluations = await listLatestEvaluationsFor(msgNums);

    const list = (mails ?? []).map((m) => {
      const domain = m.domain_id ? getDomain(m.domain_id as string) : undefined;
      const evaluation = evaluations.get(m.msg_num as number);
      return {
        msgNum: m.msg_num as number,
        subject: m.subject as string,
        from: m.from_address as string,
        date: (m.mail_date as string) ?? null,
        hasAttachment: m.has_attachment as boolean,
        domainId: (m.domain_id as string | null) ?? null,
        domainLabel: domain?.label ?? "미분류",
        priority: m.priority as string,
        evaluation: evaluation ?? null,
      };
    });

    return NextResponse.json({ deals: list });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "조회에 실패했습니다." }, { status: 500 });
  }
}
