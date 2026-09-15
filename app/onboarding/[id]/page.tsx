import Link from "next/link";
import { notFound } from "next/navigation";
import { getPersonaById } from "@/lib/personas/store";
import { DomainProgressGrid } from "@/components/onboarding/DomainProgressGrid";

export const dynamic = "force-dynamic";

export default async function PersonaDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const persona = await getPersonaById(id);
  if (!persona) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-accent-soft">{persona.name} 심사역</h1>
            <p className="mt-1 text-sm text-muted">{persona.affiliation}</p>
          </div>
          <Link
            href={`/onboarding/new?edit=${persona.id}`}
            className="rounded-md border border-panel-border px-3 py-1.5 text-xs text-muted hover:border-accent-soft/60 hover:text-foreground"
          >
            기본정보 수정
          </Link>
        </div>
        <a href="/onboarding" className="mt-3 inline-block text-xs text-muted underline hover:text-accent-soft">
          ← 심사역 목록으로
        </a>
      </header>

      <section className="mb-8 rounded-lg border border-panel-border bg-panel p-5">
        <h2 className="mb-2 text-sm font-semibold text-muted">영역별 판단 기준 작성</h2>
        <p className="mb-4 text-xs text-muted">
          영역을 선택해 해당 영역에서 특히 중요하게 보는 5개 체크포인트와 자유 서술을 입력하세요.
        </p>
        <DomainProgressGrid persona={persona} />
      </section>
    </main>
  );
}
