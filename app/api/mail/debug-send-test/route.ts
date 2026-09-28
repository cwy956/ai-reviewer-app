import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mail/sendEmail";

// TEMPORARY — confirms RESEND_FROM_EMAIL took effect on Vercel after redeploy. Delete once confirmed.
export async function GET() {
  const result = await sendEmail({
    to: "airway956956@gmail.com",
    subject: "[테스트] Vercel 재배포 후 발신 주소 확인",
    text: "Vercel에 RESEND_FROM_EMAIL 반영된 뒤 첫 발송 테스트입니다.",
  });
  return NextResponse.json({ ...result, fromEnvSet: !!process.env.RESEND_FROM_EMAIL });
}
