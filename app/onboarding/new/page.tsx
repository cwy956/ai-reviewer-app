import { PersonaBaseForm } from "@/components/onboarding/PersonaBaseForm";
import { getPersonaById } from "@/lib/personas/store";

export const dynamic = "force-dynamic";

export default async function NewPersonaPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const initial = edit ? getPersonaById(edit) : undefined;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-accent-soft">{initial ? "심사역 정보 수정" : "새 심사역 등록"}</h1>
        <p className="mt-2 text-sm text-muted">기본정보와 공통 판단 기준(7항목)을 입력해 주세요.</p>
        <a href="/onboarding" className="mt-3 inline-block text-xs text-muted underline hover:text-accent-soft">
          ← 심사역 목록으로
        </a>
      </header>
      <PersonaBaseForm initial={initial} />
    </main>
  );
}
