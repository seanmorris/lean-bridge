#!/usr/bin/env node
/**
 * Freeze one successful hosted dependent checked-record npm/browser artifact.
 * The original ZIP is retained as reversible Git-safe parts only after every
 * route independently replays through the post-run checker.
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
	checkDependentCheckedRecordBrowserCiRecords
} from "../tests/helpers/dependent-checked-record-browser-ci-report.mjs";
import {
	dependentCheckedRecordRoutes
	, dependentCheckedRecordSelection
} from "../tests/helpers/dependent-checked-record-browser-fixture.mjs";
import {
	dependentCheckedRecordBrowserEvidenceSources
	, dependentCheckedRecordHostedOriginal
} from "../tests/helpers/dependent-checked-record-hosted-evidence-sources.mjs";
import {
	dependentCheckedRecordHostedDigest
	, extractDependentCheckedRecordHostedArtifact
	, inspectDependentCheckedRecordHostedArtifact
	, parseDependentCheckedRecordHostedArchiveArgs
	, splitDependentCheckedRecordHostedArtifact
} from "../tests/helpers/dependent-checked-record-hosted-archive.mjs";

const usage = "Usage: archive-dependent-checked-record-browser-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
let selected;
try
{
	selected = parseDependentCheckedRecordHostedArchiveArgs(
		process.argv.slice(2), usage);
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}

const evidence = "docs/evidence/dependent-checked-record-browser-20261021";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectDependentCheckedRecordHostedArtifact(selected, {
	workflow: ".github/workflows/dependent-checked-record-browser.yml"
	, jobName: "Four dependent-record routes in Node and three browsers"
	, artifactPrefix: "dependent-checked-record-browser"
});
const revision = hosted.revision;
const revisions = {
	producer: revision, consumer: revision
	, checker: archiveCommit, archiver: archiveCommit
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
		, sha256: await dependentCheckedRecordHostedDigest(source), source
	});
};

const extracted = await extractDependentCheckedRecordHostedArtifact(
	selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-dependent-browser-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"dependent-checked-record-browser-ci"
		, "dependent-checked-record-browser-engine.log"
		, "dependent-checked-record-browser-runtime.log"
	]);
	const hostedRoot = join(
		extracted.root, "dependent-checked-record-browser-ci");
	assert.deepEqual((await readdir(hostedRoot)).sort()
		, ["records", "run.tap"]);
	assert.deepEqual((await readdir(join(hostedRoot, "records"))).sort()
		, [...dependentCheckedRecordRoutes].sort());
	const runTap = await readFile(join(hostedRoot, "run.tap"));
	let browserVersions;
	const runs = [];
	for(const route of dependentCheckedRecordRoutes)
	{
		const recordsRoot = join(hostedRoot, "records", route);
		const paths = await nativeArtifactPaths(recordsRoot);
		const options = {
			route, producer: revision, checker: archiveCommit
			, directory: recordsRoot, tap: join(hostedRoot, "run.tap")
		};
		const checked = await checkDependentCheckedRecordBrowserCiRecords(
			options, {
				tap: runTap.toString(), paths
				, read: path => readFile(join(recordsRoot, path))
			}
		);
		browserVersions ??= checked.browserVersions;
		assert.deepEqual(checked.browserVersions, browserVersions
			, `${route} browser identity`);
		for(const path of paths)
			await putFile(`${route}/records/${path}`, join(recordsRoot, path));
		const selection = dependentCheckedRecordSelection(route);
		runs.push({
			route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: paths.length
			, accepted: checked, tapSha256: sha256(runTap)
		});
	}
	await putFile("hosted/run.tap", join(hostedRoot, "run.tap"));
	await putFile("hosted/logs/engine.log", join(extracted.root
		, "dependent-checked-record-browser-engine.log"));
	await putFile("hosted/logs/runtime.log", join(extracted.root
		, "dependent-checked-record-browser-runtime.log"));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitDependentCheckedRecordHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = dependentCheckedRecordBrowserEvidenceSources(
		revisions);
	for(const source of selectedSources)
	{
		const original = dependentCheckedRecordHostedOriginal(
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
		, kind: "dependent-checked-record-browser-installed-v1"
		, producerCommit: revision, consumerCommit: revision
		, checkerCommit: archiveCommit, archiveCommit, browserVersions
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
			"The fixture carries a retained Nat bound beside a proof-erased Fin payload and rejects every below value that is not strictly less than its sibling bound."
			, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only npm APIs."
			, "Node JavaScript, strict TypeScript, Chromium, Firefox and WebKit execute source-free installed packages; browser contexts cover pages, React production and StrictMode, and dedicated workers."
			, "Complete component/runtime npm archives, receipts, reports, TAP, browser observations, workflow logs, GitHub API records and a byte-exact split of the original artifact ZIP are retained and independently replayed."
			, "External browser, Node, compiler, Nix and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
			, "This lane establishes installed npm/browser acceptance only; aggregate support promotion and other dependent checked-record hosts require separate evidence."
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
		assert.equal(await dependentCheckedRecordHostedDigest(target)
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
