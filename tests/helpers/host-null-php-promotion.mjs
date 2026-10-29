/**
 * Promote only the 20 native PHP and PHP-Wasm HostNull cells established by
 * their independently retained installed-package archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { checkHostNullPhpEvidence } from "./host-null-php-evidence.mjs";
import { hostNullPhpHostedPolicy } from "./host-null-php-hosted-policy.mjs";

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

const referencePaths = Object.freeze([
	"scripts/archive-host-null-php-evidence.mjs"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-host-null-php.mjs"
	, "tests/helpers/host-null-php-evidence.mjs"
	, "tests/helpers/host-null-php-hosted-evidence-sources.mjs"
	, "tests/helpers/host-null-php-hosted-policy.mjs"
	, "tests/helpers/host-null-php-promotion.mjs"
	, "tests/helpers/host-null-php-promotion-tests.mjs"
	, "tests/helpers/host-null-php-report.mjs"
]);

/** Authenticate both hosted archives and describe their evidence entries. */
export const hostNullPhpPromotionReferences = async () => Promise.all(
	hostNullPhpPromotionProfiles.map(async profile => {
		const checked = await checkHostNullPhpEvidence(profile);
		const policy = hostNullPhpHostedPolicy(profile);
		assert.equal(checked.hostedAcceptance, true);
		assert.equal(checked.supportPromoted, false);
		return Object.freeze({
			id: evidenceId(profile), profile, revision: checked.producer
			, command: `LEAN_BRIDGE_HOST_NULL_PACKAGE_DIR=build/host-null/packages/${profile} ${profile === "php-native" ? "LEAN_BRIDGE_PHP_HOST_NULL_TEST=1 node --test --test-concurrency=1 tests/php-host-null.test.mjs" : "LEAN_BRIDGE_PHP_WASM_HOST_NULL_TEST=1 node --test --test-concurrency=1 tests/php-wasm-host-null.test.mjs"}`
			, scope: `Hosted ${profile} installed-package acceptance verifies ordinary-source and independently reviewed HostNull packages through five value positions, both Option nestings, refusals and recovery across ${checked.accepted.executions} executions.`
			, files: [
				{
					path: `${policy.evidence}/index.json`
					, sha256: sha256(await readFile(
						`${policy.evidence}/index.json`))
				}
				, ...await Promise.all(referencePaths.map(async path => ({
					path, sha256: sha256(await readFile(path))
				})))
			]
			, artifacts: Object.freeze([{
				path: `${checked.hostedRun.artifact.name}.zip`
				, sha256: checked.hostedRun.artifact.sha256
			}])
			, limitations: checked.limitations
		});
	})
);

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
