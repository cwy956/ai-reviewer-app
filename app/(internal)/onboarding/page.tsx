import { AdminSection, ReviewerSection } from "@/components/onboarding/TeamSections";

export const dynamic = "force-dynamic";

export default function OnboardingListPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-accent-soft">담당자 관리</h1>
        <p className="mt-2 text-sm text-muted">
          공용 메일함에 메일이 들어오면 종류에 따라 아래 담당자에게 자동으로 전달돼요. 이름과 이메일만 등록하면 돼요.
        </p>
      </header>

      <div className="space-y-6">
        <ReviewerSection />
        <AdminSection />
      </div>
    </main>
  );
}
