// Generated from Binding IR SHA-256 e4d803a36e29c17e2798c52261ff35266262d52b8733f6c5321f4b7018f7c784.
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
 * The same input site under the refusing constructor. 
 */
export declare function absentCount(arg0: Witness): bigint;

/**
 * Both variant branches remain distinct after the nested proof has been erased. 
 */
export declare function markCount(arg0: Mark): bigint;

/**
 * A plain empty record crosses as an ordinary copied record in both directions. 
 */
export declare function markerCount(arg0: Marker): bigint;

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
 * Read the unit tag of a checked token input. 
 */
export declare function tokenTag(arg0: Token): void;

/**
 * Count a checked proof-only input. 
 */
export declare function witnessCount(arg0: Witness): bigint;

/**
 * Containers of zero-payload results keep their length and presence. 
 */
export declare function witnesses(arg0: bigint): ReadonlyArray<Witness>;

declare const bindings: Readonly<{
  readonly absentCount: typeof absentCount;
  readonly markCount: typeof markCount;
  readonly markerCount: typeof markerCount;
  readonly maybeWitness: typeof maybeWitness;
  readonly produceMark: typeof produceMark;
  readonly produceMarker: typeof produceMarker;
  readonly produceToken: typeof produceToken;
  readonly produceWitness: typeof produceWitness;
  readonly tokenTag: typeof tokenTag;
  readonly witnessCount: typeof witnessCount;
  readonly witnesses: typeof witnesses;
}>;
export default bindings;
