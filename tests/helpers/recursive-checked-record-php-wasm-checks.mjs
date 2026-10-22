/**
 * Pure, independently testable claims for recursive checked-record PHP-Wasm producer records.
 * Each check refuses rather than repairs; the report checker composes them over originals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { posix } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	adaptRecursiveCheckedRecordPhpWasm, recursiveCheckedRecordPhpWasmCaller
	, recursiveCheckedRecordPhpWasmCallerBlob, recursiveCheckedRecordPhpWasmFixtures
	, recursiveCheckedRecordPhpWasmLoadCeilings, recursiveCheckedRecordPhpWasmRequest
	, recursiveCheckedRecordPhpWasmRoutes
} from "./recursive-checked-record-php-wasm-fixture.mjs";

const exact = (object, keys) => assert.deepEqual(Object.keys(object).sort(), [...keys].sort());
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
/**
 * Git object id of a blob, so the pinned caller id is checked exactly.
 *
 * @param bytes - Complete blob contents.
 */
export const recursiveCheckedRecordPhpWasmGitBlob = bytes => createHash("sha1")
	.update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest("hex");
/** Public PHP sources shipped by the npm component (under compiled/) and the Composer API package. */
export const recursiveCheckedRecordPhpWasmPublicSources = Object.freeze([
	"src/Api.php", "src/Internal/Native.php", "src/Internal/Values.php"
	, "src/Internal/GraphTypes.php", "src/Internal/Wire.php"
]);
export const recursiveCheckedRecordPhpWasmReportKeys = Object.freeze([
	"schemaVersion", "route", "fixture", "producerCommit", "configuration"
	, "expectedBindingIrSha256", "builds", "receipt", "phpWasm", "observation"
	, "reproducible", "independentBuilds", "authorInputsUnchanged"
	, "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay"
	, "relocatedInstallation", "consumerSourceRequired", "loadCeiling", "dispatch"
]);
const claims = [
	"reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation"
	, "offlineInstall", "compilerFreeReplay", "relocatedInstallation"
	, "consumerSourceRequired"
];

/**
 * Accept only the producer's canonical scratch directory for this lane.
 *
 * @param directory - Original mkdtemp directory from a Linux producer record.
 */
export const assertRecursiveCheckedRecordPhpWasmDirectory = directory => {
	assert.equal(typeof directory, "string");
	assert.ok(posix.isAbsolute(directory) && !directory.endsWith("/") && posix.normalize(directory) === directory
		, "The original temporary directory must be absolute and canonical");
	assert.ok([...directory].every(character => character.charCodeAt(0) >= 32 && ![92, 127].includes(character.charCodeAt(0)))
		, "The original temporary directory cannot contain controls or backslashes");
	assert.match(posix.basename(directory), /^lean-bridge-recursive-php-wasm-installed-[A-Za-z0-9]+$/u);
};

/**
 * Require the exact selection, both author roots and every isolation claim.
 *
 * @param report - Original top-level report.
 * @param scope - Independently selected route, module and frozen producer.
 * @param scope.route - Ordinary source or independent review.
 * @param scope.fixture - Recursive or mutual module.
 * @param scope.producerCommit - Immutable producer revision.
 */
export const checkRecursiveCheckedRecordPhpWasmReportClaims = (report, { route, fixture, producerCommit }) => {
	assert.ok(recursiveCheckedRecordPhpWasmRoutes.includes(route)); assert.ok(recursiveCheckedRecordPhpWasmFixtures.includes(fixture));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	exact(report, recursiveCheckedRecordPhpWasmReportKeys);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.route, route, "route"); assert.equal(report.fixture, fixture, "fixture");
	assert.equal(report.producerCommit, producerCommit, "producer");
	for(const key of claims) assert.equal(report[key], true, key);
	assert.ok(recursiveCheckedRecordPhpWasmLoadCeilings.includes(report.loadCeiling), "Unrecorded recursive PHP-Wasm load ceiling");
	// Two independent author roots must reproduce every model, receipt and archive.
	assert.equal(report.independentBuilds, 2); assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0], "Both author roots reproduce the packages");
	assert.deepEqual(report.dispatch, { observed: false, reason: "No constructor/source entry counters in this unmodified PHP-Wasm package" });
};

/**
 * Bind the scratch context to the same selection and its fixed layout.
 *
 * @param context - Original context.json.
 * @param report - Already checked report.
 */
export const checkRecursiveCheckedRecordPhpWasmContext = (context, report) => {
	exact(context, ["producerCommit", "route", "fixture", "root", "consumer", "handoff"]);
	for(const key of ["producerCommit", "route", "fixture"]) assert.equal(context[key], report[key], key);
	assertRecursiveCheckedRecordPhpWasmDirectory(context.root);
	assert.equal(context.consumer, context.root + "/consumer"); assert.equal(context.handoff, context.consumer + "/handoff");
};

/**
 * Reconstruct both adapted callers from the frozen producer's pinned native caller blob.
 *
 * @param original - Frozen producer byte reader.
 * @param callerBlob - Git blob expected at that producer revision. Defaults
 * to the live caller for source-only and new-producer checks.
 */
export const recursiveCheckedRecordPhpWasmCallers = (
	original, callerBlob = recursiveCheckedRecordPhpWasmCallerBlob
) => {
	assert.match(callerBlob, /^[a-f0-9]{40}$/u);
	const native = original(recursiveCheckedRecordPhpWasmCaller);
	// Both PHP lanes carry this exact caller; any other blob is a forked corpus.
	assert.equal(recursiveCheckedRecordPhpWasmGitBlob(native), callerBlob, "Shared native-PHP caller blob");
	return Object.freeze(Object.fromEntries(["weak", "strict"].map(strictness =>
		[strictness, adaptRecursiveCheckedRecordPhpWasm(native.toString(), strictness)])));
};

/**
 * Require unchanged callers and requests in records, the relocated deployment and the evidence.
 *
 * @param options - Original texts and inventories.
 * @param options.text - Selection-relative text reader.
 * @param options.evidence - Original installed PHP-Wasm observation.
 * @param options.callers - Independently reconstructed weak and strict callers.
 * @param options.fixture - Recursive or mutual module.
 */
export const checkRecursiveCheckedRecordPhpWasmConsumers = async ({ text, evidence, callers, fixture }) => {
	for(const strictness of ["weak", "strict"])
	{
		const caller = callers[strictness];
		assert.equal(await text(strictness + ".php"), caller, strictness);
		assert.equal(await text("deployment/" + strictness + ".php"), caller, `deployment ${strictness}`);
		assert.equal(evidence.consumerSources[strictness], sha256(caller), `consumer ${strictness}`);
		assert.deepEqual(evidence.deployment[strictness + ".php"], identity(caller), `deployed ${strictness}`);
	}
	for(const arrangement of ["embedded", "composer"])
	{
		const request = recursiveCheckedRecordPhpWasmRequest(fixture, arrangement);
		assert.equal(await text(`request-${arrangement}.json`), request, arrangement);
		assert.equal(await text(`deployment/request-${arrangement}.json`), request, `deployment ${arrangement}`);
		assert.equal(evidence.requests[arrangement], sha256(request), `request ${arrangement}`);
	}
};

/**
 * Require the diagnostic-on transport and the exact public PHP sources. The compiled extension
 * is bound through its Zend manifest digest; the feature-off manifest must not match.
 * The transport is regenerated from the build's own binding IR, which the caller has already
 * authenticated against its digest and the reviewed contract: the ordinary route keeps the
 * elaborator's documentation and producer records, so the review IR alone cannot reproduce it.
 *
 * @param options - Frozen generator output and shipped package members.
 * @param options.generator - Frozen generateCopiedPhpGraphZendAdapter.
 * @param options.ir - Authenticated binding IR of build-0.
 * @param options.component - Original php-wasm-component.json.
 * @param options.members - Map of package role to member map (path to bytes).
 */
export const checkRecursiveCheckedRecordPhpWasmTransport = ({ generator, ir, component, members }) => {
	assert.equal(typeof ir, "object"); assert.ok(ir !== null);
	const on = generator(ir, { refinementDiagnostics: true }), off = generator(ir);
	const manifest = "graph-zend-manifest.json";
	assert.equal(component.zendSha256, sha256(on[manifest]), "The compiled Zend extension must read exact refinement diagnostics");
	assert.notEqual(component.zendSha256, sha256(off[manifest]), "The feature-off Zend transport must differ");
	const extension = Object.entries(on).find(([path]) => path.startsWith("extension/"))[1];
	assert.match(extension, /if \(!message && status == 1\) message = [a-z]+checkedrecords_graph_error\(\);/u);
	assert.match(on["src/Internal/Native.php"], /throw new \\Lean[A-Za-z]+\\LeanBridgeError\(\$error->getMessage\(\), \$error->getCode\(\), \$error\)/u);
	for(const path of recursiveCheckedRecordPhpWasmPublicSources)
	{
		// The public PHP sources are option-independent; the option lives only in the extension.
		assert.equal(on[path], off[path], path);
		assert.equal(members.get("component")?.get("compiled/" + path)?.toString(), on[path], "component " + path);
		assert.equal(members.get("api")?.get(path)?.toString(), on[path], "api " + path);
	}
};

/**
 * Bind the deployment inventory to exactly the shipped component and API members.
 *
 * @param options - Original deployment inventory and package members.
 * @param options.deployment - Relocated deployment file inventory.
 * @param options.members - Map of package role to member map.
 * @param options.settings - Exact npm and Composer coordinates.
 */
export const checkRecursiveCheckedRecordPhpWasmDeployment = ({ deployment, members, settings }) => {
	const component = members.get("component"), api = members.get("api");
	assert.ok(component && api, "Both the component and API packages are required");
	for(const path of recursiveCheckedRecordPhpWasmPublicSources)
	{
		assert.deepEqual(deployment[`node_modules/${settings.npm.name}/compiled/${path}`], identity(component.get("compiled/" + path)), path);
		assert.deepEqual(deployment[`vendor/${settings.composer.name}/${path}`], identity(api.get(path)), path);
	}
	// Author sources never reach the consumer deployment.
	for(const path of Object.keys(deployment))
		assert.doesNotMatch(path, /(?:^|\/)(?:lakefile\.toml|lean-toolchain|[A-Z][A-Za-z]*CheckedRecords\.lean|lean-bridge\.exports\.json|api\.binding-ir\.json)$/u, path);
};
