/**
 * Typed boundary for the DOM-free proof artifact services.
 *
 * @file
 */

/** Source ordering and named checker challenge for one algorithm. */
export interface ProofConfiguration {
	core: string;
	proof: string;
	namespace: string;
	comparator: string;
	theorems: readonly string[];
	dependencies: readonly string[];
}

/** Fields consumed from a hash-checked build receipt. */
export interface ProofAudit {
	checker: string;
	theorems: readonly unknown[];
	sourceFiles: Record<string, {sha256: string}>;
}

/**
 * Render escaped source as numbered syntax-highlighted HTML.
 *
 * @param source Exact source text.
 */
export function highlightSource(source: string): string;
/**
 * List the named source files without duplicate fetches.
 *
 * @param config Source ordering and named proof guarantees.
 */
export function proofSourceNames(config: ProofConfiguration): string[];
/**
 * Fetch sources and receipt using the owner's abort signal.
 *
 * @param base Directory containing source artifacts.
 * @param config Source ordering and named proof guarantees.
 * @param signal Caller-owned request cancellation signal.
 */
export function loadProofSources(base: string | URL, config: ProofConfiguration, signal?: AbortSignal):
Promise<{audit: ProofAudit; sources: Map<string, string>}>;
/**
 * Compute an exact UTF-8 source hash.
 *
 * @param source Exact source text.
 */
export function sha256Source(source: string): Promise<string>;
/**
 * Reject invalid or mismatched source receipts.
 *
 * @param config Source ordering and named proof guarantees.
 * @param sources Loaded source text by filename.
 * @param audit Build receipt to verify.
 */
export function verifyProofAudit(config: ProofConfiguration, sources: Map<string, string>, audit: ProofAudit): Promise<void>;
/**
 * Join sources and theorem diagnostics into a standalone program.
 *
 * @param config Source ordering and named proof guarantees.
 * @param sources Loaded source text by filename.
 */
export function interactiveSource(config: ProofConfiguration, sources: Map<string, string>): string;
/**
 * Make private declarations visible across a Comparator challenge.
 *
 * @param source Exact source text.
 */
export function comparatorCompatible(source: string): string;
/**
 * Extract the configured theorem statement.
 *
 * @param config Source ordering and named proof guarantees.
 * @param sources Loaded source text by filename.
 */
export function comparatorChallenge(config: ProofConfiguration, sources: Map<string, string>): string;
/**
 * Encode a compressed WASM checker workspace.
 *
 * @param config Source ordering and named proof guarantees.
 * @param sources Loaded source text by filename.
 * @param signal Cancel pending compression when its owner leaves.
 */
export function buildWasmUrl(config: ProofConfiguration, sources: Map<string, string>, signal?: AbortSignal): Promise<string>;
/**
 * Encode a Comparator challenge and solution.
 *
 * @param config Source ordering and named proof guarantees.
 * @param sources Loaded source text by filename.
 */
export function buildLeanWebUrl(config: ProofConfiguration, sources: Map<string, string>): string;
/**
 * Focus or reopen a user-owned checker tab.
 *
 * @param url Prepared external checker URL.
 * @param windowName Stable checker tab name.
 */
export function openProofChecker(url: string, windowName: string): boolean;
