/**
 * Independently replay one immutable callback checked-record hosted archive.
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
	checkCallbackCheckedRecordBrowserCi
	, checkCallbackCheckedRecordBrowserRecords
} from "./callback-checked-record-browser-ci.mjs";
import {
	callbackCheckedRecordNativeVerification
} from "./callback-checked-record-native-ci.mjs";
import {
	callbackCheckedRecordRemainingVerification
} from "./callback-checked-record-remaining-ci.mjs";
import {
	callbackCheckedRecordEvidenceSources
	, callbackCheckedRecordHostedOriginal
} from "./callback-checked-record-hosted-evidence-sources.mjs";
import {
	callbackCheckedRecordHostedDigest
	, extractCallbackCheckedRecordHostedArtifact
	, inspectCallbackCheckedRecordHostedArtifact
} from "./callback-checked-record-hosted-archive.mjs";

const contracts = Object.freeze({
	browser: {
		workflow: ".github/workflows/callback-checked-record-browser.yml"
		, job: "Callback checked records in Node and three browsers"
		, prefix: "callback-checked-record-browser"
		, root: "callback-checked-record-browser-ci"
		, profiles: ["node-javascript", "node-typescript"
			, "browser-javascript", "browser-react", "browser-worker"]
	}
	, native: {
		workflow: ".github/workflows/callback-checked-record-native.yml"
		, job: "Directional callback checked records in installed C and C++ packages"
		, prefix: "callback-checked-record-native"
		, root: "callback-checked-record-native-ci"
		, profiles: ["c", "cpp"], nativeKind: "native"
	}
	, languages: {
		workflow: ".github/workflows/callback-checked-record-languages.yml"
		, job: "Directional callback checked records in three installed language packages"
		, prefix: "callback-checked-record-languages"
		, root: "callback-checked-record-languages-ci"
		, profiles: ["python", "ruby", "rust"], nativeKind: "language"
	}
	, perl: {
		workflow: ".github/workflows/callback-checked-record-perl.yml"
		, job: "Directional callback checked records on all four Perl ABIs"
		, prefix: "callback-checked-record-perl"
		, root: "callback-checked-record-perl-ci"
		, flat: true, profiles: ["perl"], nativeKind: "perl"
	}
	, dotnet: {
		workflow: ".github/workflows/callback-checked-record-remaining.yml"
		, job: "Directional callback checked records in dotnet"
		, prefix: "callback-checked-record-remaining-dotnet"
		, root: "callback-checked-record-remaining-ci-dotnet"
		, profiles: ["dotnet"]
	}
	, jvm: {
		workflow: ".github/workflows/callback-checked-record-remaining.yml"
		, job: "Directional callback checked records in jvm"
		, prefix: "callback-checked-record-remaining-jvm"
		, root: "callback-checked-record-remaining-ci-jvm"
		, profiles: ["java", "kotlin"]
	}
	, "php-native": {
		workflow: ".github/workflows/callback-checked-record-remaining.yml"
		, job: "Directional callback checked records in php-native"
		, prefix: "callback-checked-record-remaining-php-native"
		, root: "callback-checked-record-remaining-ci-php-native"
		, profiles: ["php-native"]
	}
	, "wit-wasi": {
		workflow: ".github/workflows/callback-checked-record-remaining.yml"
		, job: "Directional callback checked records in wit-wasi"
		, prefix: "callback-checked-record-remaining-wit-wasi"
		, root: "callback-checked-record-remaining-ci-wit-wasi"
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
			...checkCallbackCheckedRecordBrowserCi({
				producer: revision, tap: join(output, "acceptance.tap")
				, runtime: join(output, "runtime-before.json")
				, records: join(output, "records")
			}, { tap, runtime })
			, records: await checkCallbackCheckedRecordBrowserRecords(
				join(output, "records"), revision)
		};
	}
	const report = JSON.parse(await readFile(join(output, "report.json")));
	return contract.nativeKind
		? callbackCheckedRecordNativeVerification(
			contract.nativeKind, revision, tap, report)
		: callbackCheckedRecordRemainingVerification(
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
export const checkCallbackCheckedRecordHostedEvidence = async (
	lane, evidenceRoot
) => {
	assert.ok(Object.hasOwn(contracts, lane));
	const root = await realpath(evidenceRoot);
	const indexBytes = await readFile(join(root, "index.json"));
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, `callback-checked-record-${lane}-installed-v1`);
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
		assert.equal(await callbackCheckedRecordHostedDigest(path)
			, file.sha256, file.path);
	}
	const revisions = {
		producer: index.producerCommit, consumer: index.consumerCommit
		, checker: index.checkerCommit, archiver: index.archiveCommit
	};
	assert.deepEqual(index.selectedSources
		, callbackCheckedRecordEvidenceSources(lane, revisions));
	for(const source of index.selectedSources)
		assert.deepEqual(await readFile(join(
			root, `sources/${source.role}/${source.path}`))
		, callbackCheckedRecordHostedOriginal(source.revision, source.path)
		, `${source.role}/${source.path}`);

	const temporary = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-checked-record-evidence-"));
	let extracted;
	try
	{
		const zip = join(temporary, "artifact.zip");
		const bytes = await reconstruct(
			root, index.hostedRun.artifact.parts, zip);
		assert.equal(bytes, index.hostedRun.artifact.bytes);
		assert.equal(await callbackCheckedRecordHostedDigest(zip)
			, index.hostedRun.artifact.sha256);
		const api = name => join(root, `hosted/api/${name}.json`);
		const hosted = await inspectCallbackCheckedRecordHostedArtifact({
			"artifact-zip": zip, "run-json": api("run")
			, "job-json": api("job"), "artifact-json": api("artifact")
		}, {
			workflow: contracts[lane].workflow, jobName: contracts[lane].job
			, artifactPrefix: contracts[lane].prefix
		});
		assert.equal(hosted.revision, index.producerCommit);
		extracted = await extractCallbackCheckedRecordHostedArtifact(zip);
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
