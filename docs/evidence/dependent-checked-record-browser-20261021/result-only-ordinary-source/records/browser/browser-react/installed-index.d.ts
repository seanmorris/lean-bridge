// Generated from Binding IR SHA-256 836074ffcb70109ff3fe1d2fad5e51618e05d9ad2b8e33a767058f37bfe7580a.
/**
 * Checked Lean DependentRecords.Dependent.
 */
export interface Dependent {
  readonly bound: bigint;
  readonly below: bigint;
}

/**
 * Lean produces the dependent proofs for a result-only API. 
 */
export declare function dependentResult(arg0: bigint): Dependent;

declare const bindings: Readonly<{
  readonly dependentResult: typeof dependentResult;
}>;
export default bindings;
