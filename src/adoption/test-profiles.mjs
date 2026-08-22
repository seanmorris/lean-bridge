/**
 * Classifies every repository test through a closed, reviewable manifest.
 *
 * @file
 */

/** @type {Readonly<Record<string, readonly string[]>>} */
const profileManifest = Object.freeze({
	contract: Object.freeze([
		"archive-subjects"
		, "binding-ir-contract"
		, "binding-semantic-parity"
		, "callback-runtime"
		, "checked-javascript"
		, "callback-signature"
		, "canonical-package-manifest"
		, "capsule-contract"
		, "cli-contract"
		, "credential-boundary"
		, "docker-consumer-ci"
		, "documentation"
		, "generated-package-gate"
		, "host-object-generator"
		, "independent-confirmation"
		, "independent-verifier"
		, "javascript-coverage"
		, "javascript-generator"
		, "lean-project-analyzer"
		, "onboarding-acceptance"
		, "npm-registry-adapter"
		, "pending-operation"
		, "public-surface-conformance"
		, "publication-attestation"
		, "production-deployment-profile"
		, "registry-transaction"
		, "release-backend-policy"
		, "release-candidate-state"
		, "release-receipt"
		, "release-rehearsal"
		, "reproducibility-gate"
		, "target-runtime-profiles"
		, "test-profiles"
		, "time-to-package"
		, "toolchain-preflight"
		, "usability-gate", "value-frame-generator", "weak-value-map", "wit-backend"
		, "internal/abi/error-envelope"
		, "internal/abi/generic-specialization"
		, "internal/abi/initialization-adapter"
		, "internal/abi/iterator-adapter"
		, "internal/abi/javascript-projection"
		, "internal/abi/js-pending-operations"
		, "internal/abi/js-resource-registry"
		, "internal/abi/lean-closure-finalization"
		, "internal/abi/lean-cross-library"
		, "internal/abi/lean-memory-profiles"
		, "internal/abi/lean-pending-operation"
		, "internal/abi/lean-runtime-lifecycle"
		, "internal/abi/lean-value-frame"
		, "internal/abi/library-loader"
		, "internal/abi/link-spike-startup"
		, "internal/abi/overload-adapter"
		, "internal/abi/property-adapter"
		, "internal/abi/resource-lifecycle-generator"
	])
	, browser: Object.freeze(["browser-bundler"])
	, performance: Object.freeze([
		"performance-budgets"
		, "performance-ci-report"
		, "performance-corpus"
		, "performance-harness"
		, "performance-lifecycle"
		, "performance-methodology"
		, "performance-overhead"
		, "performance-reference"
		, "performance-reproducibility"
		, "performance-scaling"
		, "performance-wasm"
		, "performance-workloads"
	])
	, managed: Object.freeze(["managed-artifacts", "managed-generators", "managed-registry-package"])
	, php: Object.freeze([
		"php-generator", "php-native-package", "php-native-runtime", "php-projection"
		, "php-transport-conformance"
		, "php-wasm-adapter"
		, "php-wasm-package"
		, "php-zend-extension"
	])
	, native: Object.freeze([
		"c-family-package"
		, "c-generator"
		, "cargo-package"
		, "cpp-generator"
		, "pypi-package"
		, "python-generator"
		, "python-wheel-compatibility"
		, "release-install-gate"
		, "rust-generator"
	])
	, component: Object.freeze([
		"canonical-build"
		, "compiler-adapters"
		, "component-artifact-manifest"
		, "component-build-plan"
		, "component-compilation-plan"
		, "component-engine"
		, "component-npm-package"
		, "component-release-bundle"
		, "component-reproducibility-gate"
		, "component-side-linker"
		, "engine-execution-request"
		, "engine-output-comparison"
		, "lean-component-compiler"
		, "lean-final-static"
		, "lean-graph-lock"
		, "lean-link-profiles"
		, "lean-link-spike"
		, "lean-link-structure"
		, "link-spike"
		, "npm-package"
		, "side-module-audit", "universal-release-bundle"
	])
	, consumer: Object.freeze(["consumer-node"])
});

const entryToProfile = new Map();
for(const [profile, entries] of Object.entries(profileManifest))
{
	for(const entry of entries)
	{
		if(entryToProfile.has(entry)) throw new Error(`Duplicate test profile entry ${entry}`);
		entryToProfile.set(entry, profile);
	}
}

/**
 * Names the test profiles accepted by the repository test runner.
 */
export const repositoryTestProfiles = Object.freeze([...Object.keys(profileManifest), "all"]);

/**
 * Assigns one test path to exactly one profile and rejects unknown files.
 *
 * @param {string} path - Repository-relative test file path.
 */
export const classifyRepositoryTest = path => {
	const match = /^tests\/(.+)\.test\.mjs$/.exec(path.replaceAll("\\", "/"));
	if(match === null) throw new Error(`Not a repository test path: ${path}`);
	const profile = entryToProfile.get(match[1]);
	if(profile === undefined) throw new Error(`Unclassified repository test: ${path}`);
	return profile;
};

/**
 * Groups repository tests by their unique execution profile.
 *
 * @param {readonly string[]} paths - Repository-relative test file paths.
 */
export const groupRepositoryTests = paths => {
	/** @type {Record<string, string[]>} */
	const grouped = Object.fromEntries(Object.keys(profileManifest).map(profile => [profile, []]));
	for(const path of [...paths].sort()) grouped[classifyRepositoryTest(path)].push(path);
	const discovered = new Set(paths.map(path => path.replaceAll("\\", "/").replace(/^tests\//, "").replace(/\.test\.mjs$/, "")));
	const absent = [...entryToProfile.keys()].filter(entry => !discovered.has(entry));
	if(absent.length > 0) throw new Error(`Test profile entries do not exist: ${absent.join(", ")}`);
	return Object.freeze(Object.fromEntries(Object.entries(grouped).map(([profile, values]) => [profile, Object.freeze(values)])));
};
