/**
 * Bind the complete generic-Subtype hosted archive set to exactly the closed
 * concrete field cells that it executes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	genericSubtypeHostedContracts, genericSubtypeHostedLaneNames
} from "./generic-subtype-hosted-contracts.mjs";
import {
	checkGenericSubtypeHostedEvidence
} from "./generic-subtype-hosted-evidence.mjs";

export const genericSubtypePromotionPath
	= "docs/evidence/generic-subtype-promotion-20261023.md";
export const genericSubtypePromotionLimit
	= "The installed generic-Subtype matrix covers the closed GenericNat alias of GenericCarrier Nat, its Positive field, retained Nat marker, distinct plusOne and plusTwo per-specialization constructor choices, and constructor-free copied results. It does not expose open generic host types, arbitrary type arguments or predicates, generic Fin fields, PHP-Wasm, callbacks, ownership, recursive generic graphs, dispatch cost or peak memory. The dependent foundation separately checks retained Nat, Bool and String indices in compiler and reviewed contracts; it does not infer installed host coverage for those dependent shapes. External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs.";

const routes = Object.freeze(["ordinary", "reviewed"]);
const paths = Object.freeze(["ordinary-source", "reviewed-ir"]);
const foundationLane = "foundation";
const validators = Object.freeze([
	"scripts/archive-generic-subtype-evidence.mjs"
	, "scripts/promote-generic-subtype-evidence.mjs"
	, "tests/generic-subtype-native-perl.test.mjs"
	, "tests/helpers/generic-subtype-hosted-evidence.mjs"
	, "tests/helpers/generic-subtype-hosted-output.mjs"
	, "tests/helpers/generic-subtype-promotion.mjs"
]);
const evidenceId = lane => `generic-subtype-${lane}-hosted-installed`;
export const genericSubtypePromotionRoots = Object.freeze({
	"npm-ordinary": "docs/evidence/generic-subtype-npm-ordinary-hosted-20261023"
	, "npm-reviewed": "docs/evidence/generic-subtype-npm-reviewed-hosted-20261023"
	, foundation: "docs/evidence/generic-subtype-foundation-hosted-20261023"
	, native: "docs/evidence/generic-subtype-native-hosted-20261023"
	, perl: "docs/evidence/generic-subtype-perl-hosted-20261023"
	, python: "docs/evidence/generic-subtype-python-hosted-20261023"
	, ruby: "docs/evidence/generic-subtype-ruby-hosted-20261023"
	, rust: "docs/evidence/generic-subtype-rust-hosted-20261023"
	, dotnet: "docs/evidence/generic-subtype-dotnet-hosted-20261024"
	, jvm: "docs/evidence/generic-subtype-jvm-hosted-20261024"
	, "php-native": "docs/evidence/generic-subtype-php-native-hosted-20261024"
	, "wit-wasi": "docs/evidence/generic-subtype-wit-wasi-hosted-20261024"
});
assert.deepEqual(Object.keys(genericSubtypePromotionRoots)
	, genericSubtypeHostedLaneNames);
const hostedRoot = lane => genericSubtypePromotionRoots[lane];

const groups = Object.freeze([
	{ prefix: "nominal-subtype-npm-fields"
		, profiles: ["node-javascript", "node-typescript"]
		, lane: route => `npm-${route}` }
	, { prefix: "nominal-subtype-browser-fields"
		, profiles: ["browser-javascript", "browser-react", "browser-worker"]
		, lane: route => `npm-${route}` }
	, { prefix: "nominal-subtype-native-fields"
		, profiles: ["c", "cpp"], lane: () => "native" }
	, { prefix: "nominal-subtype-perl-fields"
		, profiles: ["perl"], lane: () => "perl" }
	, { prefix: "nominal-subtype-python-fields"
		, profiles: ["python"], lane: () => "python" }
	, { prefix: "nominal-subtype-ruby-fields"
		, profiles: ["ruby"], lane: () => "ruby" }
	, { prefix: "nominal-subtype-rust-fields"
		, profiles: ["rust"], lane: () => "rust" }
	, { prefix: "nominal-subtype-dotnet-fields"
		, profiles: ["dotnet"], lane: () => "dotnet" }
	, { prefix: "nominal-subtype-jvm-fields"
		, profiles: ["java", "kotlin"], lane: () => "jvm" }
	, { prefix: "nominal-subtype-php-fields"
		, profiles: ["php-native"], lane: () => "php-native" }
	, { prefix: "nominal-subtype-wit-fields"
		, profiles: ["wit-wasi"], lane: () => "wit-wasi" }
]);

const evidenceEntry = reference => Object.fromEntries(Object.entries(
	reference
).filter(([key]) => [
	"id", "kind", "revision", "command", "scope", "files", "artifacts"
].includes(key)));

const appendUnique = (values, additions) => {
	const next = [...values, ...additions];
	assert.equal(new Set(next).size, next.length);
	return next;
};

const validateReference = reference => {
	const contract = genericSubtypeHostedContracts[reference.lane];
	assert.ok(contract, reference.lane);
	assert.equal(reference.id, evidenceId(reference.lane));
	assert.deepEqual(reference.profiles, contract.profiles);
	assert.deepEqual(reference.routes, contract.routes);
	assert.equal(reference.kind
		, reference.lane === foundationLane ? "test" : "installed");
	assert.match(reference.revision, /^[a-f0-9]{40}$/u);
	assert.ok(reference.files.length > 0 && reference.artifacts.length > 0);
};

/**
 * Replay every immutable hosted archive and derive exact inventory references.
 *
 * @param check - Archive replay function, injectable for focused tests.
 * @param read - Byte reader, injectable for focused tests.
 */
export const genericSubtypePromotionReferences = async (
	check = checkGenericSubtypeHostedEvidence
	, read = readFile
) => {
	const references = [];
	// Each replay reconstructs a complete ZIP and source closure. Keep them serial.
	for(const lane of genericSubtypeHostedLaneNames)
	{
		const contract = genericSubtypeHostedContracts[lane];
		const root = hostedRoot(lane);
		const index = await check(lane, root);
		assert.equal(index.lane, lane);
		assert.deepEqual(index.profiles, contract.profiles);
		assert.deepEqual(index.routes, contract.routes);
		assert.deepEqual(index.accepted.profiles, contract.profiles);
		assert.deepEqual(index.accepted.routes, contract.routes);
		const indexPath = `${root}/index.json`;
		const files = [
			{ path: indexPath, sha256: sha256(await read(indexPath)) }
			, ...index.files.map(file => ({
				path: `${root}/${file.path}`, sha256: file.sha256
			}))
			, ...await Promise.all(validators.map(async path => ({
				path, sha256: sha256(await read(path))
			})))
		];
		assert.equal(new Set(files.map(file => file.path)).size, files.length);
		const artifacts = index.hostedRun.artifact.parts.map(part => ({
			path: `${root}/${part.path}`, sha256: part.sha256
		}));
		const reference = {
			lane, profiles: [...contract.profiles], routes: [...contract.routes]
			, id: evidenceId(lane)
			, kind: lane === foundationLane ? "test" : "installed"
			, revision: index.producerCommit
			, command: "node --test --test-name-pattern='^retained generic Subtype archives replay for promotion$' tests/generic-subtype-native-perl.test.mjs"
			, scope: `GitHub Actions run ${index.hostedRun.runId}, job ${index.hostedRun.job.id}, artifact ${index.hostedRun.artifact.id} retains and independently replays the ${lane} generic-Subtype contract. ${index.limitations.join(" ")}`
			, files, artifacts
		};
		validateReference(reference);
		references.push(reference);
	}
	return references;
};

/**
 * Promote exactly the thirty-two non-PHP-Wasm closed generic-Subtype field
 * cells without claiming an open generic host type.
 *
 * @param original - Type surface before generic-Subtype promotion.
 * @param references - Twelve authenticated hosted archive references.
 */
export const promoteGenericSubtypes = (original, references) => {
	assert.deepEqual(references.map(reference => reference.lane)
		, genericSubtypeHostedLaneNames);
	for(const reference of references) validateReference(reference);
	const inventory = structuredClone(original);
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, `Already promoted: ${reference.id}`);
		inventory.evidence.push(evidenceEntry(reference));
	}
	const foundation = references.find(reference =>
		reference.lane === foundationLane);
	assert.ok(foundation);
	for(const group of groups)
	{
		for(const [index, path] of paths.entries())
		{
			const route = routes[index], lane = group.lane(route);
			const hosted = references.find(reference => reference.lane === lane);
			assert.ok(hosted, lane);
			const observation = inventory.observations.find(item =>
				item.id === `${group.prefix}-${path}`);
			assert.ok(observation, `${group.prefix}-${path}`);
			assert.deepEqual(observation.profiles, group.profiles);
			assert.deepEqual(observation.shapes, ["subtype"]);
			assert.deepEqual(observation.positions, ["field"]);
			assert.equal(observation.path, path);
			const ids = [foundation.id, hosted.id];
			const note = `The ${lane} archive executes the closed GenericNat specialization on ${hosted.profiles.join(", ")} through the ${route} author route; the foundation independently authenticates its generic instantiation and plusOne/plusTwo constructor authority.`;
			observation.scope += ` ${note}`;
			observation.hostTypes.subtype.field += "; the closed GenericNat record carries its proof-erased Positive value beside a retained Nat marker";
			observation.conversionNotes.subtype += " GenericNat is the concrete GenericCarrier Nat alias: its value field crosses without a proof, each named specialization retains its selected plusOne or plusTwo constructor, and copied results carry no constructor.";
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed");
				stage.evidence = appendUnique(stage.evidence, ids);
				stage.note += ` ${note}`;
			}
			observation.limitations.push(genericSubtypePromotionLimit);
		}
	}
	return inventory;
};

/**
 * Render the exact human-readable promotion boundary.
 *
 * @param references - Twelve independently authenticated lane references.
 */
export const renderGenericSubtypePromotion = references => {
	assert.deepEqual(references.map(reference => reference.lane)
		, genericSubtypeHostedLaneNames);
	for(const reference of references) validateReference(reference);
	const rows = references.map(reference =>
		`| ${reference.lane} | ${reference.profiles.join(", ") || "compiler/review foundation"} | ${reference.routes.join(", ")} | [archive index](${hostedRoot(reference.lane).slice("docs/evidence/".length)}/index.json) | \`${reference.revision}\` |`
	);
	return `# Closed generic Subtype compositions

Twelve immutable hosted archives establish one closed \`GenericCarrier Nat\` alias with a selected \`Positive\` field across all sixteen non-PHP-Wasm consumer profiles. Ordinary Lean source and independently reviewed Binding IR retain the alias provenance, synthesized instance decisions and distinct \`plusOne\` and \`plusTwo\` constructors of the two named specializations.

| Evidence lane | Consumer profiles | Author routes | Retained evidence | Producer revision |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

The support inventory refines exactly 32 existing cells: sixteen profiles, two author routes and the Subtype field position. Installed consumers pass a concrete \`GenericNat\` record containing the proof-erased value and retained Nat marker. Rejection preserves the caller record, a later valid call succeeds, and copied results carry no constructor.

This promotion does not expose an open generic host type and does not cover arbitrary type arguments or predicates, generic Fin fields, PHP-Wasm, callbacks, ownership, recursive generic graphs, dispatch cost or peak memory. The dependent foundation checks retained Nat, Bool and String indices only in compiler and reviewed contracts; installed dependent host coverage remains separately scoped. External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs.
`;
};
