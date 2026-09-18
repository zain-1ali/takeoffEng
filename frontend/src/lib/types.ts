export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  locale?: string;
}

export interface MeResponse {
  user: PublicUser;
  org: { id: string; name: string; slug: string } | null;
  role: string | null;
  plan: string;
  entitlements: {
    types: string[];
    maxProjects: number | null;
    bom: boolean;
    rateAnalysis: boolean;
    collaboration: boolean;
  };
}

export interface ProjectCard {
  id: string;
  name: string;
  buildingType: string;
  stage: string;
  currency: string;
  summary: { total?: number; concrete?: number } | null;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ProjectRecord extends ProjectCard {
  taxName?: string;
  taxRate?: number;
  contingencyRate?: number;
  numberLocale?: string;
  description?: string | null;
  reference?: string | null;
  revision?: string | null;
  location?: string | null;
  drawings?: string | null;
  measurementBasis?: string | null;
  documentVersion?: number;
  roofMode?: "SIMPLE" | "COMPLEX";
  fxRate?: number;
  databankCurrency?: string;
}
