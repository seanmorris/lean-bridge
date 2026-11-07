/**
 * Current Consumer Matrix Nix topology.
 *
 * Historical receipts keep their own immutable job counts. Live workflow
 * assertions share this inventory so a new Nix-backed job cannot update one
 * gate while leaving another stale.
 *
 * @file
 */

export const consumerMatrixNixJobs = Object.freeze([
	"nix-cache", "node-consumers", "reviewed-fin-wasm-entry", "browser-consumer"
	, "php-wasm-receivers", "php-wasm-callback-results", "php-consumers"
	, "php-wasm-consumers", "php-wasm-corpus", "php-multi-profile"
	, "native-c-family-values", "native-consumers", "managed-consumers"
	, "owned-jvm-values", "host-null-systems", "owned-wit-receivers"
	, "wasi-consumer", "docker-engine", "wasi-qualifications"
]);

export const consumerMatrixSortedNixJobs = Object.freeze(
	[...consumerMatrixNixJobs].sort());

export const consumerMatrixDiskBudgetedNixJobs = Object.freeze(
	consumerMatrixNixJobs.filter(id => id !== "nix-cache"));
