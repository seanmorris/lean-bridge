/**
 * Promote only the zero-payload C/C++ cells authenticated by hosted packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkZeroPayloadNativeEvidence, zeroPayloadNativeEvidence
	, zeroPayloadNativeEvidenceSha256
} from "./zero-payload-checked-record-native-evidence.mjs";

export const zeroPayloadNativePromotionParent
	= "54e040d40391ddb8e23b9764c1a75765abb0f458";
export const zeroPayloadNativePromotionProfiles = Object.freeze(["c", "cpp"]);
export const zeroPayloadNativePromotionIds = Object.freeze([
	"zero-payload-native-ordinary-source-hosted-installed"
	, "zero-payload-native-reviewed-ir-hosted-installed"
	, "zero-payload-native-result-only-ordinary-source-hosted-installed"
	, "zero-payload-native-result-only-reviewed-ir-hosted-installed"
]);
export const zeroPayloadNativePromotionConversion
	= "Proof-only Witness crosses as a nominal empty carrier; C uses one non-semantic uint8_t storage byte solely to give the structure a legal nonzero size, while C++ uses an empty structure. Token keeps its Unit field, plain empty Marker remains an ordinary empty record, and Option presence, arrays, and the active or inactive Mark branches remain distinct. Full packages validate nullary checked constructors and exact rejection and recovery. Result-only packages project Lean-produced proof-erased values without input-constructor metadata.";
export const zeroPayloadNativePromotionLimit
	= "Hosted zero-payload C/C++ acceptance covers the retained Witness, Token, Marker, Option, Array and Mark fixtures at copied parameter and result sites in four ordinary/reviewed full/result-only packages. It does not promote checked-record fields, callbacks, owned positions, other zero-payload shapes or another host. External Lean, C/C++, GMP, Boost, linker and operating-system toolchains remain trusted recorded inputs.";
export const zeroPayloadNativePromotionHostTypes = Object.freeze({
	c: Object.freeze({
		parameter: "Generated C Witness carrier with one non-semantic uint8_t storage byte; Token keeps its Unit byte and Marker remains a distinct ordinary empty record"
		, result: "Initialized generated C Witness carrier with one non-semantic uint8_t storage byte; Token keeps its Unit byte and Marker remains a distinct ordinary empty record"
	})
	, cpp: Object.freeze({
		parameter: "Nominal empty C++ Witness carrier; Token keeps its Unit field and Marker remains a distinct nominal empty record"
		, result: "Nominal empty C++ Witness result; Token keeps its Unit field and Marker remains a distinct nominal empty record"
	})
});

const indexPath = `${zeroPayloadNativeEvidence}/index.json`;
const revision = "ecbec51d2a49e3146b996b0369e7dbe74e2d6db9";
const validators = Object.freeze([
	".github/workflows/zero-payload-checked-record-native.yml"
	, "scripts/check-zero-payload-checked-record-native-ci.mjs"
	, "scripts/run-zero-payload-checked-record-native-ci.sh"
	, "tests/helpers/zero-payload-checked-record-native-evidence.mjs"
]);
export const zeroPayloadNativePromotionPinPaths = Object.freeze([
	"docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/rust/package-audit.mjs"
]);
const referenceContract = Object.freeze([
	["ordinary-source", 1733
		, "bbc2ce868f3c5dcfc674440cad13aa59f20322e1fedb85523bd1f5bca2321d4f"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0-c.tar.gz", "6df86b6a8633797bd81a34a019dd0c18f36275a137bf6924e8c55a50151b5d85"], ["handoff/archives/zeropayloadcheckedrecords-1.0.0-cpp.tar.gz", "f7a1e7c882d27661a1cac4b0fc754710a5a4a2f2acf0cc06c19fb0ec667cc75d"]]]
	, ["reviewed-ir", 1735
		, "4d44db50be55faddc93aad44207b5413e869687c5716f77605ead545c26148e1"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0-c.tar.gz", "de818306113453dc2757360a431d41b92e3b62a90420ae2a2b57123b3975ffbb"], ["handoff/archives/zeropayloadcheckedrecords-1.0.0-cpp.tar.gz", "895e4115e99b9659fdb0fe7d749abf274c069ea351d00a18b7bc0a616a05460a"]]]
	, ["result-only-ordinary-source", 1733
		, "93e5dbcdb908f14b732d1466bf5a3aebf9c7d6b20aa4c406e5cdc079f76d6885"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0-c.tar.gz", "10a2538c7a7dad925880dbb6fc8b3841009575c9e6b4a600d6290eee3a028d46"], ["handoff/archives/zeropayloadcheckedrecords-1.0.0-cpp.tar.gz", "65f76d18eff71e706e425d81cf28c77c4575c3aa9b6d76e9be17ee63569602bb"]]]
	, ["result-only-reviewed-ir", 1735
		, "f7e94827e09370a4bde81898e497ff345df3f2cb46b75f1a82a638048075c36c"
		, [["handoff/archives/zeropayloadcheckedrecords-1.0.0-c.tar.gz", "a188544f4392bce91fbe62672a896e239a3a7a2fa57bfd5cfbb6dd6b0b29792d"], ["handoff/archives/zeropayloadcheckedrecords-1.0.0-cpp.tar.gz", "33da230e8efa00042561e6c15fd088a99a1080f6c3823389bec92e84e44c6733"]]]
]);
const routePath = route => route.replace(/^result-only-/u, "");
const routeId = route => `zero-payload-native-${route}-hosted-installed`;
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
	assert.equal(index.hostedRun.runId, 39548744700);
	assert.equal(index.hostedRun.artifact.id, 12324250671);
	const references = [];
	for(const [route, count, filesSha256, expectedArtifacts] of referenceContract)
	{
		const run = index.runs.find(item => item.route === route);
		assert.ok(run, route);
		const files = index.files.filter(file => file.path.startsWith(`${route}/`)
			|| file.path.startsWith("sources/") || file.path.startsWith("hosted/"));
		assert.equal(files.length, count, route);
		assert.equal(sha256(JSON.stringify(files)), filesSha256, route);
		const artifacts = [];
		for(const item of run.accepted.receipt.packages)
			for(const artifact of item.artifacts)
				artifacts.push({
					path: `handoff/${artifact.path}`, sha256: artifact.sha256
				});
		assert.deepEqual(artifacts.map(item => [item.path, item.sha256])
			, expectedArtifacts, route);
		const resultOnly = route.startsWith("result-only-");
		const evidenceFiles = files.map(file => ({
			path: `${zeroPayloadNativeEvidence}/${file.path}`
			, sha256: file.sha256
		}));
		references.push({
			id: routeId(route), route, sourcePath: routePath(route)
			, mode: resultOnly ? "result-only" : "full"
			, profiles: [...zeroPayloadNativePromotionProfiles]
			, positions: resultOnly ? ["result"] : ["parameter", "result"]
			, revision
			, command: "bash scripts/run-zero-payload-checked-record-native-ci.sh"
			, scope: `Hosted GitHub Actions run 39548744700 rebuilt the ${route} C and C++ package selection on Ubuntu 24.04. Two author roots reproduced the complete packages before author removal, source-free offline installation and unchanged replay after physical relocation. ${resultOnly ? "The result-only packages project proof-erased Witness, Token, Marker, Option, Array and Mark values without checked-input metadata." : "The full packages run the selected nullary Witness constructor at every checked input, keep rejected values unchanged, recover on the next valid call and project proof-erased Witness, Token, Marker, Option, Array and Mark results."} The retained archive authenticates every original artifact byte, route result, caller observation and exact producer, consumer, checker and archiver source closure. ${zeroPayloadNativePromotionLimit}`
			, files: [{ path: indexPath, sha256: zeroPayloadNativeEvidenceSha256 }
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
export const zeroPayloadNativePromotionReferences = async (read = readFile) => {
	if(read !== readFile)
		return referencesFromEvidence(await checkZeroPayloadNativeEvidence(read), read);
	cachedReferences ??= referencesFromEvidence(
		await checkZeroPayloadNativeEvidence(), readFile);
	return structuredClone(await cachedReferences);
};

/**
 * Advance the exact stale mutable source pointers exposed by this promotion.
 *
 * @param original - Exact inventory before reconciliation.
 */
export const reconcileZeroPayloadNativePromotionPins = async original => {
	const inventory = structuredClone(original), digests = new Map();
	for(const path of zeroPayloadNativePromotionPinPaths)
		digests.set(path, sha256(await readFile(path)));
	const seen = new Set();
	for(const evidence of inventory.evidence)
		for(const file of evidence.files)
			if(digests.has(file.path))
			{
				file.sha256 = digests.get(file.path);
				seen.add(file.path);
			}
	assert.deepEqual([...seen].sort(), [...zeroPayloadNativePromotionPinPaths].sort());
	return inventory;
};

/**
 * Supplement exactly eight C/C++ parameter/result cells.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated hosted selections.
 */
export const promoteZeroPayloadNative = async (original, references) => {
	assert.deepEqual(references, await zeroPayloadNativePromotionReferences());
	const inventory = await reconcileZeroPayloadNativePromotionPins(original)
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
	for(const profile of zeroPayloadNativePromotionProfiles)
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
				observation.scope += ` Additional hosted zero-payload C/C++ acceptance: ${addition}`;
				observation.hostTypes["checked-record"][position] += `; ${zeroPayloadNativePromotionHostTypes[profile][position]}`;
				observation.conversionNotes["checked-record"] += ` ${zeroPayloadNativePromotionConversion}`;
				observation.limitations.push(zeroPayloadNativePromotionLimit);
				for(const stage of Object.values(observation.stages))
				{
					assert.equal(stage.state, "passed");
					stage.evidence.push(...ids);
					assert.equal(stage.evidence.length, new Set(stage.evidence).size);
					stage.note += ` Additional hosted zero-payload C/C++ acceptance: ${addition}`;
				}
				changed += 1;
			}
	assert.equal(changed, 8);
	return inventory;
};
