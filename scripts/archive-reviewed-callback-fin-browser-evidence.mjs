#!/usr/bin/env node
/**
 * Freeze the successful hosted reviewed callback-Fin browser run. The
 * original GitHub artifact, API identities, logs, reports and exact source
 * snapshots are retained only after an independent replay succeeds.
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
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedDigest
	, extractCheckedRecordValueIndexHostedArtifact
	, splitCheckedRecordValueIndexHostedArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";
import {
	assertReviewedCallbackFinBrowserHostedChecker
	, inspectReviewedCallbackFinBrowserHostedArtifact
	, parseReviewedCallbackFinBrowserHostedArchiveArgs
	, reviewedCallbackFinBrowserHostedEvidenceDirectory
	, reviewedCallbackFinBrowserHostedOriginal
	, reviewedCallbackFinBrowserHostedSources
} from "../tests/helpers/reviewed-callback-fin-browser-hosted-archive.mjs";
import {
	checkReviewedCallbackFinBrowserCi
} from "../tests/helpers/reviewed-callback-fin-browser-ci.mjs";

let selected;
try
{
	selected = parseReviewedCallbackFinBrowserHostedArchiveArgs(
		process.argv.slice(2));
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}

await assert.rejects(access(reviewedCallbackFinBrowserHostedEvidenceDirectory)
	, { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectReviewedCallbackFinBrowserHostedArtifact(selected);
const revision = hosted.revision;
const revisions = {
	producer: revision, checker: revision, archiver: archiveCommit
};
await assertReviewedCallbackFinBrowserHostedChecker(revision);

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
		, sha256: await checkedRecordValueIndexHostedDigest(source), source
	});
};

const extracted = await extractCheckedRecordValueIndexHostedArtifact(
	selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-fin-browser-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"callback-checked-record-browser-ci"
		, "callback-checked-record-browser-engine.log"
		, "callback-checked-record-browser-runtime.log"
		, "reviewed-callback-fin-browser-ci"
	]);
	const root = join(extracted.root, "reviewed-callback-fin-browser-ci");
	assert.deepEqual((await readdir(root)).sort(), [
		"acceptance.tap", "r1.json", "r2.json", "runtime-after.json"
		, "runtime-before.json", "verification.json"
	]);
	const tap = await readFile(join(root, "acceptance.tap"), "utf8");
	const runtimeBytes = await readFile(join(root, "runtime-before.json"));
	const runtimeAfter = await readFile(join(root, "runtime-after.json"));
	assert.deepEqual(runtimeAfter, runtimeBytes, "Hosted runtime identity drift");
	const runtime = JSON.parse(runtimeBytes);
	const r1 = JSON.parse(await readFile(join(root, "r1.json"), "utf8"));
	const r2 = JSON.parse(await readFile(join(root, "r2.json"), "utf8"));
	const checked = checkReviewedCallbackFinBrowserCi({
		producer: revision, tap: join(root, "acceptance.tap")
		, runtime: join(root, "runtime-before.json")
		, r1: join(root, "r1.json"), r2: join(root, "r2.json")
	}, { tap, runtime, r1, r2 });
	const verification = await readFile(join(root, "verification.json"));
	assert.equal(verification.toString(), canonicalJson(checked)
		, "Hosted checker output differs from independent replay");
	for(const name of [
		"acceptance.tap", "r1.json", "r2.json", "runtime-before.json"
		, "runtime-after.json", "verification.json"
	]) await putFile(`observations/${name}`, join(root, name));
	await putFile("hosted/logs/engine.log", join(extracted.root
		, "callback-checked-record-browser-engine.log"));
	await putFile("hosted/logs/runtime.log", join(extracted.root
		, "callback-checked-record-browser-runtime.log"));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitCheckedRecordValueIndexHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = reviewedCallbackFinBrowserHostedSources(revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, reviewedCallbackFinBrowserHostedOriginal(
				source.revision, source.path));
	const files = [];
	for(const [path, descriptor] of [...descriptors].sort(
		([left], [right]) => left.localeCompare(right)
	)) files.push({
		path, bytes: descriptor.bytes, sha256: descriptor.sha256
	});
	const index = {
		schemaVersion: 1
		, kind: "reviewed-callback-fin-browser-installed-v1"
		, producerCommit: revision, checkerCommit: revision, archiveCommit
		, runtime
		, profiles: [
			"browser-javascript"
			, "browser-react", "browser-worker"
		]
		, engines: ["chromium", "firefox", "webkit"]
		, routes: checked.reports.map(item => item.review)
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(Object.entries(hosted.api).map(
				([name, item]) => [name, {
					bytes: item.bytes.length, sha256: item.sha256
				}]
			))
			, artifact: {
				...hosted.hostedRun.artifact, members: extracted.entries
				, parts: parts.map(({ name, offset, bytes, sha256: digest }) => ({
					path: `hosted/artifact.zip.parts/${name}`
					, offset, bytes, sha256: digest
				}))
			}
		}
		, accepted: checked, selectedSources, files
		, limitations: [
			"This evidence covers independently reviewed R1 and R2 callback-Fin packages in Chromium, Firefox and WebKit pages, React production and StrictMode lifecycles, and dedicated workers."
			, "The Node harness records the runtime identity; strict TypeScript validates declarations but is not a separate runtime execution."
			, "The original GitHub artifact ZIP, API identities, workflow logs, reports, TAP, checker output and exact selected source snapshots are retained."
			, "This lane establishes reviewed browser callback parameter/result cells only. Ordinary browser callbacks and copied fields retain their own evidence."
			, "External browser, Node, compiler, Nix and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
		]
	};

	await mkdir(reviewedCallbackFinBrowserHostedEvidenceDirectory);
	for(const [path, descriptor] of descriptors)
	{
		const target = join(
			reviewedCallbackFinBrowserHostedEvidenceDirectory, path);
		await mkdir(dirname(target), { recursive: true });
		if(descriptor.source) await copyFile(
			descriptor.source, target, constants.COPYFILE_FICLONE);
		else await writeFile(target, descriptor.value, { flag: "wx" });
		assert.equal((await stat(target)).size, descriptor.bytes, path);
		assert.equal(await checkedRecordValueIndexHostedDigest(target)
			, descriptor.sha256, path);
	}
	const indexBytes = Buffer.from(canonicalJson(index));
	await writeFile(join(reviewedCallbackFinBrowserHostedEvidenceDirectory
		, "index.json"), indexBytes, { flag: "wx" });
	process.stdout.write(canonicalJson({
		destination: reviewedCallbackFinBrowserHostedEvidenceDirectory
		, files: files.length + 1
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
