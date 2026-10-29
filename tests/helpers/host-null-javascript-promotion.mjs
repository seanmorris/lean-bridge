/**
 * Promote only the 50 JavaScript/browser HostNull cells established by the
 * immutable hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import {
	checkHostNullJavaScriptBrowserEvidence
	, hostNullJavaScriptBrowserEvidence
	, hostNullJavaScriptBrowserEvidenceSha256
} from "./host-null-javascript-browser-evidence.mjs";

export const hostNullJavaScriptPromotionEvidenceId
	= "hosted-host-null-javascript-browser-installed";
export const hostNullJavaScriptPromotionProfiles = Object.freeze([
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker"
]);
export const hostNullJavaScriptPromotionPositions = Object.freeze([
	"parameter", "result", "field", "callback-parameter", "callback-result"
]);
export const hostNullJavaScriptPromotionPaths = Object.freeze([
	"ordinary-source", "reviewed-ir"
]);
export const hostNullJavaScriptPromotionCells = Object.freeze(
	hostNullJavaScriptPromotionProfiles.flatMap(profile =>
		hostNullJavaScriptPromotionPaths.flatMap(path =>
			hostNullJavaScriptPromotionPositions.map(position =>
				`${profile}/host-null/${path}/${position}`)))
);
assert.equal(hostNullJavaScriptPromotionCells.length, 50);
assert.equal(new Set(hostNullJavaScriptPromotionCells).size, 50);

const referencePaths = Object.freeze([
	`${hostNullJavaScriptBrowserEvidence}/index.json`
	, "scripts/archive-host-null-javascript-browser-evidence.mjs"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-host-null-javascript.mjs"
	, "tests/helpers/host-null-javascript-browser-evidence.mjs"
	, "tests/helpers/host-null-javascript-hosted-report.mjs"
	, "tests/helpers/host-null-javascript-promotion.mjs"
	, "tests/helpers/host-null-javascript-promotion-tests.mjs"
]);

/** Authenticate the hosted archive and describe its type-surface evidence. */
export const hostNullJavaScriptPromotionReference = async () => {
	const accepted = await checkHostNullJavaScriptBrowserEvidence();
	const bytes = await readFile(
		`${hostNullJavaScriptBrowserEvidence}/index.json`);
	assert.equal(sha256(bytes), hostNullJavaScriptBrowserEvidenceSha256);
	const index = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.kind, "host-null-javascript-browser-installed-v1");
	assert.equal(index.producerCommit, accepted.producer);
	assert.equal(accepted.hostedAcceptance, true);
	assert.equal(accepted.supportPromoted, false);
	return Object.freeze({
		id: hostNullJavaScriptPromotionEvidenceId
		, revision: index.producerCommit
		, command: "LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit node --test --test-concurrency=1 tests/host-null-npm-installed.test.mjs"
		, scope: "Hosted ordinary-source and independently reviewed HostNull npm packages execute through Node JavaScript, strict TypeScript, Chromium, Firefox and WebKit pages, React StrictMode and dedicated workers. Parameters, results, record fields, callback parameters and callback results preserve null versus payload and keep nested Option branches distinct."
		, files: await Promise.all(referencePaths.map(async path => ({
			path, sha256: sha256(await readFile(path))
		})))
		, artifacts: Object.freeze([{
			path: `${index.hostedRun.artifact.name}.zip`
			, sha256: index.hostedRun.artifact.sha256
		}])
		, limitations: Object.freeze(index.limitations)
	});
};

const notes = Object.freeze({
	analysis: "Fresh Lean metadata authenticates the exact unary HostNull wrapper and its null and value constructors; independently reviewed Binding IR must reconcile with the same public contract."
	, generation: "Generated JavaScript and TypeScript use null | T directly for HostNull while keeping Option tagged and omission separate."
	, compilation: "The copied and recursive ABI retain a distinct HostNull tag and direct payload branch; invalid representations are rejected without synthesizing a Lean constructor."
	, packaging: "Both author routes produce receipt-closed component and shared-runtime npm archives that relocate, install offline, and run after all producer source and build directories are removed."
	, installedExecution: "Hosted Node, strict TypeScript and all three browser engines exercise five value positions through pages, React StrictMode and dedicated workers, including rejection and recovery cases."
});

/**
 * Add one evidence entry and two route observations, changing exactly 50 cells.
 *
 * @param inventory - Current type-surface document.
 * @param contracts - Binding IR schema and consumer contract.
 * @param reference - Authenticated hosted evidence reference.
 */
export const promoteHostNullJavaScript = (
	inventory, contracts, reference
) => {
	assert.ok(!inventory.evidence.some(item => item.id === reference.id));
	const proposed = structuredClone(inventory);
	proposed.evidence.push({
		id: reference.id, kind: "installed", revision: reference.revision
		, command: reference.command, scope: reference.scope
		, files: reference.files
		, artifacts: reference.artifacts.map(artifact => ({
			...artifact, path: `${reference.id}/${artifact.path}`
		}))
	});
	const beforeCells = typeSurfaceCells(inventory, contracts);
	const before = new Map(beforeCells.map(cell => [cell.id, cell]));
	const target = new Set(hostNullJavaScriptPromotionCells);
	assert.equal(beforeCells.filter(cell => target.has(cell.id)).length, 50);
	for(const id of target)
		assert.equal(before.get(id).stages.installedExecution.state
			, "unreviewed", id);
	for(const path of hostNullJavaScriptPromotionPaths)
	{
		proposed.observations.push({
			id: `host-null-javascript-${path}-hosted-installed`
			, profiles: hostNullJavaScriptPromotionProfiles
			, shapes: ["host-null"]
			, positions: hostNullJavaScriptPromotionPositions
			, path
			, scope: `${path === "ordinary-source" ? "Compiler-authenticated Lean source" : "Independently reviewed Binding IR"} HostNull packages preserve explicit host null and direct payloads across every declared JavaScript/browser value position.`
			, hostTypes: { "host-null": Object.fromEntries(
				hostNullJavaScriptPromotionPositions.map(position => [
					position, "null | T, with Option remaining a separate tagged value"
				])
			) }
			, stages: Object.fromEntries(proposed.stages.map(stage => [stage, {
				state: "passed", evidence: [reference.id], note: notes[stage]
			}]))
			, limitations: [
				"Only the exact declared HostNull wrapper, two author routes, five JavaScript/browser profiles and synchronous copied/callback positions are promoted."
				, "Owned, asynchronous, generic, dependent-refinement and non-JavaScript HostNull combinations remain separate work."
				, ...reference.limitations
			]
			, conversionNotes: {
				"host-null": "The null constructor maps to JavaScript null. The value constructor maps directly to T. Option retains its tagged none/some representation, and an omitted parameter remains a separate API decision."
			}
		});
	}
	const afterCells = typeSurfaceCells(proposed, contracts);
	const changed = afterCells.filter(cell => JSON.stringify(cell.stages)
		!== JSON.stringify(before.get(cell.id).stages));
	assert.deepEqual(changed.map(cell => cell.id).sort()
		, [...target].sort());
	for(const cell of changed)
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			assert.deepEqual(stage.evidence, [reference.id], cell.id);
		}
	return proposed;
};
