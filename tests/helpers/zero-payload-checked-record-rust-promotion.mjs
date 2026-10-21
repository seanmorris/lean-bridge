/**
 * Promote only the zero-payload Rust cells authenticated by hosted packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadRustEvidence, zeroPayloadRustEvidence
	, zeroPayloadRustEvidenceSha256
} from "./zero-payload-checked-record-rust-evidence.mjs";

export const zeroPayloadRustPromotionParent
	= "7e292652ee56efb8e201a52628385498ef2febf9";
export const zeroPayloadRustPromotionProfiles = Object.freeze(["rust"]);
export const zeroPayloadRustPromotionIds = Object.freeze([
	"zero-payload-rust-ordinary-source-hosted-installed"
	, "zero-payload-rust-reviewed-ir-hosted-installed"
	, "zero-payload-rust-result-only-ordinary-source-hosted-installed"
	, "zero-payload-rust-result-only-reviewed-ir-hosted-installed"
]);
export const zeroPayloadRustPromotionConversion
	= "Proof-only Witness crosses as a nominal empty Rust struct with no application payload. Token keeps its generated Unit field, plain empty Marker remains a distinct nominal struct, Option presence stays explicit, vectors retain length and independent elements, and active or inactive Mark branches remain distinct. Full crates validate nullary checked constructors and exact rejection and recovery. Result-only crates project Lean-produced proof-erased values without input-constructor metadata.";
export const zeroPayloadRustPromotionLimit
	= "Hosted zero-payload Rust acceptance covers the retained Witness, Token, Marker, Option, Array and Mark fixtures at copied parameter and result sites in four ordinary/reviewed full/result-only Cargo crates. It does not promote checked-record fields, callbacks, owned positions, other zero-payload shapes or another host. External Lean, Rust, Cargo and operating-system toolchains remain trusted recorded inputs.";
export const zeroPayloadRustPromotionHostTypes = Object.freeze({
	rust: Object.freeze({
		parameter: "Nominal empty Rust Witness struct; Token keeps its generated Unit field and Marker remains a distinct empty struct"
		, result: "Nominal empty Rust Witness result struct; Token keeps its generated Unit field and Marker remains a distinct empty struct"
	})
});

const indexPath = `${zeroPayloadRustEvidence}/index.json`;
const revision = "a6173cade3bbe158baa1a5695e3e93e1037359b0";
const validators = Object.freeze([
	".github/workflows/zero-payload-checked-record-rust.yml"
	, "scripts/check-zero-payload-checked-record-rust-ci.mjs"
	, "scripts/run-zero-payload-checked-record-rust-ci.sh"
	, "tests/helpers/zero-payload-checked-record-rust-evidence.mjs"
]);
export const zeroPayloadRustPromotionPinPaths = Object.freeze([
	"docs/consume/rust.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, "tests/native-fin-containers.test.mjs"
]);
const referenceContract = Object.freeze([
	["ordinary-source", 1774
		, "82ad867883095c31583865e56aef0b8ba2bc35066e3ddc84f60d42f8dbb5a1ef"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0.crate", "57aa20d2dd20dfc491f59f696905a3dfc6056aef54f9c52a0976ea9be9f90c4f"]]]
	, ["reviewed-ir", 1776
		, "1d8ad73aefe8cc3a01896ddd4751c90716b630b6f7f98d1b5bdcd3085f6b954e"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0.crate", "2d288399749840366819d28f98bcee54b649499992cb7d49bba9b0547e5d5986"]]]
	, ["result-only-ordinary-source", 1774
		, "1a83cbebbb3ef27e16a4c3cd75a06f15993cd7f56d6741107efcfad1013e2dc3"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0.crate", "db73291f3afa6e6fa8b6ff3a857ae44a3e97f459a710b61b510e717b20024c18"]]]
	, ["result-only-reviewed-ir", 1776
		, "094ea5482c832c07ad0a19733236988ef287d4caa0a1fb8bcb6cc4b31a712d2a"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0.crate", "3014933976596f49a85f532d7079040e1f63eb4c003c8c4cc73bf9e39be3a8f8"]]]
]);
const routePath = route => route.replace(/^result-only-/u, "");
const routeId = route => `zero-payload-rust-${route}-hosted-installed`;
const parse = bytes => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value));
	return value;
};

const referencesFromEvidence = async (checked, read) => {
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.deepEqual([
		checked.producer, checked.consumer, checked.checker, checked.archiver
	], [revision, revision, revision, revision]);
	const index = parse(Buffer.from(await read(indexPath)));
	assert.equal(index.hostedRun.runId, 39561655967);
	assert.equal(index.hostedRun.artifact.id, 12329518106);
	const references = [];
	for(const [route, count, filesSha256, expectedArtifacts] of referenceContract)
	{
		const run = index.runs.find(item => item.route === route);
		assert.ok(run, route);
		const files = index.files.filter(file => file.path.startsWith(`${route}/`)
			|| file.path.startsWith("sources/") || file.path.startsWith("hosted/"));
		assert.equal(files.length, count, route);
		assert.equal(sha256(JSON.stringify(files)), filesSha256, route);
		const artifacts = files.filter(file => file.path.startsWith(
			`${route}/records/handoff/archives/`)).map(file => ({
			path: file.path.slice(`${route}/records/`.length), sha256: file.sha256
			}));
		assert.deepEqual(artifacts.map(item => [item.path, item.sha256])
			, expectedArtifacts, route);
		const resultOnly = route.startsWith("result-only-");
		const evidenceFiles = files.map(file => ({
			path: `${zeroPayloadRustEvidence}/${file.path}`, sha256: file.sha256
		}));
		references.push({
			id: routeId(route), route, sourcePath: routePath(route)
			, mode: resultOnly ? "result-only" : "full"
			, profiles: [...zeroPayloadRustPromotionProfiles]
			, positions: resultOnly ? ["result"] : ["parameter", "result"]
			, revision
			, command: "bash scripts/run-zero-payload-checked-record-rust-ci.sh"
			, scope: `Hosted GitHub Actions run 39561655967 rebuilt the ${route} Rust Cargo crate selection on Ubuntu 24.04. Two author roots reproduced the complete crate before author removal, source-free offline installation from retained dependencies and unchanged replay after physical relocation. ${resultOnly ? "The result-only crate projects proof-erased Witness, Token, Marker, Option, Array and Mark values without checked-input metadata." : "The full crate runs the selected nullary Witness constructor at every checked input, keeps rejected values unchanged, recovers on the next valid call and projects proof-erased Witness, Token, Marker, Option, Array and Mark results."} The retained archive authenticates every original artifact byte, route result, caller observation and exact producer, consumer, checker and archiver source closure. ${zeroPayloadRustPromotionLimit}`
			, files: [{ path: indexPath, sha256: zeroPayloadRustEvidenceSha256 }
				, ...evidenceFiles]
			, artifacts
		});
	}
	return references;
};

let cachedReferences;

/**
 * Authenticate retained hosted evidence and derive four exact references.
 *
 * @param read - Repository-relative evidence reader.
 */
export const zeroPayloadRustPromotionReferences = async (read = readFile) => {
	if(read !== readFile)
		return referencesFromEvidence(await checkZeroPayloadRustEvidence(read), read);
	cachedReferences ??= referencesFromEvidence(
		await checkZeroPayloadRustEvidence(), readFile);
	return structuredClone(await cachedReferences);
};

/**
 * Advance the exact stale mutable source pointers exposed by this promotion.
 *
 * @param original - Exact inventory before reconciliation.
 */
export const reconcileZeroPayloadRustPromotionPins = async original => {
	const inventory = structuredClone(original), digests = new Map();
	for(const path of zeroPayloadRustPromotionPinPaths)
		digests.set(path, sha256(await readFile(path)));
	const seen = new Set();
	for(const evidence of inventory.evidence)
		for(const file of evidence.files)
			if(digests.has(file.path))
			{
				file.sha256 = digests.get(file.path);
				seen.add(file.path);
			}
	assert.deepEqual([...seen].sort()
		, [...zeroPayloadRustPromotionPinPaths].sort());
	return inventory;
};

/**
 * Supplement exactly four Rust parameter/result cells.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated hosted selections.
 */
export const promoteZeroPayloadRust = async (original, references) => {
	assert.deepEqual(references, await zeroPayloadRustPromotionReferences());
	const inventory = await reconcileZeroPayloadRustPromotionPins(original)
		, validatorFiles = [];
	for(const path of validators)
		validatorFiles.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, `Already promoted: ${reference.id}`);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...validatorFiles, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({
				...item, path: `${reference.id}/${item.path}`
			}))
		});
	}
	let changed = 0;
	for(const profile of zeroPayloadRustPromotionProfiles)
		for(const path of ["ordinary-source", "reviewed-ir"])
			for(const position of ["parameter", "result"])
			{
				const matches = inventory.observations.filter(item =>
					item.profiles.includes(profile) && item.path === path
					&& item.shapes.includes("checked-record")
					&& item.positions.includes(position));
				assert.equal(matches.length, 1
					, `Missing or overlapping cell: ${profile}/${path}/${position}`);
				const observation = matches[0];
				const selected = references.filter(item => item.sourcePath === path
					&& item.positions.includes(position));
				assert.equal(selected.length, position === "result" ? 2 : 1);
				const ids = selected.map(item => item.id);
				const addition = selected.map(item => item.scope).join(" ");
				observation.scope += ` Additional hosted zero-payload Rust acceptance: ${addition}`;
				observation.hostTypes["checked-record"][position] += `; ${zeroPayloadRustPromotionHostTypes[profile][position]}`;
				observation.conversionNotes["checked-record"] += ` ${zeroPayloadRustPromotionConversion}`;
				observation.limitations.push(zeroPayloadRustPromotionLimit);
				for(const stage of Object.values(observation.stages))
				{
					assert.equal(stage.state, "passed");
					stage.evidence.push(...ids);
					assert.equal(stage.evidence.length, new Set(stage.evidence).size);
					stage.note += ` Additional hosted zero-payload Rust acceptance: ${addition}`;
				}
				changed += 1;
			}
	assert.equal(changed, 4);
	return inventory;
};
