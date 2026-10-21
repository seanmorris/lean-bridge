// Generated from Binding IR SHA-256 ff3debc404b0f2f2bcfeedb5ee08cce29f12df1a1c7cf35c33aa34fc5e51e9e5.
/**
 * Independent corpus contract.
 */
export type Mark = Readonly<{ readonly kind: "blank" }> | Readonly<{ readonly kind: "marked"; readonly witness: Witness }>;

/**
 * Independent corpus contract.
 */
export type Marker = Readonly<Record<PropertyKey, never>>;

/**
 * Independent corpus contract.
 */
export interface Token {
  readonly tag: void;
}

/**
 * Independent corpus contract.
 */
export type Witness = Readonly<Record<PropertyKey, never>>;

/**
 * Independent corpus contract.
 */
export declare function absentCount(value0: Witness): bigint;

/**
 * Independent corpus contract.
 */
export declare function markCount(value0: Mark): bigint;

/**
 * Independent corpus contract.
 */
export declare function markerCount(value0: Marker): bigint;

/**
 * Independent corpus contract.
 */
export declare function maybeWitness(value0: boolean): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Witness }>;

/**
 * Independent corpus contract.
 */
export declare function produceMark(value0: boolean): Mark;

/**
 * Independent corpus contract.
 */
export declare function produceMarker(): Marker;

/**
 * Independent corpus contract.
 */
export declare function produceToken(): Token;

/**
 * Independent corpus contract.
 */
export declare function produceWitness(): Witness;

/**
 * Independent corpus contract.
 */
export declare function tokenTag(value0: Token): void;

/**
 * Independent corpus contract.
 */
export declare function witnessCount(value0: Witness): bigint;

/**
 * Independent corpus contract.
 */
export declare function witnesses(value0: bigint): ReadonlyArray<Witness>;

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
