// Generated from Binding IR SHA-256 0b023197b9eda95e08827f1f8487879ce65ed2dc74218fadbcaa0aa1d4427d4a.
/**
 * Independent mutual checked-record contract.
 */
export interface Envelope {
  readonly value: bigint;
  readonly mode: bigint;
  readonly next: Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Step }>;
}

/**
 * Independent mutual checked-record contract.
 */
export type EnvelopeAlias = Envelope;

/**
 * Independent mutual checked-record contract.
 */
export type Step = Readonly<{ readonly kind: "stop" }> | Readonly<{ readonly kind: "more"; readonly packet: Envelope }>;

/**
 * Independent corpus contract.
 */
export declare function echo(value0: Envelope): Envelope;

/**
 * Independent corpus contract.
 */
export declare function echoGroups(value0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;

/**
 * Independent corpus contract.
 */
export declare function first(value0: Envelope): bigint;

/**
 * Independent corpus contract.
 */
export declare function groups(value0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>): bigint;

/**
 * Independent corpus contract.
 */
export declare function produce(value0: bigint): Envelope;

/**
 * Independent corpus contract.
 */
export declare function second(value0: Envelope): bigint;

declare const bindings: Readonly<{
  readonly echo: typeof echo;
  readonly echoGroups: typeof echoGroups;
  readonly first: typeof first;
  readonly groups: typeof groups;
  readonly produce: typeof produce;
  readonly second: typeof second;
}>;
export default bindings;
