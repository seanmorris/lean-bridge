#!/usr/bin/env node
/**
 * Freeze one successful hosted value-index npm/browser artifact exactly once.
 * The original ZIP is retained as reversible Git-safe parts only after every
 * route and negative control independently replays.
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
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import {
	checkCheckedRecordValueIndexBrowserCiRecords
} from "../tests/helpers/checked-record-value-index-browser-ci-report.mjs";
import {
	checkedRecordValueIndexBrowserRoutes
	, checkedRecordValueIndexBrowserSelection
} from "../tests/helpers/checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexBrowserEvidenceSources
	, checkedRecordValueIndexHostedOriginal
} from "../tests/helpers/checked-record-value-index-hosted-evidence-sources.mjs";
import {
	checkedRecordValueIndexHostedDigest
	, extractCheckedRecordValueIndexHostedArtifact
	, inspectCheckedRecordValueIndexHostedArtifact
	, parseCheckedRecordValueIndexHostedArchiveArgs
	, splitCheckedRecordValueIndexHostedArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";

const usage = "Usage: archive-checked-record-value-index-browser-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
let selected;
try
{
	selected = parseCheckedRecordValueIndexHostedArchiveArgs(
		process.argv.slice(2), usage);
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}

const evidence = "docs/evidence/checked-record-value-index-browser-20261019";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectCheckedRecordValueIndexHostedArtifact(selected, {
	workflow: ".github/workflows/checked-record-value-index-browser.yml"
	, jobName: "Four value-index routes in Node and three browsers"
	, artifactPrefix: "checked-record-value-index-browser"
});
const revision = hosted.revision;
const revisions = {
	producer: revision, npmChecker: revision, consumer: revision
	, checker: revision, archiver: archiveCommit
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
		, sha256: await checkedRecordValueIndexHostedDigest(source), source
	});
};

const extracted = await extractCheckedRecordValueIndexHostedArtifact(
	selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-browser-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"checked-record-value-index-browser-ci"
		, "checked-record-value-index-browser-engine.log"
		, "checked-record-value-index-browser-runtime.log"
	]);
	const hostedRoot = join(
		extracted.root, "checked-record-value-index-browser-ci");
	assert.deepEqual((await readdir(hostedRoot)).sort(), [
		...checkedRecordValueIndexBrowserRoutes, "records"
	].sort());
	assert.deepEqual((await readdir(join(hostedRoot, "records"))).sort()
		, [...checkedRecordValueIndexBrowserRoutes].sort());
	let runtime, browserVersions;
	const runs = [];
	for(const route of checkedRecordValueIndexBrowserRoutes)
	{
		const cell = join(hostedRoot, route);
		assert.deepEqual((await readdir(cell)).sort(), [
			"acceptance.tap", "controls.tap", "runtime-after.json"
			, "runtime-before.json", "verification.json"
		]);
		const recordsRoot = join(hostedRoot, "records", route);
		const paths = await nativeArtifactPaths(recordsRoot);
		const before = await readFile(join(cell, "runtime-before.json"));
		const after = await readFile(join(cell, "runtime-after.json"));
		assert.deepEqual(after, before, `${route} runtime drift`);
		const observedRuntime = JSON.parse(before);
		runtime ??= observedRuntime;
		assert.deepEqual(observedRuntime, runtime, `${route} runtime identity`);
		const acceptanceTap = await readFile(join(cell, "acceptance.tap"));
		const controlsTap = await readFile(join(cell, "controls.tap"));
		const options = {
			route, producer: revision, "npm-checker": revision
			, consumer: revision, checker: revision, directory: recordsRoot
			, "acceptance-tap": join(cell, "acceptance.tap")
			, "controls-tap": join(cell, "controls.tap")
			, runtime: join(cell, "runtime-before.json")
		};
		const checked = await checkCheckedRecordValueIndexBrowserCiRecords(
			options, {
				acceptanceTap: acceptanceTap.toString()
				, controlsTap: controlsTap.toString(), runtime, paths
				, read: path => readFile(join(recordsRoot, path))
			}
		);
		browserVersions ??= checked.browserVersions;
		assert.deepEqual(checked.browserVersions, browserVersions
			, `${route} browser identity`);
		const verification = await readFile(join(cell, "verification.json"));
		assert.equal(verification.toString(), canonicalJson(checked)
			, `${route} hosted checker output`);
		for(const path of paths)
			await putFile(`${route}/records/${path}`, join(recordsRoot, path));
		for(const [name, source] of [
			["acceptance.tap", join(cell, "acceptance.tap")]
			, ["controls.tap", join(cell, "controls.tap")]
			, ["runtime-before.json", join(cell, "runtime-before.json")]
			, ["runtime-after.json", join(cell, "runtime-after.json")]
			, ["verification.json", join(cell, "verification.json")]
		]) await putFile(`${route}/${name}`, source);
		const selection = checkedRecordValueIndexBrowserSelection(route);
		runs.push({
			route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: paths.length
			, accepted: checked, controls: checked.controls
			, acceptanceTapSha256: sha256(acceptanceTap)
			, controlsTapSha256: sha256(controlsTap)
			, verificationSha256: sha256(verification)
		});
	}
	await putFile("hosted/logs/engine.log", join(extracted.root
		, "checked-record-value-index-browser-engine.log"));
	await putFile("hosted/logs/runtime.log", join(extracted.root
		, "checked-record-value-index-browser-runtime.log"));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitCheckedRecordValueIndexHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = checkedRecordValueIndexBrowserEvidenceSources(
		revisions);
	for(const source of selectedSources)
	{
		const original = checkedRecordValueIndexHostedOriginal(
			source.revision, source.path);
		if(source.role === "checker")
			assert.deepEqual(await readFile(source.path), original
				, `Current checker differs from hosted checker: ${source.path}`);
		putBytes(`sources/${source.role}/${source.path}`, original);
	}
	const files = [...descriptors].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, descriptor]) => ({
		path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1
		, kind: "checked-record-value-index-browser-installed-v1"
		, producerCommit: revision, npmCheckerCommit: revision
		, consumerCommit: revision, checkerCommit: revision, archiveCommit
		, runtime, browserVersions, loadCeiling: 8
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(
				Object.entries(hosted.api).map(([name, item]) => [
					name
					, { bytes: item.bytes.length, sha256: item.sha256 }
				])
			)
			, artifact: {
				...hosted.hostedRun.artifact
				, members: extracted.entries
				, parts: parts.map(({ name, offset, bytes, sha256: digest }) => ({
					path: `hosted/artifact.zip.parts/${name}`
					, offset, bytes, sha256: digest
				}))
			}
		}
		, runs, selectedSources, files
		, limitations: [
			"The fixture covers closed Bool, String and Nat value indices: both booleans, empty and Unicode strings, zero and a Nat wider than 64 bits."
			, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only npm APIs."
			, "Node JavaScript, strict TypeScript, Chromium, Firefox and WebKit execute source-free installed packages; browser contexts cover pages, React production and StrictMode, and dedicated workers."
			, "Complete component/runtime npm archives, receipts, reports, controls, TAP, browser observations, workflow logs, GitHub API records and a byte-exact split of the original artifact ZIP are retained."
			, "External browser, Node, compiler, Nix and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
			, "This lane establishes installed npm/browser acceptance only; aggregate support promotion and other value-index hosts require separate evidence."
		]
	};

	await mkdir(evidence);
	for(const [path, descriptor] of descriptors)
	{
		const target = join(evidence, path);
		await mkdir(dirname(target), { recursive: true });
		if(descriptor.source) await copyFile(
			descriptor.source, target, constants.COPYFILE_FICLONE);
		else await writeFile(target, descriptor.value, { flag: "wx" });
		assert.equal((await stat(target)).size, descriptor.bytes, path);
		assert.equal(await checkedRecordValueIndexHostedDigest(target)
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
