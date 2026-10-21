// Generated from Binding IR SHA-256 5f06dbec168e81ab085000c1bf77072f86f69a08263c6e7cea195720c52b56d2.
/**
 * Checked Lean ZeroPayloadCheckedRecords.Mark.
 */
export type Mark = Readonly<{ readonly kind: "blank" }> | Readonly<{ readonly kind: "marked"; readonly witness: Witness }>;

/**
 * Checked Lean ZeroPayloadCheckedRecords.Marker.
 */
export type Marker = Readonly<Record<PropertyKey, never>>;

/**
 * Checked Lean ZeroPayloadCheckedRecords.Token.
 */
export interface Token {
  readonly tag: void;
}

/**
 * Checked Lean ZeroPayloadCheckedRecords.Witness.
 */
export type Witness = Readonly<Record<PropertyKey, never>>;

/**
 * Call ZeroPayloadCheckedRecords.maybeWitness.
 */
export declare function maybeWitness(arg0: boolean): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Witness }>;

/**
 * Call ZeroPayloadCheckedRecords.produceMark.
 */
export declare function produceMark(arg0: boolean): Mark;

/**
 * Call ZeroPayloadCheckedRecords.produceMarker.
 */
export declare function produceMarker(): Marker;

/**
 * Call ZeroPayloadCheckedRecords.produceToken.
 */
export declare function produceToken(): Token;

/**
 * Lean produces the proof; the host receives the empty carrier. 
 */
export declare function produceWitness(): Witness;

/**
 * Containers of zero-payload results keep their length and presence. 
 */
export declare function witnesses(arg0: bigint): ReadonlyArray<Witness>;

declare const bindings: Readonly<{
  readonly maybeWitness: typeof maybeWitness;
  readonly produceMark: typeof produceMark;
  readonly produceMarker: typeof produceMarker;
  readonly produceToken: typeof produceToken;
  readonly produceWitness: typeof produceWitness;
  readonly witnesses: typeof witnesses;
}>;
export default bindings;
