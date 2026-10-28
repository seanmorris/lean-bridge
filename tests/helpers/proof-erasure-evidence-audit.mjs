/**
 * Closed candidate ledger for proof-erasure evidence. A candidate is not a
 * promotion: its immutable archive still has to prove the exact proof position
 * before the corresponding cell may change state.
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
		, basis: "zero-payload-parameter"
	};
	if(cell.position === "result") return {
		evidence: `zero-payload-${zeroPayloadLane[cell.profile]}-result-only-${route}-hosted-installed`
		, basis: "zero-payload-result"
	};
	if(cell.position === "field") return {
		evidence: `nested-checked-record-${nestedLane[cell.profile]}-${route === "ordinary-source" ? "ordinary" : "reviewed"}-full-installed`
		, basis: "erased-record-field"
	};
	if(["callback-parameter", "callback-result"].includes(cell.position))
		return {
			evidence: callbackEvidence[cell.profile]
			, basis: "erased-callback-record-field"
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

/**
 * Enumerate exact candidate bindings and the deliberately unbound residual.
 * The returned candidate records stay marked pending until archive-specific
 * replay proves the named proof position rather than a merely adjacent value.
 *
 * @param inventory - Current type-surface inventory.
 * @param contracts - Independent Binding IR and consumer contracts.
 */
export const auditProofErasureEvidence = (inventory, contracts) => {
	const cells = typeSurfaceCells(inventory, contracts
		, cell => cell.shape === "proof");
	assert.equal(cells.length, 204);
	const candidates = [], residual = [];
	for(const cell of cells)
	{
		const candidate = candidateFor(cell);
		if(candidate === null)
		{
			residual.push(Object.freeze({ cell: cell.id
				, reason: "direct-proof-signature-not-yet-observed" }));
			continue;
		}
		installedEvidence(inventory, candidate.evidence);
		candidates.push(Object.freeze({
			cell: cell.id, ...candidate, verification: "pending-exact-replay"
		}));
	}
	assert.equal(candidates.length, 170);
	assert.equal(residual.length, 34);
	assert.equal(new Set([...candidates, ...residual].map(item => item.cell)).size
		, cells.length);
	return Object.freeze({
		cells: Object.freeze(cells.map(cell => cell.id))
		, candidates: Object.freeze(candidates)
		, residual: Object.freeze(residual)
	});
};
