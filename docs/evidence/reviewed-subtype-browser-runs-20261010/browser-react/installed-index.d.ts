// Generated from Binding IR SHA-256 1f38068bdf77779e5676c60ec7a433d2dcdfb5362fb782344390ba6728eb118c.
/**
 * Independent corpus contract.
 */
export declare function byte(value0: number): number;

/**
 * Independent corpus contract.
 */
export declare function clamp(value0: bigint): bigint;

/**
 * Independent corpus contract.
 */
export declare function firstEven(value0: bigint): bigint;

/**
 * Independent corpus contract.
 */
export declare function half(value0: bigint): bigint;

/**
 * Independent corpus contract.
 */
export declare function head(value0: Uint8Array): number;

/**
 * Independent corpus contract.
 */
export declare function join(value0: string, value1: string): string;

/**
 * Independent corpus contract.
 */
export declare function mix(value0: bigint, value1: bigint): bigint;

/**
 * Independent corpus contract.
 */
export declare function pad(value0: bigint): bigint;

/**
 * Independent corpus contract.
 */
export declare function scale(value0: bigint, value1: bigint): bigint;

/**
 * Independent corpus contract.
 */
export declare function secondEven(value0: bigint): bigint;

/**
 * Independent corpus contract.
 */
export declare function shout(value0: string): string;

/**
 * Independent corpus contract.
 */
export declare function zeroEven(): bigint;

declare const bindings: Readonly<{
  readonly byte: typeof byte;
  readonly clamp: typeof clamp;
  readonly firstEven: typeof firstEven;
  readonly half: typeof half;
  readonly head: typeof head;
  readonly join: typeof join;
  readonly mix: typeof mix;
  readonly pad: typeof pad;
  readonly scale: typeof scale;
  readonly secondEven: typeof secondEven;
  readonly shout: typeof shout;
  readonly zeroEven: typeof zeroEven;
}>;
export default bindings;
