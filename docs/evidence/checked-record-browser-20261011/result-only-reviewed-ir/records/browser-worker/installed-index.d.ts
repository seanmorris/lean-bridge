// Generated from Binding IR SHA-256 1099f706b4525198d30ee68cc43be06c739150c2e88feadfbee87d3947bd740b.
/**
 * Independent corpus contract.
 */
export interface Triple {
  readonly data: ReadonlyArray<bigint>;
}

/**
 * Independent corpus contract.
 */
export declare function repeated(value0: bigint): Triple;

declare const bindings: Readonly<{
  readonly repeated: typeof repeated;
}>;
export default bindings;
