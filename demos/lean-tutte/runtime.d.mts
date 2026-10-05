/**
 * Public transport and certificate types for the bounded demonstration API.
 *
 * @file
 */
export interface CertificateInput { width: number; height: number; levels: Uint32Array; squares: Uint32Array; }
export interface CertificateResult { tiling: boolean; electrical: boolean; simple: boolean; perfect: boolean; threeConnected: boolean; balances: { incoming: number; outgoing: number }[]; }
export type Checker = (input: CertificateInput) => CertificateResult;
export function createChecker(): Promise<Checker>;
