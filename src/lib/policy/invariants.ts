import { REQUIRED_INVARIANTS as REQUIRED_INVARIANTS_CORE } from "./invariantsCore.js";

export type Invariant = {
  id: string;
  title: string;
  description: string;
  neverOptimizeFor: string[];
  violationSignals: string[];
  enforcement: string;
  safeFailure: string;
};

export const REQUIRED_INVARIANTS: ReadonlyArray<Invariant> = REQUIRED_INVARIANTS_CORE as Invariant[];

