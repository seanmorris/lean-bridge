/**
 * Promote exactly the complete 34-cell optional-parameter matrix.
 *
 * This module deliberately accepts an already authenticated hosted reference;
 * archive verification remains a separate prerequisite.
 *
 * @file
 */
import assert from "node:assert/strict";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { optionalParameterProfiles }
	from "./optional-parameter-fixture.mjs";
import { optionalParameterMatrixLanes }
	from "./optional-parameter-matrix.mjs";

export const optionalParameterCompleteEvidenceId
	= "hosted-optional-parameter-complete-installed";
export const optionalParameterCompletePaths = Object.freeze([
	"ordinary-source", "reviewed-ir"
]);
export const optionalParameterCompleteProfiles = optionalParameterProfiles;
export const optionalParameterCompleteCells = Object.freeze(
	optionalParameterCompleteProfiles.flatMap(profile =>
		optionalParameterCompletePaths.map(path =>
			`${profile}/optional-parameter/${path}/signature`))
);
assert.equal(optionalParameterCompleteProfiles.length, 17);
assert.equal(new Set(optionalParameterCompleteProfiles).size, 17);
assert.equal(optionalParameterCompleteCells.length, 34);
assert.equal(new Set(optionalParameterCompleteCells).size, 34);

const group = (id, profiles, hostType) => Object.freeze({
	id, profiles: Object.freeze(profiles), hostType
});
export const optionalParameterCompleteGroups = Object.freeze([
	group("javascript-browser", [
		"node-javascript", "node-typescript", "browser-javascript"
		, "browser-react", "browser-worker"
	], "Optional argument with the Lean-declared default")
	, group("php", ["php-native", "php-wasm"]
		, "Omittable argument whose generated sentinel applies the Lean-declared default")
	, group("dotnet", ["dotnet"]
		, "Generated no-argument overload plus the full typed overload")
	, group("java", ["java"]
		, "Generated no-argument overload plus the full typed overload")
	, group("kotlin", ["kotlin"]
		, "Typed parameter with the Lean-declared Kotlin default")
	, group("perl", ["perl"]
		, "Optional positional argument distinguished by argument count")
	, group("python", ["python"]
		, "Typed parameter with the Lean-declared Python default")
	, group("ruby", ["ruby"]
		, "Typed parameter with the Lean-declared Ruby default")
	, group("c", ["c"]
		, "Generated arity-selection macro over a stable full-arity function")
	, group("cpp", ["cpp"]
		, "Typed C++ default argument over a stable full-arity function")
	, group("rust", ["rust"]
		, "Generated omission macro over a stable full-arity function")
	, group("wit-wasi", ["wit-wasi"]
		, "Named omission export beside the stable full-arity WIT function")
]);
assert.deepEqual(optionalParameterCompleteGroups.flatMap(item => item.profiles)
	.sort(), [...optionalParameterCompleteProfiles].sort());

export const optionalParameterCompleteReferencePaths = Object.freeze([
	".github/workflows/optional-parameter-complete.yml"
	, "docs/evidence/optional-parameter-hosted-20261029/index.json"
	, "scripts/archive-optional-parameter-hosted.mjs"
	, "scripts/download-optional-parameter-hosted-inputs.mjs"
	, "scripts/generate-reference-docs.mjs"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-optional-parameter-complete.mjs"
	, "tests/helpers/optional-parameter-complete-documentation.mjs"
	, "tests/helpers/optional-parameter-complete-documentation-tests.mjs"
	, "tests/helpers/optional-parameter-complete-ci-tests.mjs"
	, "tests/helpers/optional-parameter-complete-promotion.mjs"
	, "tests/helpers/optional-parameter-complete-promotion-tests.mjs"
	, "tests/helpers/optional-parameter-complete-promotion-transaction-tests.mjs"
	, "tests/helpers/optional-parameter-hosted-archive.mjs"
	, "tests/helpers/optional-parameter-hosted-archive-tests.mjs"
	, "tests/helpers/optional-parameter-hosted-evidence.mjs"
	, "tests/optional-parameter-complete-hosted-evidence.test.mjs"
	, "tests/optional-parameter-complete-promotion.test.mjs"
	, "tests/helpers/promotion-file-transaction.mjs"
	, "tests/helpers/type-surface-promotion-io.mjs"
]);

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label
);
const notes = Object.freeze({
	analysis: "Fresh Lean metadata authenticates each parameter type and declared default; independently reviewed Binding IR must reconcile to the same declaration."
	, generation: "The generated public API permits omission without changing the stable full-arity ABI or collapsing Option, Unit, host null and explicit values."
	, compilation: "Only an omitted argument selects the authenticated Lean default; every supplied value follows the ordinary checked conversion path."
	, packaging: "Both author routes produce receipt-closed packages that install offline, relocate and replay after source and build removal."
	, installedExecution: "Hosted installed consumers exercise omission, the explicit default, a nondefault value, Option.none, Unit, invalid host input, explicit host null and relocated replay."
});
const priorOwners = Object.freeze(new Map([
	["javascript-delivery", 5]
	, ["php-delivery", 2]
	, ["python-optional-rejection", 1]
	, ["rust-delivery-rejection", 1]
	, ["c-delivery-rejection", 1]
]));

const releasePriorOwners = (inventory, target) => {
	const reconciled = [], released = [];
	inventory.observations = inventory.observations.flatMap(observation => {
		if(!priorOwners.has(observation.id)) return [observation];
		assert.ok(observation.shapes.includes("optional-parameter")
			, observation.id);
		const overlap = observation.profiles.flatMap(profile =>
			observation.positions.map(position =>
				`${profile}/optional-parameter/${observation.path}/${position}`))
			.filter(id => target.has(id));
		assert.equal(overlap.length, priorOwners.get(observation.id)
			, observation.id);
		reconciled.push(observation.id); released.push(...overlap);
		const shapes = observation.shapes.filter(shape =>
			shape !== "optional-parameter");
		if(shapes.length === 0) return [];
		const hostTypes = Object.fromEntries(Object.entries(observation.hostTypes)
			.filter(([shape]) => shape !== "optional-parameter"));
		const conversionNotes = Object.fromEntries(Object.entries(
			observation.conversionNotes ?? {}
		).filter(([shape]) => shape !== "optional-parameter"));
		return [{ ...observation, shapes, hostTypes
			, ...(observation.conversionNotes === undefined
				? {} : { conversionNotes }) }];
	});
	assert.deepEqual(reconciled.sort(), [...priorOwners.keys()].sort());
	assert.equal(released.length, 10);
	assert.equal(new Set(released).size, released.length);
};

/**
 * Add one complete hosted evidence entry and change exactly 34 signature cells.
 *
 * @param inventory - Current type-surface inventory.
 * @param contracts - Binding IR schema and consumer contract.
 * @param reference - Independently authenticated hosted evidence reference.
 */
export const promoteOptionalParameterComplete = (
	inventory, contracts, reference
) => {
	exactKeys(reference, [
		"artifacts", "command", "files", "id", "limitations", "revision"
		, "scope"
	], "optional-parameter complete reference");
	assert.equal(reference.id, optionalParameterCompleteEvidenceId);
	assert.match(reference.revision, /^[a-f0-9]{40}$/u);
	assert.deepEqual(reference.files.map(item => item.path)
		, optionalParameterCompleteReferencePaths);
	assert.equal(new Set(reference.files.map(item => item.path)).size
		, reference.files.length);
	for(const file of reference.files)
	{
		exactKeys(file, ["path", "sha256"], "optional reference file");
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
	}
	const expectedArtifacts = [
		...optionalParameterMatrixLanes.map(lane =>
			`${lane.artifactPrefix}-${reference.revision}.zip`)
		, `optional-parameter-matrix-${reference.revision}.zip`
	].sort();
	assert.equal(reference.artifacts.length, 11);
	assert.equal(new Set(reference.artifacts.map(item => item.path)).size, 11);
	for(const artifact of reference.artifacts)
	{
		exactKeys(artifact, ["path", "sha256"], "optional artifact");
		assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.deepEqual(reference.artifacts.map(item => item.path).sort()
		, expectedArtifacts);
	assert.equal(reference.limitations.length, 4);
	assert.ok(reference.limitations.every(item => typeof item === "string"
		&& item.length > 0));
	assert.ok(!inventory.evidence.some(item => item.id === reference.id));

	const beforeCells = typeSurfaceCells(inventory, contracts);
	const before = new Map(beforeCells.map(cell => [cell.id, cell]));
	const target = new Set(optionalParameterCompleteCells);
	assert.equal(beforeCells.filter(cell => target.has(cell.id)).length, 34);
	for(const id of target)
		assert.notEqual(before.get(id).stages.installedExecution.state
			, "passed", id);

	const proposed = structuredClone(inventory);
	releasePriorOwners(proposed, target);
	typeSurfaceCells(proposed, contracts);
	proposed.evidence.push({
		id: reference.id, kind: "installed", revision: reference.revision
		, command: reference.command, scope: reference.scope
		, files: reference.files
		, artifacts: reference.artifacts.map(artifact => ({
			...artifact, path: `${reference.id}/${artifact.path}`
		}))
	});
	for(const selectedGroup of optionalParameterCompleteGroups)
		for(const path of optionalParameterCompletePaths)
			proposed.observations.push({
				id: `optional-parameter-complete-${selectedGroup.id}-${path}`
				, profiles: selectedGroup.profiles
				, shapes: ["optional-parameter"], positions: ["signature"], path
				, scope: `${path === "ordinary-source"
					? "Compiler-authenticated Lean source"
					: "Independently reviewed Binding IR"} packages expose omission through the idiomatic ${selectedGroup.id} API while preserving the declared default and full-arity call.`
				, hostTypes: { "optional-parameter": {
					signature: selectedGroup.hostType
				} }
				, stages: Object.fromEntries(proposed.stages.map(stage => [stage, {
					state: "passed", evidence: [reference.id], note: notes[stage]
				}]))
				, limitations: reference.limitations
				, conversionNotes: {
					"optional-parameter": "Omit the argument to select the authenticated Lean default. Supplying the default explicitly remains a supplied value; Option.none, Unit and explicit host null keep their own representations and validation."
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
