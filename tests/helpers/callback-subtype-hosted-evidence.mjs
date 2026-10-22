/**
 * Independently replay one immutable callback Subtype hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { open, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCallbackSubtypeBrowserCi
	, checkCallbackSubtypeBrowserRecords
} from "./callback-subtype-browser-ci.mjs";
import {
	callbackSubtypeNativeVerification
} from "./callback-subtype-native-ci.mjs";
import {
	callbackSubtypeRemainingVerification
} from "./callback-subtype-remaining-ci.mjs";
import {
	callbackSubtypeEvidenceSources
	, callbackSubtypeHostedOriginal
} from "./callback-subtype-hosted-evidence-sources.mjs";
import {
	callbackSubtypeHostedDigest
	, extractCallbackSubtypeHostedArtifact
	, inspectCallbackSubtypeHostedArtifact
} from "./callback-subtype-hosted-archive.mjs";

const contracts = Object.freeze({
	browser: {
		workflow: ".github/workflows/callback-subtype-browser.yml"
		, job: "Callback Subtypes in Node and three browsers"
		, prefix: "callback-subtype-browser"
		, root: "callback-subtype-browser-ci"
		, profiles: ["node-javascript", "node-typescript"
			, "browser-javascript", "browser-react", "browser-worker"]
	}
	, native: {
		workflow: ".github/workflows/callback-subtype-native.yml"
		, job: "Directional callback Subtypes in installed C and C++ packages"
		, prefix: "callback-subtype-native"
		, root: "callback-subtype-native-ci"
		, profiles: ["c", "cpp"], nativeKind: "native"
	}
	, languages: {
		workflow: ".github/workflows/callback-subtype-languages.yml"
		, job: "Directional callback Subtypes in three installed language packages"
		, prefix: "callback-subtype-languages"
		, root: "callback-subtype-languages-ci"
		, profiles: ["python", "ruby", "rust"], nativeKind: "language"
	}
	, perl: {
		workflow: ".github/workflows/callback-subtype-perl.yml"
		, job: "Directional callback Subtypes on all four Perl ABIs"
		, prefix: "callback-subtype-perl"
		, root: "callback-subtype-perl-ci"
		, flat: true, profiles: ["perl"], nativeKind: "perl"
	}
	, dotnet: {
		workflow: ".github/workflows/callback-subtype-remaining.yml"
		, job: "Directional callback Subtypes in dotnet"
		, prefix: "callback-subtype-remaining-dotnet"
		, root: "callback-subtype-remaining-ci-dotnet"
		, profiles: ["dotnet"]
	}
	, jvm: {
		workflow: ".github/workflows/callback-subtype-remaining.yml"
		, job: "Directional callback Subtypes in jvm"
		, prefix: "callback-subtype-remaining-jvm"
		, root: "callback-subtype-remaining-ci-jvm"
		, profiles: ["java", "kotlin"]
	}
	, "php-native": {
		workflow: ".github/workflows/callback-subtype-remaining.yml"
		, job: "Directional callback Subtypes in php-native"
		, prefix: "callback-subtype-remaining-php-native"
		, root: "callback-subtype-remaining-ci-php-native"
		, profiles: ["php-native"]
	}
	, "wit-wasi": {
		workflow: ".github/workflows/callback-subtype-remaining.yml"
		, job: "Directional callback Subtypes in wit-wasi"
		, prefix: "callback-subtype-remaining-wit-wasi"
		, root: "callback-subtype-remaining-ci-wit-wasi"
		, profiles: ["wit-wasi"]
	}
});

const replay = async (lane, root, revision) => {
	const contract = contracts[lane], output = contract.flat
		? root : join(root, contract.root);
	const tap = await readFile(join(output, "acceptance.tap"), "utf8");
	if(lane === "browser")
	{
		const runtimeBytes = await readFile(join(output, "runtime-before.json"));
		assert.deepEqual(await readFile(join(output, "runtime-after.json"))
			, runtimeBytes, "Browser runtime identity changed during acceptance");
		const runtime = JSON.parse(runtimeBytes);
		return {
			...checkCallbackSubtypeBrowserCi({
				producer: revision, tap: join(output, "acceptance.tap")
				, runtime: join(output, "runtime-before.json")
				, records: join(output, "records")
			}, { tap, runtime })
			, records: await checkCallbackSubtypeBrowserRecords(
				join(output, "records"), revision)
		};
	}
	const report = JSON.parse(await readFile(join(output, "report.json")));
	return contract.nativeKind
		? callbackSubtypeNativeVerification(
			contract.nativeKind, revision, tap, report)
		: callbackSubtypeRemainingVerification(
			revision, contract.profiles, tap, report);
};

const reconstruct = async (root, parts, target) => {
	const output = await open(target, "wx");
	try
	{
		let offset = 0;
		for(const part of parts)
		{
			assert.equal(part.offset, offset);
			const bytes = await readFile(join(root, part.path));
			assert.equal(bytes.length, part.bytes);
			assert.equal(sha256(bytes), part.sha256);
			await output.write(bytes, 0, bytes.length, offset);
			offset += bytes.length;
		}
		return offset;
	}
	finally
	{ await output.close(); }
};

/**
 * Validate every retained byte, rebuild the original ZIP and replay its
 * lane-specific independent checker.
 *
 * @param lane - Closed hosted lane name.
 * @param evidenceRoot - Repository-relative immutable evidence root.
 */
export const checkCallbackSubtypeHostedEvidence = async (
	lane, evidenceRoot
) => {
	assert.ok(Object.hasOwn(contracts, lane));
	const root = await realpath(evidenceRoot);
	const indexBytes = await readFile(join(root, "index.json"));
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, `callback-subtype-${lane}-installed-v1`);
	assert.equal(index.lane, lane);
	assert.deepEqual(index.profiles, contracts[lane].profiles);
	for(const key of [
		"producerCommit", "consumerCommit", "checkerCommit", "archiveCommit"
	]) assert.match(index[key], /^[a-f0-9]{40}$/u, key);
	assert.equal(index.producerCommit, index.consumerCommit);
	assert.equal(index.producerCommit, index.checkerCommit);
	assert.deepEqual(index.files, [...index.files].sort((left, right) =>
		left.path.localeCompare(right.path)));
	assert.equal(new Set(index.files.map(file => file.path)).size
		, index.files.length);
	const expectedPaths = ["index.json", ...index.files.map(file => file.path)]
		.sort();
	assert.deepEqual(await nativeArtifactPaths(root), expectedPaths);
	for(const file of index.files)
	{
		const path = join(root, file.path), information = await stat(path);
		assert.equal(information.size, file.bytes, file.path);
		assert.equal(await callbackSubtypeHostedDigest(path)
			, file.sha256, file.path);
	}
	const revisions = {
		producer: index.producerCommit, consumer: index.consumerCommit
		, checker: index.checkerCommit, archiver: index.archiveCommit
	};
	assert.deepEqual(index.selectedSources
		, callbackSubtypeEvidenceSources(lane, revisions));
	for(const source of index.selectedSources)
		assert.deepEqual(await readFile(join(
			root, `sources/${source.role}/${source.path}`))
		, callbackSubtypeHostedOriginal(source.revision, source.path)
		, `${source.role}/${source.path}`);

	const temporary = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-subtype-evidence-"));
	let extracted;
	try
	{
		const zip = join(temporary, "artifact.zip");
		const bytes = await reconstruct(
			root, index.hostedRun.artifact.parts, zip);
		assert.equal(bytes, index.hostedRun.artifact.bytes);
		assert.equal(await callbackSubtypeHostedDigest(zip)
			, index.hostedRun.artifact.sha256);
		const api = name => join(root, `hosted/api/${name}.json`);
		const hosted = await inspectCallbackSubtypeHostedArtifact({
			"artifact-zip": zip, "run-json": api("run")
			, "job-json": api("job"), "artifact-json": api("artifact")
		}, {
			workflow: contracts[lane].workflow, jobName: contracts[lane].job
			, artifactPrefix: contracts[lane].prefix
		});
		assert.equal(hosted.revision, index.producerCommit);
		extracted = await extractCallbackSubtypeHostedArtifact(zip);
		assert.deepEqual(extracted.entries, index.hostedRun.artifact.members);
		for(const path of await nativeArtifactPaths(extracted.root))
			assert.deepEqual(await readFile(join(extracted.root, path))
				, await readFile(join(root, "hosted/output", path)), path);
		const accepted = await replay(
			lane, join(root, "hosted/output"), index.producerCommit);
		assert.deepEqual(accepted, index.accepted);
		const output = contracts[lane].flat
			? join(root, "hosted/output")
			: join(root, "hosted/output", contracts[lane].root);
		assert.equal(await readFile(join(output, "verification.json"), "utf8")
			, canonicalJson(accepted));
	}
	finally
	{
		if(extracted) await rm(extracted.root, { recursive: true });
		await rm(temporary, { recursive: true });
	}
	return index;
};
