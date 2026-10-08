import { notFound } from "next/navigation";
import { getPersonaById } from "@/lib/personas/store";
import { getDomain } from "@/lib/domains";
import { CheckpointForm } from "@/components/onboarding/CheckpointForm";

export const dynamic = "force-dynamic";

export default async function DomainCheckpointPage({
  params,
}: {
  params: Promise<{ id: string; domainId: string }>;
}) {
  const { id, domainId } = await params;
  const persona = await getPersonaById(id);
  const domain = getDomain(domainId);
  if (!persona || !domain) notFound();

  const initial = persona.domainCriteria.find((c) => c.domainId === domainId);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-accent-soft">
          {persona.name} · {domain.label}
        </h1>
        <p className="mt-1 text-sm text-muted">이 영역에서 특히 중요하게 보는 체크포인트를 골라주세요.</p>
        <a href={`/onboarding/${id}`} className="mt-3 inline-block text-xs text-muted underline hover:text-accent-soft">
          {persona.name} 대시보드로
        </a>
      </header>
      <CheckpointForm personaId={id} domain={domain} initial={initial} />
    </main>
  );
}
