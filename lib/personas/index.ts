import { listPersonas, getPersonaById } from "./store";

export function getPersona(id: string) {
  return getPersonaById(id);
}

export { listPersonas };
