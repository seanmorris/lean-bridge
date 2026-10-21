/**
 * Promote only the zero-payload Java/Kotlin cells authenticated by hosted packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadJvmEvidence, zeroPayloadJvmEvidence
	, zeroPayloadJvmEvidenceSha256
} from "./zero-payload-checked-record-jvm-evidence.mjs";

export const zeroPayloadJvmPromotionParent
	= "c34c5fefbc93c5d7ad9a2dbdce9094cc2c64417f";
export const zeroPayloadJvmPromotionProfiles = Object.freeze(["java", "kotlin"]);
export const zeroPayloadJvmPromotionIds = Object.freeze([
	"zero-payload-jvm-ordinary-source-hosted-installed"
	, "zero-payload-jvm-reviewed-ir-hosted-installed"
	, "zero-payload-jvm-result-only-ordinary-source-hosted-installed"
	, "zero-payload-jvm-result-only-reviewed-ir-hosted-installed"
]);
export const zeroPayloadJvmPromotionConversion
	= "Proof-only Witness crosses as a nominal, non-null JVM object with no application payload: Java exposes a zero-component record and Kotlin a zero-property class. Token keeps its generated Unit member, plain empty Marker remains a distinct nominal type, Option presence stays explicit, arrays retain length and independent elements, and active or inactive Mark branches remain distinct. Full packages validate nullary checked constructors and exact rejection and recovery. Result-only packages project Lean-produced proof-erased values without input-constructor metadata.";
export const zeroPayloadJvmPromotionLimit
	= "Hosted zero-payload Java/Kotlin acceptance covers the retained Witness, Token, Marker, Option, Array and Mark fixtures at copied parameter and result sites in four ordinary/reviewed full/result-only Maven packages. It does not promote checked-record fields, callbacks, owned positions, other zero-payload shapes or another host. External Lean, Java, Kotlin and operating-system toolchains remain trusted recorded inputs.";
export const zeroPayloadJvmPromotionHostTypes = Object.freeze({
	java: Object.freeze({
		parameter: "Nominal zero-component Java Witness record; Token keeps its generated Unit component and Marker remains a distinct zero-component record"
		, result: "Nominal zero-component Java Witness result; Token keeps its generated Unit component and Marker remains a distinct zero-component record"
	})
	, kotlin: Object.freeze({
		parameter: "Nominal zero-property Kotlin Witness class; Token keeps its generated Unit property and Marker remains a distinct zero-property class"
		, result: "Nominal zero-property Kotlin Witness result; Token keeps its generated Unit property and Marker remains a distinct zero-property class"
	})
});

const indexPath = `${zeroPayloadJvmEvidence}/index.json`;
const revision = "a6173cade3bbe158baa1a5695e3e93e1037359b0";
const validators = Object.freeze([
	".github/workflows/zero-payload-checked-record-jvm.yml"
	, "scripts/check-zero-payload-checked-record-jvm-ci.mjs"
	, "scripts/run-zero-payload-checked-record-jvm-ci.sh"
	, "tests/helpers/zero-payload-checked-record-jvm-evidence.mjs"
]);
export const zeroPayloadJvmPromotionPinPaths = Object.freeze([
	"docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
]);
const referenceContract = Object.freeze([
	["ordinary-source", 1750
		, "307018595f3ed64bdadd6a29fd5149322512339346f960fe694627a7e8b88204"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0.jar", "2d7b487f6e4c6d49fe0fda4374635be42a2cfaba8de46dc57883b3938e980f10"], ["handoff/archives/zeropayloadcheckedrecords-1.0.0.pom", "172f14af8cc46515720e648199502776e36d904429e7535c138f37f1e0ce678e"]]]
	, ["reviewed-ir", 1752
		, "f72c0e81407c82a2e7d2425d57262cc38c98d186e03086df318d2ad78765dad7"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0.jar", "c4829a7f4238dc7fa30fc92a6c90e5d2375e2ab2bc100ed283c9a508dc909b85"], ["handoff/archives/zeropayloadcheckedrecords-1.0.0.pom", "172f14af8cc46515720e648199502776e36d904429e7535c138f37f1e0ce678e"]]]
	, ["result-only-ordinary-source", 1742
		, "9de5e5d2d749e28ed873e62ec0ac20cb5ec82820a188c5d4fff71042987c778d"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0.jar", "7b3813aa8260887a3770558e3299df200ad90cb46fcf6bb7c967ce86463a6fd1"], ["handoff/archives/zeropayloadcheckedrecords-1.0.0.pom", "172f14af8cc46515720e648199502776e36d904429e7535c138f37f1e0ce678e"]]]
	, ["result-only-reviewed-ir", 1744
		, "904baa5ac3c82bf78738341e44fd7d01c622390bb8729fff4e33f7b1a19b1eae"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0.jar", "daefcf2049b468690452828187f6defc51edf82ad7398b6500a3332fd5bb3d53"], ["handoff/archives/zeropayloadcheckedrecords-1.0.0.pom", "172f14af8cc46515720e648199502776e36d904429e7535c138f37f1e0ce678e"]]]
]);
const routePath = route => route.replace(/^result-only-/u, "");
const routeId = route => `zero-payload-jvm-${route}-hosted-installed`;
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
	assert.equal(index.hostedRun.runId, 39561655653);
	assert.equal(index.hostedRun.artifact.id, 12328792684);
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
			path: `${zeroPayloadJvmEvidence}/${file.path}`, sha256: file.sha256
		}));
		references.push({
			id: routeId(route), route, sourcePath: routePath(route)
			, mode: resultOnly ? "result-only" : "full"
			, profiles: [...zeroPayloadJvmPromotionProfiles]
			, positions: resultOnly ? ["result"] : ["parameter", "result"]
			, revision
			, command: "bash scripts/run-zero-payload-checked-record-jvm-ci.sh"
			, scope: `Hosted GitHub Actions run 39561655653 rebuilt the ${route} Java and Kotlin Maven package selection on Ubuntu 24.04. Two author roots reproduced the complete package before author removal, source-free offline installation and unchanged replay after physical relocation. ${resultOnly ? "The result-only package projects proof-erased Witness, Token, Marker, Option, Array and Mark values without checked-input metadata." : "The full package runs the selected nullary Witness constructor at every checked input, keeps rejected values unchanged, recovers on the next valid call and projects proof-erased Witness, Token, Marker, Option, Array and Mark results."} The retained archive authenticates every original artifact byte, route result, caller observation and exact producer, consumer, checker and archiver source closure. ${zeroPayloadJvmPromotionLimit}`
			, files: [{ path: indexPath, sha256: zeroPayloadJvmEvidenceSha256 }
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
export const zeroPayloadJvmPromotionReferences = async (read = readFile) => {
	if(read !== readFile)
		return referencesFromEvidence(await checkZeroPayloadJvmEvidence(read), read);
	cachedReferences ??= referencesFromEvidence(
		await checkZeroPayloadJvmEvidence(), readFile);
	return structuredClone(await cachedReferences);
};

/**
 * Advance the exact stale mutable source pointers exposed by this promotion.
 *
 * @param original - Exact inventory before reconciliation.
 */
export const reconcileZeroPayloadJvmPromotionPins = async original => {
	const inventory = structuredClone(original), digests = new Map();
	for(const path of zeroPayloadJvmPromotionPinPaths)
		digests.set(path, sha256(await readFile(path)));
	const seen = new Set();
	for(const evidence of inventory.evidence)
		for(const file of evidence.files)
			if(digests.has(file.path))
			{
				file.sha256 = digests.get(file.path);
				seen.add(file.path);
			}
	assert.deepEqual([...seen].sort(), [...zeroPayloadJvmPromotionPinPaths].sort());
	return inventory;
};

/**
 * Supplement exactly eight Java/Kotlin parameter/result cells.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated hosted selections.
 */
export const promoteZeroPayloadJvm = async (original, references) => {
	assert.deepEqual(references, await zeroPayloadJvmPromotionReferences());
	const inventory = await reconcileZeroPayloadJvmPromotionPins(original)
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
	for(const profile of zeroPayloadJvmPromotionProfiles)
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
				observation.scope += ` Additional hosted zero-payload Java/Kotlin acceptance: ${addition}`;
				observation.hostTypes["checked-record"][position] += `; ${zeroPayloadJvmPromotionHostTypes[profile][position]}`;
				observation.conversionNotes["checked-record"] += ` ${zeroPayloadJvmPromotionConversion}`;
				observation.limitations.push(zeroPayloadJvmPromotionLimit);
				for(const stage of Object.values(observation.stages))
				{
					assert.equal(stage.state, "passed");
					stage.evidence.push(...ids);
					assert.equal(stage.evidence.length, new Set(stage.evidence).size);
					stage.note += ` Additional hosted zero-payload Java/Kotlin acceptance: ${addition}`;
				}
				changed += 1;
			}
	assert.equal(changed, 8);
	return inventory;
};
