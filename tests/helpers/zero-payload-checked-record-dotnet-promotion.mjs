/**
 * Promote only the zero-payload .NET cells authenticated by hosted packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadDotnetEvidence, zeroPayloadDotnetEvidence
	, zeroPayloadDotnetEvidenceSha256
} from "./zero-payload-checked-record-dotnet-evidence.mjs";

export const zeroPayloadDotnetPromotionParent
	= "0f71a0fd939172d767c96743ca59e203f075943c";
export const zeroPayloadDotnetPromotionProfiles = Object.freeze(["dotnet"]);
export const zeroPayloadDotnetPromotionIds = Object.freeze([
	"zero-payload-dotnet-ordinary-source-hosted-installed"
	, "zero-payload-dotnet-reviewed-ir-hosted-installed"
	, "zero-payload-dotnet-result-only-ordinary-source-hosted-installed"
	, "zero-payload-dotnet-result-only-reviewed-ir-hosted-installed"
]);
export const zeroPayloadDotnetPromotionConversion
	= "Proof-only Witness crosses as a nominal, non-null C# record with no application payload. Token keeps its generated Unit property, plain empty Marker remains a distinct nominal record, Option presence stays explicit, arrays retain length and independent elements, and active or inactive Mark branches remain distinct. Full packages validate nullary checked constructors and exact rejection and recovery. Result-only packages project Lean-produced proof-erased values without input-constructor metadata.";
export const zeroPayloadDotnetPromotionLimit
	= "Hosted zero-payload .NET acceptance covers the retained Witness, Token, Marker, Option, Array and Mark fixtures at copied parameter and result sites in four ordinary/reviewed full/result-only NuGet packages. It does not promote checked-record fields, callbacks, owned positions, other zero-payload shapes or another host. External Lean, .NET and operating-system toolchains remain trusted recorded inputs.";
export const zeroPayloadDotnetPromotionHostTypes = Object.freeze({
	dotnet: Object.freeze({
		parameter: "Nominal non-null zero-component C# Witness record; Token keeps its generated Unit property and Marker remains a distinct zero-component record"
		, result: "Nominal non-null zero-component C# Witness result; Token keeps its generated Unit property and Marker remains a distinct zero-component record"
	})
});

const indexPath = `${zeroPayloadDotnetEvidence}/index.json`;
const revision = "a6173cade3bbe158baa1a5695e3e93e1037359b0";
const validators = Object.freeze([
	".github/workflows/zero-payload-checked-record-dotnet.yml"
	, "scripts/check-zero-payload-checked-record-dotnet-ci.mjs"
	, "scripts/run-zero-payload-checked-record-dotnet-ci.sh"
	, "tests/helpers/zero-payload-checked-record-dotnet-evidence.mjs"
]);
export const zeroPayloadDotnetPromotionPinPaths = Object.freeze([
	"docs/consume/dotnet.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
]);
const referenceContract = Object.freeze([
	["ordinary-source", 1690
		, "11a0e867e987e8300e2821b8bfad1ec658b8cfab94836bb8376a4a9b99f9fd25"
		, [["handoff/archives/Zeropayloadcheckedrecords.Api.1.0.0.nupkg", "8b1e4e2a15d6de5f80c67936b15982fd4bc050e2ee05fb4ff81e60b222389d4d"]]]
	, ["reviewed-ir", 1692
		, "829a997300e479cfff8b83b9dd16c5ae00a2de3b8c42636e3a6cc1090990a433"
		, [["handoff/archives/Zeropayloadcheckedrecords.Api.1.0.0.nupkg", "4f5e9257228408a122c36823c747d5e50920bd86a104890ac9f4343d92527528"]]]
	, ["result-only-ordinary-source", 1690
		, "b9d4bff084b3f39a1e85b088e205b8255f8c4b132de5fff2551e13fab9c9ae72"
		, [["handoff/archives/Zeropayloadcheckedrecords.Api.1.0.0.nupkg", "752ee3e9779459243b3b695353e6032568f50d2b55a07adf44be4ed466c78dc2"]]]
	, ["result-only-reviewed-ir", 1692
		, "f63b367013acd299b1dd83223a23beb783f5784d401d94d63898bb00f77367d0"
		, [["handoff/archives/Zeropayloadcheckedrecords.Api.1.0.0.nupkg", "093fd145927f14e8f92794e4d78d1eb816fbf529246c84a5dae721e0002a1191"]]]
]);
const routePath = route => route.replace(/^result-only-/u, "");
const routeId = route => `zero-payload-dotnet-${route}-hosted-installed`;
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
	], [revision, revision, revision
		, "45adeda636c236b1fb5bccf451266804bfe2ae4d"]);
	const index = parse(Buffer.from(await read(indexPath)));
	assert.equal(index.hostedRun.runId, 39561655735);
	assert.equal(index.hostedRun.artifact.id, 12329431983);
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
			path: `${zeroPayloadDotnetEvidence}/${file.path}`, sha256: file.sha256
		}));
		references.push({
			id: routeId(route), route, sourcePath: routePath(route)
			, mode: resultOnly ? "result-only" : "full"
			, profiles: [...zeroPayloadDotnetPromotionProfiles]
			, positions: resultOnly ? ["result"] : ["parameter", "result"]
			, revision
			, command: "bash scripts/run-zero-payload-checked-record-dotnet-ci.sh"
			, scope: `Hosted GitHub Actions run 39561655735 rebuilt the ${route} .NET NuGet package selection on Ubuntu 24.04. Two author roots reproduced the complete package before author removal, source-free offline installation and unchanged replay after physical relocation. ${resultOnly ? "The result-only package projects proof-erased Witness, Token, Marker, Option, Array and Mark values without checked-input metadata." : "The full package runs the selected nullary Witness constructor at every checked input, keeps rejected values unchanged, recovers on the next valid call and projects proof-erased Witness, Token, Marker, Option, Array and Mark results."} The retained archive authenticates every original artifact byte, route result, caller observation and exact producer, consumer, checker and archiver source closure. ${zeroPayloadDotnetPromotionLimit}`
			, files: [{ path: indexPath, sha256: zeroPayloadDotnetEvidenceSha256 }
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
export const zeroPayloadDotnetPromotionReferences = async (read = readFile) => {
	if(read !== readFile)
		return referencesFromEvidence(await checkZeroPayloadDotnetEvidence(read), read);
	cachedReferences ??= referencesFromEvidence(
		await checkZeroPayloadDotnetEvidence(), readFile);
	return structuredClone(await cachedReferences);
};

/**
 * Advance the exact stale mutable source pointers exposed by this promotion.
 *
 * @param original - Exact inventory before reconciliation.
 */
export const reconcileZeroPayloadDotnetPromotionPins = async original => {
	const inventory = structuredClone(original), digests = new Map();
	for(const path of zeroPayloadDotnetPromotionPinPaths)
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
		, [...zeroPayloadDotnetPromotionPinPaths].sort());
	return inventory;
};

/**
 * Supplement exactly four .NET parameter/result cells.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated hosted selections.
 */
export const promoteZeroPayloadDotnet = async (original, references) => {
	assert.deepEqual(references, await zeroPayloadDotnetPromotionReferences());
	const inventory = await reconcileZeroPayloadDotnetPromotionPins(original)
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
	for(const profile of zeroPayloadDotnetPromotionProfiles)
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
				observation.scope += ` Additional hosted zero-payload .NET acceptance: ${addition}`;
				observation.hostTypes["checked-record"][position] += `; ${zeroPayloadDotnetPromotionHostTypes[profile][position]}`;
				observation.conversionNotes["checked-record"] += ` ${zeroPayloadDotnetPromotionConversion}`;
				observation.limitations.push(zeroPayloadDotnetPromotionLimit);
				for(const stage of Object.values(observation.stages))
				{
					assert.equal(stage.state, "passed");
					stage.evidence.push(...ids);
					assert.equal(stage.evidence.length, new Set(stage.evidence).size);
					stage.note += ` Additional hosted zero-payload .NET acceptance: ${addition}`;
				}
				changed += 1;
			}
	assert.equal(changed, 4);
	return inventory;
};
