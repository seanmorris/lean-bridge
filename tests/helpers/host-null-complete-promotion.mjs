/**
 * Promote exactly the complete 170-cell HostNull matrix authenticated by one
 * same-run hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import {
	hostNullCompleteHostedEvidence
	, checkHostNullCompleteHostedEvidence
} from "./host-null-complete-hosted-evidence.mjs";
import {
	hostNullCompleteHostedLanes, hostNullCompletePositions
	, hostNullCompleteProfiles
} from "./host-null-complete-hosted-archive.mjs";

export const hostNullCompletePromotionEvidenceId
	= "hosted-host-null-complete-installed";
export const hostNullCompletePromotionPaths = Object.freeze([
	"ordinary-source", "reviewed-ir"
]);
export const hostNullCompletePromotionPositions = hostNullCompletePositions;
export const hostNullCompletePromotionProfiles = hostNullCompleteProfiles;
export const hostNullCompletePromotionCells = Object.freeze(
	hostNullCompletePromotionProfiles.flatMap(profile =>
		hostNullCompletePromotionPaths.flatMap(path =>
			hostNullCompletePromotionPositions.map(position =>
				`${profile}/host-null/${path}/${position}`)))
);
assert.equal(hostNullCompletePromotionCells.length, 170);
assert.equal(new Set(hostNullCompletePromotionCells).size, 170);

const group = (id, profiles, hostType) => Object.freeze({
	id, profiles: Object.freeze(profiles), hostType
});
export const hostNullCompletePromotionGroups = Object.freeze([
	group("javascript-browser", hostNullCompleteHostedLanes[0].profiles
		, "null or T; Option remains a separately tagged none/some value")
	, group("php", ["php-native", "php-wasm"]
		, "null or T; Option remains generated None/Some")
	, group("dotnet", ["dotnet"]
		, "nullable T; Option<T> remains explicit None/Some")
	, group("jvm", ["java", "kotlin"]
		, "boxed @Nullable T or Kotlin T?; Option<T> remains explicit None/Some")
	, group("perl", ["perl"]
		, "undef or T; Option remains generated None/Some")
	, group("python", ["python"]
		, "None or T; Option remains generated None_/Some")
	, group("ruby", ["ruby"]
		, "nil or T; Option remains generated None_/Some")
	, group("c", ["c"]
		, "typed { has_value, value } carrier; Option remains a separate nested carrier")
	, group("cpp", ["cpp"]
		, "std::optional<T>; source HostNull and Option remain separate nested layers")
	, group("rust", ["rust"]
		, "Option<T>; source HostNull and Option remain separate nested layers")
	, group("wit-wasi", ["wit-wasi"]
		, "WIT option<T>; source HostNull and Option remain separate nested layers")
]);
assert.deepEqual(hostNullCompletePromotionGroups.flatMap(item => item.profiles)
	, hostNullCompletePromotionProfiles);

const referencePaths = Object.freeze([
	".github/workflows/host-null-complete.yml"
	, `${hostNullCompleteHostedEvidence}/index.json`
	, "scripts/archive-host-null-complete-evidence.mjs"
	, "scripts/download-host-null-complete-inputs.mjs"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-host-null-complete.mjs"
	, "tests/helpers/host-null-complete-hosted-archive.mjs"
	, "tests/helpers/host-null-complete-hosted-evidence.mjs"
	, "tests/helpers/host-null-complete-ci-tests.mjs"
	, "tests/helpers/host-null-complete-documentation.mjs"
	, "tests/helpers/host-null-complete-documentation-tests.mjs"
	, "tests/helpers/host-null-complete-promotion.mjs"
	, "tests/helpers/host-null-complete-promotion-tests.mjs"
	, "tests/helpers/host-null-complete-promotion-transaction-tests.mjs"
]);

/** Authenticate the complete archive and describe its type-surface evidence. */
export const hostNullCompletePromotionReference = async () => {
	const checked = await checkHostNullCompleteHostedEvidence();
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.cells.length, 170);
	assert.equal(checked.captures.length, 7);
	return Object.freeze({
		id: hostNullCompletePromotionEvidenceId
		, revision: checked.producerCommit
		, command: "node --test --test-concurrency=1 tests/host-null-complete-hosted-evidence.test.mjs"
		, scope: "One same-revision hosted run executes source-free installed HostNull packages for all seventeen profiles, both compiler-authenticated and independently reviewed author routes, and parameter, result, record-field, callback-parameter and callback-result positions."
		, files: await Promise.all(referencePaths.map(async path => ({
			path, sha256: sha256(await readFile(path))
		})))
		, artifacts: Object.freeze(checked.captures.map(capture => ({
			path: `${capture.hostedRun.artifact.name}.zip`
			, sha256: capture.hostedRun.artifact.sha256
		})))
		, limitations: checked.limitations
	});
};

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label
);
const notes = Object.freeze({
	analysis: "Fresh Lean metadata authenticates the exact unary HostNull wrapper and its two constructors; independently reviewed Binding IR reconciles with the same public contract."
	, generation: "Each target generator selects its declared native nullable carrier while keeping Option, Unit and omitted/default arguments separate."
	, compilation: "The copied ABI retains a distinct HostNull tag and rejects malformed or unrepresentable payloads before Lean entry."
	, packaging: "Both author routes produce receipt-closed prepared packages that install offline, relocate, and execute after source, build and handoff directories are removed."
	, installedExecution: "Hosted consumers execute null and non-null values, both nested Option orders, record fields, both callable directions, rejection and recovery through the installed public API."
});

/**
 * Add one evidence entry and 22 route/family observations, changing only the
 * exact 170 HostNull cells.
 *
 * @param inventory - Current type-surface inventory.
 * @param contracts - Binding IR schema and consumer contract.
 * @param reference - Authenticated complete hosted reference.
 */
export const promoteHostNullComplete = (
	inventory, contracts, reference
) => {
	exactKeys(reference, [
		"artifacts", "command", "files", "id", "limitations", "revision"
		, "scope"
	], "HostNull complete reference");
	assert.equal(reference.id, hostNullCompletePromotionEvidenceId);
	assert.match(reference.revision, /^[a-f0-9]{40}$/u);
	assert.deepEqual(reference.files.map(item => item.path), referencePaths);
	assert.equal(new Set(reference.files.map(item => item.path)).size
		, reference.files.length);
	for(const file of reference.files)
	{
		exactKeys(file, ["path", "sha256"], "HostNull reference file");
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.equal(reference.artifacts.length, 7);
	assert.equal(new Set(reference.artifacts.map(item => item.path)).size, 7);
	for(const artifact of reference.artifacts)
	{
		exactKeys(artifact, ["path", "sha256"], "HostNull artifact");
		assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.deepEqual(reference.artifacts.map(item => item.path).sort()
		, hostNullCompleteHostedLanes.map(item =>
			`${item.artifactPrefix}-${reference.revision}.zip`).sort());
	assert.equal(reference.limitations.length, 6);
	assert.ok(reference.limitations.every(item => typeof item === "string"
		&& item.length > 0));
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
	const target = new Set(hostNullCompletePromotionCells);
	assert.equal(beforeCells.filter(cell => target.has(cell.id)).length, 170);
	for(const id of target)
		assert.equal(before.get(id).stages.installedExecution.state
			, "unreviewed", id);
	for(const selectedGroup of hostNullCompletePromotionGroups)
		for(const path of hostNullCompletePromotionPaths)
			proposed.observations.push({
				id: `host-null-complete-${selectedGroup.id}-${path}-hosted-installed`
				, profiles: selectedGroup.profiles, shapes: ["host-null"]
				, positions: hostNullCompletePromotionPositions, path
				, scope: `${path === "ordinary-source" ? "Compiler-authenticated Lean source" : "Independently reviewed Binding IR"} HostNull packages preserve explicit host null and direct payloads through every declared ${selectedGroup.id} value position.`
				, hostTypes: { "host-null": Object.fromEntries(
					hostNullCompletePromotionPositions.map(position => [
						position, selectedGroup.hostType
					])
				) }
				, stages: Object.fromEntries(proposed.stages.map(stage => [stage, {
					state: "passed", evidence: [reference.id], note: notes[stage]
				}]))
				, limitations: reference.limitations
				, conversionNotes: {
					"host-null": `${selectedGroup.hostType}. Only the declared HostNull null constructor uses the nullable branch; source Option, Unit, erased proofs and omitted/default arguments retain their own representations.`
				}
			});
	const afterCells = typeSurfaceCells(proposed, contracts);
	const changed = afterCells.filter(cell => JSON.stringify(cell)
		!== JSON.stringify(before.get(cell.id)));
	assert.deepEqual(changed.map(cell => cell.id).sort(), [...target].sort());
	for(const cell of changed)
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			assert.deepEqual(stage.evidence, [reference.id], cell.id);
		}
	return proposed;
};
