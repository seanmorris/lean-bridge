/**
 * Preserve the Node consumer lane's retained-reader deferral.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nodeConsumerRetainedReaderDeferralHistoryPath
	= "docs/evidence/node-consumer-retained-reader-deferral-source-history-20261106.json";
export const nodeConsumerRetainedReaderDeferralPredecessor
	= "48db6f6d05cffe6deb9372ee97b544e00e036c4c";
export const nodeConsumerRetainedReaderDeferralImplementation
	= "c8eedc635fdd34065433490baf2e6df15b097b81";
export const nodeConsumerRetainedReaderDeferralImplementationPaths
	= Object.freeze([
		"tests/generic-records-browser.test.mjs"
		, "tests/helpers/reviewed-fin-wasm-contract-tests.mjs"
		, "tests/helpers/reviewed-fin-wasm-installed-tests.mjs"
		, "tests/retained-contract-tests.test.mjs"
	]);
export const nodeConsumerRetainedReaderDeferralImplementationAdditions
	= Object.freeze([
		"tests/helpers/reviewed-fin-wasm-archived-identity-tests.mjs"
	]);
export const nodeConsumerRetainedReaderDeferralIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const nodeConsumerRetainedReaderDeferralHistoryAdditions
	= Object.freeze([
		"scripts/update-node-consumer-retained-reader-deferral-source-history.mjs"
		, "tests/helpers/node-consumer-retained-reader-deferral-source-history-tests.mjs"
		, "tests/helpers/node-consumer-retained-reader-deferral-source-history.mjs"
	]);
export const nodeConsumerRetainedReaderDeferralNormalizationPaths
	= Object.freeze([...new Set([
		...nodeConsumerRetainedReaderDeferralImplementationPaths
		, ...nodeConsumerRetainedReaderDeferralIntegrationPaths
	])].sort());
export const nodeConsumerRetainedReaderDeferralLoaders = Object.freeze([
	{ parent: "tests/helpers/reviewed-fin-wasm-installed-tests.mjs"
		, module: "./reviewed-fin-wasm-archived-identity-tests.mjs" }
	, { parent: "tests/helpers/reviewed-fin-wasm-installed-tests.mjs"
		, module: "./reviewed-fin-wasm-evidence-tests.mjs" }
	, { parent: "tests/helpers/reviewed-fin-wasm-installed-tests.mjs"
		, module: "./reviewed-fin-promotion-tests.mjs" }
	, { parent: "tests/generic-records-browser.test.mjs"
		, module: "./helpers/generic-record-browser-source-history-tests.mjs" }
	, { parent: "tests/generic-records-browser.test.mjs"
		, module: "./helpers/generic-record-browser-evidence-tests.mjs" }
	, { parent: "tests/generic-records-browser.test.mjs"
		, module: "./helpers/generic-record-browser-archive-source-history-tests.mjs" }
	, { parent: "tests/generic-records-browser.test.mjs"
		, module: "./helpers/browser-generic-promotion-source-history-tests.mjs" }
]);
export const nodeConsumerRetainedReaderDeferralFamilies = Object.freeze([
	"reviewed-fin-npm-20261007", "reviewed-fin-hosts-20261007"
	, "reviewed-scalar-hosts-20261007", "reviewed-scalar-rollout-20261007"
	, "reviewed-perl-scalar-20261007", "reviewed-perl-containers-20261007"
	, "generic-record-browser-20261008"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nodeConsumerRetainedReaderDeferralHistoryPath, "utf8"));
const archivedIdentityTest = "the eight earlier structural Wasm refusal"
	+ " inputs remain byte-identical to their archived identities";

/**
 * Require that the Node lane's retained readers load only through
 * retained-contract loaders while every current contract stays eager.
 *
 * @param sources - Implementation and added paths mapped to complete source.
 */
export const assertNodeConsumerRetainedReaderDeferral = sources => {
	for(const path of [
		...nodeConsumerRetainedReaderDeferralImplementationPaths
		, ...nodeConsumerRetainedReaderDeferralImplementationAdditions
	]) assert.equal(typeof sources[path], "string", path);
	const parents = new Set(nodeConsumerRetainedReaderDeferralLoaders
		.map(loader => loader.parent));
	for(const parent of parents)
	{
		const source = sources[parent];
		const loaders = nodeConsumerRetainedReaderDeferralLoaders
			.filter(loader => loader.parent === parent);
		const registration = source.indexOf(
			"await registerRetainedContractTests([\n");
		assert.ok(registration >= 0, parent);
		assert.equal(source.split("registerRetainedContractTests([").length - 1
			, 1, parent);
		let cursor = registration;
		for(const loader of loaders)
		{
			const entry = source.indexOf(
				`() => import("${loader.module}")`, cursor);
			assert.ok(entry > cursor, `${parent}: ${loader.module}`);
			assert.equal(source.includes(`import "${loader.module}";`), false
				, `${parent}: ${loader.module}`);
			cursor = entry;
		}
		assert.equal(source.indexOf("]);\n", cursor) > cursor, true, parent);
	}
	const installed = sources[
		"tests/helpers/reviewed-fin-wasm-installed-tests.mjs"];
	assert.ok(installed.includes(
		'import "./reviewed-fin-wasm-contract-tests.mjs";\n'));
	assert.match(installed
		, /Fin runs in source-free installed npm packages/u);
	const contract = sources["tests/helpers/reviewed-fin-wasm-contract-tests.mjs"];
	assert.equal(contract.includes(archivedIdentityTest), false);
	assert.equal(contract.includes("docs/evidence/"), false);
	assert.equal(contract.includes("reviewedFinWasmPreFieldMismatches"), false);
	assert.ok(contract.includes("reviewedFinWasmMismatches, reviewedFinWasmRefusal"));
	const archived = sources[
		"tests/helpers/reviewed-fin-wasm-archived-identity-tests.mjs"];
	assert.equal(archived.split(`test("${archivedIdentityTest}"`).length - 1
		, 1);
	assert.ok(archived.includes(
		"docs/evidence/reviewed-fin-npm-20261007/reviewed-structural.json"));
	assert.ok(archived.includes(
		"eb908163d52e8dfc3d24a7327eec6e7e9c366715030ab6284fe33b7c22d4af19"));
	assert.ok(archived.includes('reviewedFinWasmPreFieldMismatches("structural")'));
	const browser = sources["tests/generic-records-browser.test.mjs"];
	assert.ok(browser.includes(
		'import "./helpers/component-package-handoff-tests.mjs";\n'));
	assert.match(browser
		, /process[.]env[.]LEAN_BRIDGE_GENERIC_RECORD_BROWSER_TEST === "1"/u);
	const lane = sources["tests/retained-contract-tests.test.mjs"];
	assert.ok(lane.includes("const deferredRetainedLoaders = Object.freeze([\n"));
	for(const loader of nodeConsumerRetainedReaderDeferralLoaders)
		assert.ok(lane.includes(`, module: "${loader.module}"`), loader.module);
	assert.ok(lane.includes("the Node and browser consumer lane reaches no"
		+ " retained-evidence reader under deferred scope"));
	assert.ok(lane.includes("const assertDeferredLaneClosure = closure => {"));
	assert.ok(lane.includes("assert.deepEqual(readers, []);"));
	return {
		deferredLoaders: nodeConsumerRetainedReaderDeferralLoaders.length
		, retainedFamilies: nodeConsumerRetainedReaderDeferralFamilies.length
		, extractedTests: 1, staticRetainedReaders: 0
		, changedSupportCells: 0, runtimeSemanticChanges: 0
	};
};

/**
 * Reverse one exact authenticated transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseNodeConsumerRetainedReaderDeferralUpdate = (
	source, update
) => {
	assert.ok(nodeConsumerRetainedReaderDeferralNormalizationPaths
		.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove integration and implementation transitions in order.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeNodeConsumerRetainedReaderDeferralSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nodeConsumerRetainedReaderDeferralNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseNodeConsumerRetainedReaderDeferralUpdate(
				current, update);
	}
	return current;
};
