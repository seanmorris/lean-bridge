/**
 * Closed retained-evidence ledger for proof erasure. Exact bindings require an
 * immutable archive plus the authenticated Lean fixture that places the erased
 * proof at the named position. Adjacent checked-record evidence stays residual.
 *
 * @file
 */
import assert from "node:assert/strict";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";

const zeroPayloadLane = Object.freeze({
	perl: "perl"
	, "node-javascript": "browser"
	, "node-typescript": "browser"
	, "browser-javascript": "browser"
	, "browser-react": "browser"
	, "browser-worker": "browser"
	, "php-native": "php"
	, "php-wasm": "php-wasm"
	, dotnet: "dotnet"
	, java: "jvm"
	, kotlin: "jvm"
	, ruby: "ruby"
	, python: "python"
	, rust: "rust"
	, c: "native"
	, cpp: "native"
	, "wit-wasi": "wit"
});
const nestedLane = zeroPayloadLane;
const nestedFixtureSha256
	= "31351649eecd9d596696e32350059f672d0ee42cd7604237e0966c5b664279e8";
const callbackFixtureSha256
	= "8e6babb2f13a48d39de6158814b75f54c59173780e1310f2fa521cdd110909b7";
const callbackEvidence = Object.freeze({
	perl: "callback-checked-record-perl-hosted-installed"
	, "node-javascript": "callback-checked-record-browser-hosted-installed"
	, "node-typescript": "callback-checked-record-browser-hosted-installed"
	, "browser-javascript": "callback-checked-record-browser-hosted-installed"
	, "browser-react": "callback-checked-record-browser-hosted-installed"
	, "browser-worker": "callback-checked-record-browser-hosted-installed"
	, "php-native": "callback-checked-record-php-native-hosted-installed"
	, "php-wasm": "callback-refinements-php-wasm-hosted-installed"
	, dotnet: "callback-checked-record-dotnet-hosted-installed"
	, java: "callback-checked-record-jvm-hosted-installed"
	, kotlin: "callback-checked-record-jvm-hosted-installed"
	, ruby: "callback-checked-record-languages-hosted-installed"
	, python: "callback-checked-record-languages-hosted-installed"
	, rust: "callback-checked-record-languages-hosted-installed"
	, c: "callback-checked-record-native-hosted-installed"
	, cpp: "callback-checked-record-native-hosted-installed"
	, "wit-wasi": "callback-checked-record-wit-wasi-hosted-installed"
});

const candidateFor = cell => {
	const route = cell.path;
	if(cell.position === "parameter") return {
		evidence: `zero-payload-${zeroPayloadLane[cell.profile]}-${route}-hosted-installed`
		, basis: "zero-payload-record-parameter"
		, reason: "proof-only-record-is-not-a-direct-proof-parameter"
	};
	if(cell.position === "result") return {
		evidence: `zero-payload-${zeroPayloadLane[cell.profile]}-result-only-${route}-hosted-installed`
		, basis: "zero-payload-record-result"
		, reason: "proof-only-record-is-not-a-direct-proof-result"
	};
	if(cell.position === "field") return {
		evidence: `nested-checked-record-${nestedLane[cell.profile]}-${route === "ordinary-source" ? "ordinary" : "reviewed"}-full-installed`
		, basis: "erased-record-field", fixture: "NestedCheckedRecords.lean"
		, fixtureSha256: nestedFixtureSha256
	};
	if(["callback-parameter", "callback-result"].includes(cell.position))
		return {
			evidence: callbackEvidence[cell.profile]
			, basis: "erased-callback-record-field"
			, fixture: "CallbackCheckedRecords.lean"
			, fixtureSha256: callbackFixtureSha256
		};
	assert.equal(cell.position, "signature");
	return null;
};

const installedEvidence = (inventory, id) => {
	const matches = inventory.evidence.filter(item => item.id === id);
	assert.equal(matches.length, 1, id);
	const [evidence] = matches;
	assert.equal(evidence.kind, "installed", id);
	assert.match(evidence.revision, /^[a-f0-9]{40}$/u, id);
	assert.ok(typeof evidence.command === "string"
		&& evidence.command.length > 0, id);
	assert.ok(typeof evidence.scope === "string"
		&& evidence.scope.length > 0, id);
	assert.ok(Array.isArray(evidence.files) && evidence.files.length > 0, id);
	assert.ok(Array.isArray(evidence.artifacts)
		&& evidence.artifacts.length > 0, id);
	return evidence;
};

const retainedBinding = (evidence, candidate) => {
	assert.ok(candidate.fixture, evidence.id);
	assert.match(candidate.fixtureSha256, /^[a-f0-9]{64}$/u);
	const indexes = evidence.files.filter(file =>
		/^docs\/evidence\/[^/]+\/index\.json$/u.test(file.path));
	assert.equal(indexes.length, 1, evidence.id);
	const fixtures = evidence.files.filter(file =>
		file.path.includes("/sources/")
		&& file.path.endsWith(`/${candidate.fixture}`));
	assert.equal(fixtures.length, 1, evidence.id);
	assert.equal(fixtures[0].sha256, candidate.fixtureSha256, evidence.id);
	return Object.freeze({
		archiveIndex: Object.freeze({ ...indexes[0] })
		, fixtureSource: Object.freeze({ ...fixtures[0] })
	});
};

/**
 * Bind exact retained proof-erasure evidence and enumerate the deliberately
 * unbound direct-proof residual. This audit does not promote the inventory.
 *
 * @param inventory - Current type-surface inventory.
 * @param contracts - Independent Binding IR and consumer contracts.
 */
export const auditProofErasureEvidence = (inventory, contracts) => {
	const cells = typeSurfaceCells(inventory, contracts
		, cell => cell.shape === "proof");
	assert.equal(cells.length, 204);
	const bindings = [], residual = [];
	for(const cell of cells)
	{
		const candidate = candidateFor(cell);
		if(candidate === null)
		{
			residual.push(Object.freeze({ cell: cell.id
				, reason: "direct-proof-signature-not-yet-observed" }));
			continue;
		}
		const evidence = installedEvidence(inventory, candidate.evidence);
		if(candidate.reason)
		{
			residual.push(Object.freeze({ cell: cell.id
				, candidate: candidate.evidence, reason: candidate.reason }));
			continue;
		}
		bindings.push(Object.freeze({
			cell: cell.id, evidence: candidate.evidence, basis: candidate.basis
			, verification: "exact-retained-replay"
			, retained: retainedBinding(evidence, candidate)
		}));
	}
	assert.equal(bindings.length, 102);
	assert.equal(residual.length, 102);
	assert.equal(new Set([...bindings, ...residual].map(item => item.cell)).size
		, cells.length);
	return Object.freeze({
		cells: Object.freeze(cells.map(cell => cell.id))
		, bindings: Object.freeze(bindings)
		, residual: Object.freeze(residual)
	});
};
