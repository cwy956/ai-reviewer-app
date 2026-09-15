// One-time migration: reads the existing lib/personas/*.json seed files and upserts them into
// the Supabase `personas` table. Run this once after setting up SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
// and applying supabase/schema.sql — otherwise the data entered so far (e.g. 정우영's onboarding
// criteria) would be lost when the app switches from file storage to Supabase.
//
// Usage: npx tsx scripts/migrate-personas-to-supabase.mts

import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const { getSupabase } = await import("../lib/db/supabaseClient");
const { assertValidId } = await import("../lib/personas/store");

const PERSONAS_DIR = path.join(process.cwd(), "lib", "personas");

async function main() {
  const files = fs.readdirSync(PERSONAS_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("마이그레이션할 심사역 JSON 파일이 없습니다.");
    return;
  }

  const supabase = getSupabase();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(PERSONAS_DIR, file), "utf-8");
    const persona = JSON.parse(raw);

    try {
      assertValidId(persona.id);
    } catch (err) {
      console.error(`  건너뜀 (${file}): ${err instanceof Error ? err.message : err}`);
      continue;
    }

    const { error } = await supabase.from("personas").upsert(
      {
        id: persona.id,
        name: persona.name,
        affiliation: persona.affiliation,
        bio: persona.bio ?? "",
        email: persona.email ?? null,
        portfolio: persona.portfolio ?? [],
        is_default: Boolean(persona.isDefault),
        seven_principles: persona.sevenPrinciples ?? null,
        domain_criteria: persona.domainCriteria ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error(`  실패 (${persona.id}): ${error.message}`);
    } else {
      console.log(`  완료: ${persona.id} (${persona.name})`);
    }
  }

  console.log("마이그레이션 완료.");
}

main().catch((err) => {
  console.error("마이그레이션 중 오류:", err);
  process.exit(1);
});
