// Generated from Binding IR SHA-256 2bba7e14f88b28a3039a49136afbed8b85a306281c6853344a3d8519ac4ec6de.
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

/**
 * Return the exact checked value through its proof-free host mirror. 
 */
export declare function dependentRoundtrip(arg0: Dependent): Dependent;

/**
 * Consume both retained fields after the checked constructor has run. 
 */
export declare function dependentTotal(arg0: Dependent): bigint;

declare const bindings: Readonly<{
  readonly dependentResult: typeof dependentResult;
  readonly dependentRoundtrip: typeof dependentRoundtrip;
  readonly dependentTotal: typeof dependentTotal;
}>;
export default bindings;
