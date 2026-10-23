// Generated from Binding IR SHA-256 d1515d6a8e4f834d593b60ef2304a87a77321852bcfcf8aa43de103e7319a8dd.
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

declare const bindings: Readonly<{
  readonly dependentResult: typeof dependentResult;
}>;
export default bindings;
