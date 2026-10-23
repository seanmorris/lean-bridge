// Generated from Binding IR SHA-256 69567662e7e08f19daea34b1652996700f49332ee383f37bafa2afba6f8fb363.
/**
 * Independent corpus contract.
 */
export interface Dependent {
  readonly bound: bigint;
  readonly below: bigint;
}

/**
 * Independent corpus contract.
 */
export declare function dependentResult(value0: bigint): Dependent;

/**
 * Independent corpus contract.
 */
export declare function dependentRoundtrip(value0: Dependent): Dependent;

/**
 * Independent corpus contract.
 */
export declare function dependentTotal(value0: Dependent): bigint;

declare const bindings: Readonly<{
  readonly dependentResult: typeof dependentResult;
  readonly dependentRoundtrip: typeof dependentRoundtrip;
  readonly dependentTotal: typeof dependentTotal;
}>;
export default bindings;
