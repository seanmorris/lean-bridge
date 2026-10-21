// Generated from Binding IR SHA-256 57bd0af332c6ed6dd3f53859cce38bed912683b030a9cb896af12ac613040804.
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
export declare function witnesses(value0: bigint): ReadonlyArray<Witness>;

declare const bindings: Readonly<{
  readonly maybeWitness: typeof maybeWitness;
  readonly produceMark: typeof produceMark;
  readonly produceMarker: typeof produceMarker;
  readonly produceToken: typeof produceToken;
  readonly produceWitness: typeof produceWitness;
  readonly witnesses: typeof witnesses;
}>;
export default bindings;
