import fs from "fs";
import path from "path";
import type { Persona, PersonaDomainCriteria } from "./schema";

const PERSONAS_DIR = path.join(process.cwd(), "lib", "personas");
const ID_PATTERN = /^[a-z0-9-]+$/;

function filePath(id: string): string {
  return path.join(PERSONAS_DIR, `${id}.json`);
}

export function assertValidId(id: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new Error("id는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.");
  }
}

export function listPersonas(): Persona[] {
  const files = fs.readdirSync(PERSONAS_DIR).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => {
      const raw = fs.readFileSync(path.join(PERSONAS_DIR, f), "utf-8");
      return JSON.parse(raw) as Persona;
    })
    .sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1));
}

export function getPersonaById(id: string): Persona | undefined {
  try {
    const raw = fs.readFileSync(filePath(id), "utf-8");
    return JSON.parse(raw) as Persona;
  } catch {
    return undefined;
  }
}

function writePersona(persona: Persona): void {
  fs.writeFileSync(filePath(persona.id), JSON.stringify(persona, null, 2) + "\n", "utf-8");
}

export function upsertPersonaBase(base: Omit<Persona, "domainCriteria">): Persona {
  assertValidId(base.id);
  const existing = getPersonaById(base.id);
  const persona: Persona = {
    ...base,
    domainCriteria: existing?.domainCriteria ?? [],
  };
  writePersona(persona);
  return persona;
}

export function upsertDomainCriteria(
  personaId: string,
  criteria: PersonaDomainCriteria
): Persona {
  const existing = getPersonaById(personaId);
  if (!existing) {
    throw new Error(`심사역을 찾을 수 없습니다: ${personaId}`);
  }
  const domainCriteria = existing.domainCriteria.filter((c) => c.domainId !== criteria.domainId);
  domainCriteria.push(criteria);
  const persona: Persona = { ...existing, domainCriteria };
  writePersona(persona);
  return persona;
}
