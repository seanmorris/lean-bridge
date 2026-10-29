/**
 * Promote only the 20 native PHP and PHP-Wasm HostNull cells established by
 * their independently retained installed-package archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";

export const hostNullPhpPromotionProfiles = Object.freeze([
	"php-native", "php-wasm"
]);
export const hostNullPhpPromotionPaths = Object.freeze([
	"ordinary-source", "reviewed-ir"
]);
export const hostNullPhpPromotionPositions = Object.freeze([
	"parameter", "result", "field", "callback-parameter", "callback-result"
]);
export const hostNullPhpPromotionCells = Object.freeze(
	hostNullPhpPromotionProfiles.flatMap(profile =>
		hostNullPhpPromotionPaths.flatMap(path =>
			hostNullPhpPromotionPositions.map(position =>
				`${profile}/host-null/${path}/${position}`)))
);
assert.equal(hostNullPhpPromotionCells.length, 20);
assert.equal(new Set(hostNullPhpPromotionCells).size, 20);

const evidenceId = profile => `hosted-host-null-${profile}-installed`;
const hostType = "null | T, with Option represented by distinct None and Some classes";
const exactKeys = (value, expected, label) => assert.deepEqual(
	Object.keys(value).sort(), [...expected].sort(), label);
const assertReferences = references => {
	assert.equal(references.length, hostNullPhpPromotionProfiles.length);
	assert.deepEqual(references.map(item => item.profile).sort()
		, [...hostNullPhpPromotionProfiles].sort());
	for(const reference of references)
	{
		exactKeys(reference, [
			"artifacts", "command", "files", "id", "limitations", "profile"
			, "revision", "scope"
		], `${reference.profile} reference`);
		assert.equal(reference.id, evidenceId(reference.profile));
		assert.match(reference.revision, /^[a-f0-9]{40}$/u);
		assert.ok(reference.files.length > 0 && reference.artifacts.length > 0);
	}
};

const notes = Object.freeze({
	analysis: "Fresh Lean metadata authenticates the exact unary HostNull wrapper and constructors; independently reviewed Binding IR must reconcile with that same contract."
	, generation: "Generated PHP APIs use null or T directly for HostNull while retaining generated None and Some classes for every Option branch."
	, compilation: "The copied ABI retains HostNull as a distinct constructor; native PHP FFI and PHP-Wasm codecs reject malformed values before Lean entry."
	, packaging: "Both author routes reproduce exact receipt-closed packages, install offline after source and handoff removal, and execute after relocation."
	, installedExecution: "Weak and strict PHP callers exercise five value positions, nested Option distinctions, refusals and recovery; PHP-Wasm repeats them in Node and Chromium with startup and lazy loading."
});

/**
 * Add two evidence entries and four route observations, changing exactly 20
 * cells and leaving every non-PHP profile untouched.
 *
 * @param inventory - Current type-surface inventory.
 * @param contracts - Binding IR schema and consumer contract.
 * @param references - Authenticated native PHP and PHP-Wasm evidence.
 */
export const promoteHostNullPhp = (inventory, contracts, references) => {
	assertReferences(references);
	const proposed = structuredClone(inventory);
	for(const reference of references)
		assert.ok(!proposed.evidence.some(item => item.id === reference.id)
			, `Already promoted: ${reference.id}`);
	const beforeCells = typeSurfaceCells(inventory, contracts);
	const before = new Map(beforeCells.map(cell => [cell.id, cell]));
	const target = new Set(hostNullPhpPromotionCells);
	assert.equal(beforeCells.filter(cell => target.has(cell.id)).length, 20);
	for(const id of target)
		assert.equal(before.get(id).stages.installedExecution.state
			, "unreviewed", id);
	for(const reference of references)
	{
		proposed.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: reference.files
			, artifacts: reference.artifacts.map(artifact => ({
				...artifact, path: `${reference.id}/${artifact.path}`
			}))
		});
		for(const path of hostNullPhpPromotionPaths)
		{
			const profile = reference.profile;
			proposed.observations.push({
				id: `host-null-${profile}-${path}-hosted-installed`
				, profiles: [profile], shapes: ["host-null"]
				, positions: hostNullPhpPromotionPositions, path
				, scope: `${path === "ordinary-source" ? "Compiler-authenticated Lean source" : "Independently reviewed Binding IR"} HostNull packages preserve explicit host null and direct payloads across all copied and synchronous callback positions in ${profile}. ${reference.scope}`
				, hostTypes: { "host-null": Object.fromEntries(
					hostNullPhpPromotionPositions.map(position => [
						position, hostType
					])
				) }
				, stages: Object.fromEntries(proposed.stages.map(stage => [stage, {
					state: "passed", evidence: [reference.id], note: notes[stage]
				}]))
				, limitations: [
					"Only the exact declared HostNull wrapper, two author routes and five synchronous value positions are promoted."
					, "Owned, asynchronous, generic and dependent-refinement HostNull combinations remain separate work."
					, ...reference.limitations
				]
				, conversionNotes: {
					"host-null": "The null constructor maps to PHP null and the value constructor maps directly to T. Option uses generated None and Some classes, so HostNull (Option T) remains distinct from Option (HostNull T)."
				}
			});
		}
	}
	const changed = typeSurfaceCells(proposed, contracts).filter(cell =>
		JSON.stringify(cell) !== JSON.stringify(before.get(cell.id)));
	assert.deepEqual(changed.map(cell => cell.id).sort(), [...target].sort());
	for(const cell of changed)
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			assert.deepEqual(stage.evidence
				, [evidenceId(cell.profile)], cell.id);
		}
	return proposed;
};
