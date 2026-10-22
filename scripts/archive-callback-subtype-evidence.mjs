#!/usr/bin/env node
/**
 * Freeze one successful hosted callback Subtype artifact after
 * independently replaying its lane-specific checker.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, constants, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat
	, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	checkCallbackSubtypeBrowserCi
	, checkCallbackSubtypeBrowserRecords
} from "../tests/helpers/callback-subtype-browser-ci.mjs";
import {
	callbackSubtypeNativeVerification
} from "../tests/helpers/callback-subtype-native-ci.mjs";
import {
	callbackSubtypeRemainingVerification
} from "../tests/helpers/callback-subtype-remaining-ci.mjs";
import {
	callbackSubtypeEvidenceSources
	, callbackSubtypeHostedLanes
	, callbackSubtypeHostedOriginal
} from "../tests/helpers/callback-subtype-hosted-evidence-sources.mjs";
import {
	callbackSubtypeHostedDigest
	, extractCallbackSubtypeHostedArtifact
	, inspectCallbackSubtypeHostedArtifact
	, parseCallbackSubtypeHostedArchiveArgs
	, splitCallbackSubtypeHostedArtifact
} from "../tests/helpers/callback-subtype-hosted-archive.mjs";

const repository = fileURLToPath(new URL("..", import.meta.url));
process.chdir(repository);

const configs = Object.freeze({
	browser: {
		workflow: ".github/workflows/callback-subtype-browser.yml"
		, job: "Callback Subtypes in Node and three browsers"
		, prefix: "callback-subtype-browser"
		, root: "callback-subtype-browser-ci"
		, logs: ["callback-subtype-browser-engine.log"
			, "callback-subtype-browser-runtime.log"]
		, profiles: ["node-javascript", "node-typescript"
			, "browser-javascript", "browser-react", "browser-worker"]
	}
	, native: {
		workflow: ".github/workflows/callback-subtype-native.yml"
		, job: "Directional callback Subtypes in installed C and C++ packages"
		, prefix: "callback-subtype-native"
		, root: "callback-subtype-native-ci"
		, logs: ["callback-subtype-native-toolchain.log"]
		, profiles: ["c", "cpp"], nativeKind: "native"
	}
	, languages: {
		workflow: ".github/workflows/callback-subtype-languages.yml"
		, job: "Directional callback Subtypes in three installed language packages"
		, prefix: "callback-subtype-languages"
		, root: "callback-subtype-languages-ci"
		, logs: ["callback-subtype-languages-toolchain.log"]
		, profiles: ["python", "ruby", "rust"], nativeKind: "language"
	}
	, perl: {
		workflow: ".github/workflows/callback-subtype-perl.yml"
		, job: "Directional callback Subtypes on all four Perl ABIs"
		, prefix: "callback-subtype-perl"
		, root: "callback-subtype-perl-ci"
		, flat: true, logs: [], profiles: ["perl"], nativeKind: "perl"
	}
	, dotnet: {
		workflow: ".github/workflows/callback-subtype-remaining.yml"
		, job: "Directional callback Subtypes in dotnet"
		, prefix: "callback-subtype-remaining-dotnet"
		, root: "callback-subtype-remaining-ci-dotnet"
		, logs: ["callback-subtype-remaining-dotnet-toolchain.log"]
		, profiles: ["dotnet"]
	}
	, jvm: {
		workflow: ".github/workflows/callback-subtype-remaining.yml"
		, job: "Directional callback Subtypes in jvm"
		, prefix: "callback-subtype-remaining-jvm"
		, root: "callback-subtype-remaining-ci-jvm"
		, logs: ["callback-subtype-remaining-jvm-toolchain.log"]
		, profiles: ["java", "kotlin"]
	}
	, "php-native": {
		workflow: ".github/workflows/callback-subtype-remaining.yml"
		, job: "Directional callback Subtypes in php-native"
		, prefix: "callback-subtype-remaining-php-native"
		, root: "callback-subtype-remaining-ci-php-native"
		, logs: ["callback-subtype-remaining-php-native-toolchain.log"]
		, profiles: ["php-native"]
	}
	, "wit-wasi": {
		workflow: ".github/workflows/callback-subtype-remaining.yml"
		, job: "Directional callback Subtypes in wit-wasi"
		, prefix: "callback-subtype-remaining-wit-wasi"
		, root: "callback-subtype-remaining-ci-wit-wasi"
		, logs: ["callback-subtype-remaining-wit-wasi-toolchain.log"]
		, profiles: ["wit-wasi"]
	}
});

const usage = "Usage: archive-callback-subtype-evidence.mjs --lane <browser|native|languages|perl|dotnet|jvm|php-native|wit-wasi> --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
const args = process.argv.slice(2), laneAt = args.indexOf("--lane");
assert.ok(laneAt >= 0 && laneAt + 1 < args.length, usage);
const lane = args[laneAt + 1];
assert.ok(callbackSubtypeHostedLanes.includes(lane), usage);
const archiveArgs = [...args]; archiveArgs.splice(laneAt, 2);
let selected;
try
{
	selected = parseCallbackSubtypeHostedArchiveArgs(archiveArgs, usage);
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}

const config = configs[lane];
const evidence = `docs/evidence/callback-subtype-${lane}-20261022`;
await assert.rejects(access(evidence), { code: "ENOENT" });
const statusArgs = ["-C", repository, "status", "--porcelain=v1"
	, "--untracked-files=all", "--", "."];
const status = execFileSync("git", statusArgs, { encoding: "utf8" });
assert.equal(status, ""
	, "Archive generation requires a clean tracked and untracked source tree");
const revisionArgs = ["-C", repository, "rev-parse", "HEAD"];
const archiveCommit = execFileSync(
	"git", revisionArgs, { encoding: "utf8" }
).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectCallbackSubtypeHostedArtifact(selected, {
	workflow: config.workflow, jobName: config.job, artifactPrefix: config.prefix
});
const revision = hosted.revision, revisions = {
	producer: revision, consumer: revision, checker: revision
	, archiver: archiveCommit
};
const descriptors = new Map();
const putBytes = (path, value) => {
	assert.ok(!descriptors.has(path), path);
	const bytes = Buffer.from(value);
	descriptors.set(path, {
		bytes: bytes.length, sha256: sha256(bytes), value: bytes
	});
};
const putFile = async (path, source) => {
	assert.ok(!descriptors.has(path), path);
	const information = await stat(source);
	assert.ok(information.isFile(), source);
	descriptors.set(path, {
		bytes: information.size
		, sha256: await callbackSubtypeHostedDigest(source), source
	});
};

const extracted = await extractCallbackSubtypeHostedArtifact(
	selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-zip-"));
try
{
	const required = lane === "browser"
		? ["acceptance.tap", "records", "runtime-after.json", "runtime-before.json"
			, "verification.json"]
		: ["acceptance.tap", "report.json", "verification.json"];
	assert.deepEqual((await readdir(extracted.root)).sort()
		, (config.flat ? required : [config.root, ...config.logs]).sort());
	const outputRoot = config.flat
		? extracted.root : join(extracted.root, config.root);
	const outputNames = await readdir(outputRoot);
	assert.deepEqual(outputNames.sort(), required.sort());
	const tap = await readFile(join(outputRoot, "acceptance.tap"), "utf8");
	const verification = await readFile(join(outputRoot, "verification.json"));
	let accepted;
	if(lane === "browser")
	{
		const runtimeBytes = await readFile(
			join(outputRoot, "runtime-before.json"));
		assert.deepEqual(await readFile(join(outputRoot, "runtime-after.json"))
			, runtimeBytes, "Browser runtime identity changed during acceptance");
		const runtime = JSON.parse(runtimeBytes);
		accepted = {
			...checkCallbackSubtypeBrowserCi({
				producer: revision, tap: join(outputRoot, "acceptance.tap")
				, runtime: join(outputRoot, "runtime-before.json")
				, records: join(outputRoot, "records")
			}, { tap, runtime })
			, records: await checkCallbackSubtypeBrowserRecords(
				join(outputRoot, "records"), revision)
		};
	}
	else
	{
		const report = JSON.parse(await readFile(
			join(outputRoot, "report.json"), "utf8"));
		accepted = config.nativeKind
			? callbackSubtypeNativeVerification(
				config.nativeKind, revision, tap, report)
			: callbackSubtypeRemainingVerification(
				revision, config.profiles, tap, report);
	}
	assert.equal(verification.toString(), canonicalJson(accepted)
		, "Hosted checker output must exactly match independent replay");
	for(const path of await nativeArtifactPaths(extracted.root))
		await putFile(`hosted/output/${path}`, join(extracted.root, path));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitCallbackSubtypeHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = callbackSubtypeEvidenceSources(
		lane, revisions);
	for(const source of selectedSources)
	{
		const bytes = callbackSubtypeHostedOriginal(
			source.revision, source.path);
		if(source.role === "checker")
			assert.deepEqual(await readFile(source.path), bytes
				, `Current checker differs from hosted checker: ${source.path}`);
		putBytes(`sources/${source.role}/${source.path}`, bytes);
	}
	const files = [...descriptors].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, descriptor]) => ({
		path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1
		, kind: `callback-subtype-${lane}-installed-v1`
		, lane, profiles: config.profiles
		, producerCommit: revision, consumerCommit: revision
		, checkerCommit: revision, archiveCommit, accepted
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(
				Object.entries(hosted.api).map(([name, item]) => [
					name, { bytes: item.bytes.length, sha256: item.sha256 }
				])
			)
			, artifact: {
				...hosted.hostedRun.artifact, members: extracted.entries
				, parts: parts.map(({ name, offset, bytes, sha256: digest }) => ({
					path: `hosted/artifact.zip.parts/${name}`
					, offset, bytes, sha256: digest
				}))
			}
		}
		, selectedSources, files
		, limitations: [
			"The fixture covers synchronous copied Nat Subtypes in host callback replies and inputs to returned Lean closures, with exact selected constructors and typed recovery."
			, "Ordinary Lean source and independently reviewed Binding IR execute through source-free installed packages on the named profiles."
			, "The retained report proves acceptance, exact rejection, unchanged caller values and recovery for the fixture's selected Nat Subtypes and admitted copied containers; retained or asynchronous callbacks, owned Subtypes, arbitrary predicates and recursive or generic refined payloads remain separate work."
			, "The original artifact ZIP, GitHub API records, workflow output and exact producer/checker/archive source closures are retained byte-for-byte and independently replayed."
			, "External runtimes, compilers, package managers and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
		]
	};

	await mkdir(evidence);
	for(const [path, descriptor] of descriptors)
	{
		const target = join(evidence, path);
		await mkdir(dirname(target), { recursive: true });
		if(descriptor.source)
			await copyFile(descriptor.source, target, constants.COPYFILE_FICLONE);
		else await writeFile(target, descriptor.value, { flag: "wx" });
		assert.equal((await stat(target)).size, descriptor.bytes, path);
		assert.equal(await callbackSubtypeHostedDigest(target)
			, descriptor.sha256, path);
	}
	const indexBytes = Buffer.from(canonicalJson(index));
	await writeFile(join(evidence, "index.json"), indexBytes, { flag: "wx" });
	process.stdout.write(canonicalJson({
		destination: evidence, files: files.length + 1
		, bytes: files.reduce((sum, file) => sum + file.bytes
			, indexBytes.length)
		, ...revisions
		, hostedRun: index.hostedRun
		, indexSha256: sha256(indexBytes)
	}));
}
finally
{
	await rm(extracted.root, { recursive: true });
	await rm(partsRoot, { recursive: true });
}
