export interface SevenPrinciples {
  intro: string;
  stagePreference: string;
  priorityOrder: string[];
  judgmentPoints: {
    team: string;
    market: string;
    product: string;
    traction: string;
    finance: string;
  };
  preferredTraction: string;
  redFlags: string;
  tone: string;
}

export interface PersonaDomainCriteria {
  domainId: string;
  starredCheckpointIds: string[];
  freeform: string;
}

export interface Persona {
  id: string;
  name: string;
  affiliation: string;
  bio: string;
  /** Real contact email — used to route IR mail-alert notifications for this reviewer's domains. */
  email?: string;
  portfolio: string[];
  isDefault: boolean;
  sevenPrinciples?: SevenPrinciples;
  domainCriteria: PersonaDomainCriteria[];
}
