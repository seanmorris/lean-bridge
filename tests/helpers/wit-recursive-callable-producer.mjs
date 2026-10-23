/**
 * Load recursive WIT verifiers and deferred repository reads from the exact
 * commit that produced the frozen execution and integration records.
 *
 * @file
 */
import { moduleAtProducerWithSourceReads } from "./producer-module.mjs";
import { bytesAtProducer } from "./producer-source.mjs";

export const witRecursiveCallableProducerCommit
	= "262240dd6bc01aefcb6eae587cc7425aa2218b8c";
export const phpWasmRecursiveCallableProducerCommit
	= "7daacb859a45f3c90ba8739bd9396fa5d970813d";

let producerPromise;
let phpWasmProducerPromise;

/** Return the immutable producer's complete verifier closure. */
export const witRecursiveCallableProducer = () => producerPromise ??= Promise.all([
	"src/adoption/type-surface.mjs"
	, "src/backends/wit/callable-graph-host.mjs"
	, "src/backends/wit/callable-graph-model.mjs"
	, "src/backends/wit/callable-graph-package.mjs"
	, "src/backends/wit/host-evidence.mjs"
	, "src/build/native-graph-model.mjs"
	, "src/build/native-graph-sources.mjs"
	, "src/build/native-wit-artifacts.mjs"
	, "tests/helpers/native-recursive-callable-fixture.mjs"
	, "tests/helpers/wit-recursive-callable-docs.mjs"
	, "tests/helpers/wit-recursive-callable-faults.mjs"
	, "tests/helpers/wit-recursive-callable-malformed.mjs"
	, "tests/helpers/wit-recursive-callable-mixed.mjs"
	, "tests/helpers/wit-recursive-callable-source-history.mjs"
	, "tests/helpers/wit-recursive-callable-values.mjs"
	, "tests/helpers/wit-structured-callable-evidence.mjs"
].map(path => moduleAtProducerWithSourceReads(
	witRecursiveCallableProducerCommit, path
))).then(modules => Object.assign({}, ...modules));

/** Return the predecessor PHP-Wasm verifier from its own producer commit. */
export const phpWasmRecursiveCallableProducer = () => phpWasmProducerPromise
	??= moduleAtProducerWithSourceReads(
		phpWasmRecursiveCallableProducerCommit
		, "tests/helpers/php-wasm-recursive-callable-evidence.mjs"
	);

/**
 * Read one source exactly as it existed at the recursive WIT producer.
 *
 * @param path - Repository-relative source path.
 */
export const witRecursiveCallableProducerSource = path =>
	bytesAtProducer(witRecursiveCallableProducerCommit, path);
