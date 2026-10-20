#!/usr/bin/env node
/**
 * Freeze one successful hosted PHP-Wasm value-index artifact after replaying
 * every compiler and installed-package record from retained bytes.
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
	assertCheckedRecordValueIndexPhpWasmCompilerTap
	, checkCheckedRecordValueIndexPhpWasmCiRecords
} from "../tests/helpers/checked-record-value-index-php-wasm-ci-report.mjs";
import {
	checkedRecordValueIndexBrowserRoutes
} from "../tests/helpers/checked-record-value-index-browser-fixture.mjs";
import {
	checkCheckedRecordValueIndexPhpWasmModel
} from "../tests/helpers/checked-record-value-index-php-wasm-fixture.mjs";
import {
	checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexPhpWasmEvidenceSources
} from "../tests/helpers/checked-record-value-index-hosted-evidence-sources.mjs";
import {
	checkedRecordValueIndexHostedDigest
	, extractCheckedRecordValueIndexHostedArtifact
	, inspectCheckedRecordValueIndexHostedArtifact
	, parseCheckedRecordValueIndexHostedArchiveArgs
	, splitCheckedRecordValueIndexHostedArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";

const usage = "Usage: archive-checked-record-value-index-php-wasm-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
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

const evidence = "docs/evidence/checked-record-value-index-php-wasm-20261020";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectCheckedRecordValueIndexHostedArtifact(selected, {
	workflow: ".github/workflows/checked-record-value-index-php-wasm.yml"
	, jobName: "Four value-index checked-record routes in PHP-Wasm"
	, artifactPrefix: "checked-record-value-index-php-wasm"
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
	const information = await stat(source); assert.ok(information.isFile(), source);
	descriptors.set(path, {
		bytes: information.size
		, sha256: await checkedRecordValueIndexHostedDigest(source), source
	});
};
const extracted = await extractCheckedRecordValueIndexHostedArtifact(
	selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-php-wasm-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"checked-record-value-index-php-wasm-ci"
		, "checked-record-value-index-php-wasm-host.log"
		, "checked-record-value-index-php-wasm-input"
		, "checked-record-value-index-php-wasm-runtime.log"
	]);
	const hostedRoot = join(extracted.root
		, "checked-record-value-index-php-wasm-ci");
	assert.deepEqual((await readdir(hostedRoot)).sort()
		, ["compiler", ...checkedRecordValueIndexBrowserRoutes].sort());
	const compiler = join(hostedRoot, "compiler");
	assert.deepEqual((await readdir(compiler)).sort(), [
		"check.log", "records", "run.tap"
	]);
	const compilerTap = await readFile(join(compiler, "run.tap"));
	assertCheckedRecordValueIndexPhpWasmCompilerTap(compilerTap.toString());
	assert.equal((await readFile(join(compiler, "check.log"))).toString()
		, "Four fresh-Lean value-index PHP-Wasm compiler tests passed without skips.\n");
	const observations = [...compilerTap.toString().matchAll(/^# (\{.*\})$/gmu)]
		.map(match => JSON.parse(match[1]));
	assert.equal(observations.length, checkedRecordValueIndexBrowserRoutes.length);
	for(const [index, route] of checkedRecordValueIndexBrowserRoutes.entries())
	{
		const root = join(compiler, "records", route);
		assert.deepEqual((await readdir(root)).sort(), [
			"adapters.lean", "generated.c", "model.json", "provider.c"
		]);
		const modelBytes = await readFile(join(root, "model.json"));
		const model = JSON.parse(modelBytes);
		assert.equal(modelBytes.toString(), canonicalJson(model), route);
		checkCheckedRecordValueIndexPhpWasmModel(model, route);
		assert.equal(sha256(await readFile(join(root, "generated.c")))
			, observations[index].generatedCSha256, route);
		for(const path of await nativeArtifactPaths(root))
			await putFile(`compiler/records/${route}/${path}`, join(root, path));
	}
	await putFile("compiler/run.tap", join(compiler, "run.tap"));
	await putFile("compiler/check.log", join(compiler, "check.log"));
	const runs = []; let runtime;
	for(const route of checkedRecordValueIndexBrowserRoutes)
	{
		const cell = join(hostedRoot, route);
		assert.deepEqual((await readdir(cell)).sort(), [
			"check.log", "records", "run.tap"
		]);
		const recordsRoot = join(cell, "records", route);
		const paths = await nativeArtifactPaths(recordsRoot);
		const tap = await readFile(join(cell, "run.tap"));
		const verification = await readFile(join(cell, "check.log"));
		const observed = JSON.parse(verification);
		assert.equal(verification.toString(), canonicalJson(observed)
			, `${route} checker output`);
		const read = path => readFile(join(recordsRoot, path));
		const checked = await checkCheckedRecordValueIndexPhpWasmCiRecords({
			route, producer: revision, directory: recordsRoot
			, tap: join(cell, "run.tap")
		}, { tap: tap.toString(), read });
		assert.equal(verification.toString(), canonicalJson(checked)
			, `${route} checker replay`);
		assert.equal(paths.length, checked.records, route);
		const report = JSON.parse(await read("report.json"));
		runtime ??= report.phpWasm.runtime;
		assert.deepEqual(report.phpWasm.runtime, runtime, `${route} runtime`);
		for(const path of paths)
			await putFile(`${route}/records/${path}`, join(recordsRoot, path));
		for(const name of ["run.tap", "check.log"])
			await putFile(`${route}/${name}`, join(cell, name));
		runs.push({
			route, recordCount: paths.length, accepted: checked
			, tapSha256: sha256(tap), verificationSha256: sha256(verification)
		});
	}
	const retainedRuntime = join(extracted.root
		, "checked-record-value-index-php-wasm-input/php-wasm-runtime/runtime.json");
	const retainedRuntimeBytes = await readFile(retainedRuntime);
	assert.equal(retainedRuntimeBytes.toString(), canonicalJson(runtime));
	await putFile("hosted/runtime/runtime.json", retainedRuntime);
	await putFile("hosted/logs/host.log", join(extracted.root
		, "checked-record-value-index-php-wasm-host.log"));
	await putFile("hosted/logs/runtime.log", join(extracted.root
		, "checked-record-value-index-php-wasm-runtime.log"));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitCheckedRecordValueIndexHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = checkedRecordValueIndexPhpWasmEvidenceSources(revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, checkedRecordValueIndexHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, descriptor]) => ({
			path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1, kind: "checked-record-value-index-php-wasm-installed-v1"
		, producerCommit: revision, consumerCommit: revision
		, checkerCommit: revision, archiveCommit, runtime
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(Object.entries(hosted.api).map(([name, item]) => [
				name, { bytes: item.bytes.length, sha256: item.sha256 }
			]))
			, artifact: {
				...hosted.hostedRun.artifact, members: extracted.entries
				, parts: parts.map(({
					name, offset, bytes, sha256: digest
				}) => ({
					path: `hosted/artifact.zip.parts/${name}`
					, offset, bytes, sha256: digest
				}))
			}
		}
		, compiler: {
			routes: checkedRecordValueIndexBrowserRoutes
			, observations, tapSha256: sha256(compilerTap)
		}
		, runs, selectedSources, files
		, limitations: [
			"The fixture covers closed Bool, String and Nat value indices through ordinary Lean source and independently reviewed Binding IR."
			, "Full and result-only npm/Composer APIs execute in weak and strict PHP modes across embedded and Composer arrangements, startup and lazy loading, Node and Chromium."
			, "The complete runtime, component and API archives, receipt, deployment records, compiler probes, execution records, TAP, build logs and GitHub API records are retained and independently authenticated."
			, "The browser runtime uses the pinned PHP-Wasm and Emscripten toolchains; external Lean, Nix, Chromium and operating-system distributions remain represented by recorded identities rather than copied toolchains."
			, "This lane establishes installed PHP-Wasm acceptance only; aggregate support promotion and other host targets require separate evidence."
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
		assert.equal(await checkedRecordValueIndexHostedDigest(target)
			, descriptor.sha256, path);
	}
	const indexBytes = Buffer.from(canonicalJson(index));
	await writeFile(join(evidence, "index.json"), indexBytes, { flag: "wx" });
	process.stdout.write(canonicalJson({
		destination: evidence, files: files.length + 1
		, bytes: files.reduce((sum, file) => sum + file.bytes, indexBytes.length)
		, ...revisions, hostedRun: index.hostedRun
		, indexSha256: sha256(indexBytes)
	}));
}
finally
{
	await rm(extracted.root, { recursive: true });
	await rm(partsRoot, { recursive: true });
}
