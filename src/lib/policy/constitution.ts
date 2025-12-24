import { CIV_CONSTITUTION as CIV_CONSTITUTION_CORE } from "./constitutionCore.js";

export type CivConstitution = {
  version: "v1";
  purpose: string;
  nonGoals: ReadonlyArray<string>;
  clauses: ReadonlyArray<string>;
};

export const CIV_CONSTITUTION: CivConstitution = CIV_CONSTITUTION_CORE as CivConstitution;

