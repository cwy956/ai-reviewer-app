import Link from "next/link";
import { listPersonas } from "@/lib/personas/store";
import { domainCategories } from "@/lib/domains";

export const dynamic = "force-dynamic";

export default function OnboardingListPage() {
  const personas = listPersonas().filter((p) => !p.isDefault);
  const totalDomains = domainCategories.reduce((sum, c) => sum + c.domains.length, 0);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-accent-soft">심사역 심사 기준 등록</h1>
        <p className="mt-2 text-sm text-muted">
          당신만의 판단 기준을 입력하면, IR 평가 AI가 당신의 관점으로 스타트업을 심사합니다.
        </p>
        <a href="/" className="mt-3 inline-block text-xs text-muted underline hover:text-accent-soft">
          ← IR 평가 앱으로
        </a>
      </header>

      <Link
        href="/onboarding/new"
        className="mb-8 block rounded-lg bg-accent px-4 py-3 text-center font-semibold text-white transition hover:bg-accent-soft"
      >
        + 새 심사역으로 등록하기
      </Link>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">등록된 심사역</h2>
        {personas.length === 0 && (
          <p className="rounded-lg border border-dashed border-panel-border p-6 text-center text-sm text-muted">
            아직 등록된 심사역이 없어요. 위에서 등록을 시작해보세요.
          </p>
        )}
        {personas.map((p) => {
          const done = p.domainCriteria.length;
          return (
            <Link
              key={p.id}
              href={`/onboarding/${p.id}`}
              className="flex items-center justify-between rounded-lg border border-panel-border bg-panel p-4 transition hover:border-accent-soft/60"
            >
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted">{p.affiliation}</p>
              </div>
              <span className="text-xs text-muted">
                {done} / {totalDomains} 영역 작성됨
              </span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
