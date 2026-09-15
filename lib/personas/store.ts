import { getSupabase } from "../db/supabaseClient";
import type { Persona, PersonaDomainCriteria } from "./schema";

const ID_PATTERN = /^[a-z0-9-]+$/;

export function assertValidId(id: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new Error("id는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.");
  }
}

interface PersonaRow {
  id: string;
  name: string;
  affiliation: string;
  bio: string;
  email: string | null;
  portfolio: string[];
  is_default: boolean;
  seven_principles: Persona["sevenPrinciples"] | null;
  domain_criteria: PersonaDomainCriteria[];
}

function rowToPersona(row: PersonaRow): Persona {
  return {
    id: row.id,
    name: row.name,
    affiliation: row.affiliation,
    bio: row.bio,
    email: row.email ?? undefined,
    portfolio: row.portfolio ?? [],
    isDefault: row.is_default,
    sevenPrinciples: row.seven_principles ?? undefined,
    domainCriteria: row.domain_criteria ?? [],
  };
}

export async function listPersonas(): Promise<Persona[]> {
  const { data, error } = await getSupabase()
    .from("personas")
    .select("*")
    .order("is_default", { ascending: false });
  if (error) throw new Error(`심사역 목록 조회 실패: ${error.message}`);
  return (data as PersonaRow[]).map(rowToPersona);
}

export async function getPersonaById(id: string): Promise<Persona | undefined> {
  const { data, error } = await getSupabase().from("personas").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`심사역 조회 실패: ${error.message}`);
  return data ? rowToPersona(data as PersonaRow) : undefined;
}

export async function upsertPersonaBase(base: Omit<Persona, "domainCriteria">): Promise<Persona> {
  assertValidId(base.id);
  const existing = await getPersonaById(base.id);
  const domainCriteria = existing?.domainCriteria ?? [];

  const { data, error } = await getSupabase()
    .from("personas")
    .upsert(
      {
        id: base.id,
        name: base.name,
        affiliation: base.affiliation,
        bio: base.bio,
        email: base.email ?? null,
        portfolio: base.portfolio,
        is_default: base.isDefault,
        seven_principles: base.sevenPrinciples ?? null,
        domain_criteria: domainCriteria,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();
  if (error) throw new Error(`심사역 저장 실패: ${error.message}`);
  return rowToPersona(data as PersonaRow);
}

export async function upsertDomainCriteria(personaId: string, criteria: PersonaDomainCriteria): Promise<Persona> {
  const existing = await getPersonaById(personaId);
  if (!existing) {
    throw new Error(`심사역을 찾을 수 없습니다: ${personaId}`);
  }
  const domainCriteria = existing.domainCriteria.filter((c) => c.domainId !== criteria.domainId);
  domainCriteria.push(criteria);

  const { data, error } = await getSupabase()
    .from("personas")
    .update({ domain_criteria: domainCriteria, updated_at: new Date().toISOString() })
    .eq("id", personaId)
    .select()
    .single();
  if (error) throw new Error(`영역별 기준 저장 실패: ${error.message}`);
  return rowToPersona(data as PersonaRow);
}
