#!/usr/bin/env node
/**
 * Freeze one successful hosted PHP-Wasm zero-payload artifact after replaying
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
	assertZeroPayloadPhpWasmCompilerTap, checkZeroPayloadPhpWasmCiRecords
} from "../tests/helpers/zero-payload-checked-record-php-wasm-ci-report.mjs";
import {
	zeroPayloadPhpRoutes
} from "../tests/helpers/zero-payload-checked-record-php-fixture.mjs";
import {
	checkZeroPayloadPhpWasmModel
} from "../tests/helpers/zero-payload-checked-record-php-wasm-fixture.mjs";
import {
	zeroPayloadHostedOriginal, zeroPayloadPhpWasmEvidenceSources
} from "../tests/helpers/zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	zeroPayloadHostedDigest
	, extractZeroPayloadHostedArtifact
	, inspectZeroPayloadHostedArtifact
	, parseZeroPayloadHostedArchiveArgs
	, splitZeroPayloadHostedArtifact
} from "../tests/helpers/zero-payload-checked-record-hosted-archive.mjs";

const usage = "Usage: archive-zero-payload-checked-record-php-wasm-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
let selected;
try
{
	selected = parseZeroPayloadHostedArchiveArgs(process.argv.slice(2), usage);
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}

const evidence = "docs/evidence/zero-payload-checked-record-php-wasm-20261021";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectZeroPayloadHostedArtifact(selected, {
	workflow: ".github/workflows/zero-payload-checked-record-php-wasm.yml"
	, jobName: "Four zero-payload checked-record routes in PHP-Wasm"
	, artifactPrefix: "zero-payload-checked-record-php-wasm"
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
		, sha256: await zeroPayloadHostedDigest(source), source
	});
};
const extracted = await extractZeroPayloadHostedArtifact(selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-php-wasm-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"zero-payload-checked-record-php-wasm-ci"
		, "zero-payload-checked-record-php-wasm-host.log"
		, "zero-payload-checked-record-php-wasm-input"
		, "zero-payload-checked-record-php-wasm-runtime.log"
	]);
	const hostedRoot = join(extracted.root
		, "zero-payload-checked-record-php-wasm-ci");
	assert.deepEqual((await readdir(hostedRoot)).sort()
		, ["compiler", ...zeroPayloadPhpRoutes].sort());
	const compiler = join(hostedRoot, "compiler");
	assert.deepEqual((await readdir(compiler)).sort(), [
		"check.log", "records", "run.tap"
	]);
	const compilerTap = await readFile(join(compiler, "run.tap"));
	assertZeroPayloadPhpWasmCompilerTap(compilerTap.toString());
	assert.equal((await readFile(join(compiler, "check.log"))).toString()
		, "Four fresh-Lean zero-payload PHP-Wasm compiler tests passed without skips.\n");
	const observations = [...compilerTap.toString().matchAll(/^# (\{.*\})$/gmu)]
		.map(match => JSON.parse(match[1]));
	assert.equal(observations.length, zeroPayloadPhpRoutes.length);
	for(const [index, route] of zeroPayloadPhpRoutes.entries())
	{
		const root = join(compiler, "records", route);
		assert.deepEqual((await readdir(root)).sort(), [
			"adapters.lean", "generated.c", "model.json", "provider.c"
		]);
		const modelBytes = await readFile(join(root, "model.json"));
		const model = JSON.parse(modelBytes);
		assert.equal(modelBytes.toString(), canonicalJson(model), route);
		checkZeroPayloadPhpWasmModel(model, route);
		assert.equal(sha256(await readFile(join(root, "generated.c")))
			, observations[index].generatedCSha256, route);
		for(const path of await nativeArtifactPaths(root))
			await putFile(`compiler/records/${route}/${path}`, join(root, path));
	}
	await putFile("compiler/run.tap", join(compiler, "run.tap"));
	await putFile("compiler/check.log", join(compiler, "check.log"));
	const runs = []; let runtime;
	for(const route of zeroPayloadPhpRoutes)
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
		const checked = await checkZeroPayloadPhpWasmCiRecords({
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
		, "zero-payload-checked-record-php-wasm-input/php-wasm-runtime/runtime.json");
	const retainedRuntimeBytes = await readFile(retainedRuntime);
	assert.equal(retainedRuntimeBytes.toString(), canonicalJson(runtime));
	await putFile("hosted/runtime/runtime.json", retainedRuntime);
	await putFile("hosted/logs/host.log", join(extracted.root
		, "zero-payload-checked-record-php-wasm-host.log"));
	await putFile("hosted/logs/runtime.log", join(extracted.root
		, "zero-payload-checked-record-php-wasm-runtime.log"));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitZeroPayloadHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = zeroPayloadPhpWasmEvidenceSources(revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, zeroPayloadHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, descriptor]) => ({
			path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1
		, kind: "zero-payload-checked-record-php-wasm-installed-v1"
		, producerCommit: revision, consumerCommit: revision
		, checkerCommit: revision, archiveCommit, runtime
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(Object.entries(hosted.api).map(([name, item]) => [
				name, { bytes: item.bytes.length, sha256: item.sha256 }
			]))
			, artifact: {
				...hosted.hostedRun.artifact, members: extracted.entries
				, parts: parts.map(({ name, offset, bytes, sha256: digest }) => ({
					path: `hosted/artifact.zip.parts/${name}`
					, offset, bytes, sha256: digest
				}))
			}
		}
		, compiler: {
			routes: zeroPayloadPhpRoutes, observations
			, tapSha256: sha256(compilerTap)
		}
		, runs, selectedSources, files
		, limitations: [
			"The fixture covers proof-only Witness, Unit-bearing Token, empty Marker, Option, arrays and both inhabited and empty Mark branches."
			, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only npm and Composer APIs."
			, "Weak and strict PHP callers run across embedded and Composer arrangements, startup and lazy loading, Node and Chromium."
			, "Fresh wasm32 compiler controls authenticate each route before installed-package execution."
			, "The complete runtime, component and API archives, receipt, deployment records, compiler probes, execution records, TAP, build logs, GitHub API records and a byte-exact split of the original artifact ZIP are retained."
			, "The browser runtime uses pinned PHP-Wasm and Emscripten toolchains; external Lean, Nix, Chromium and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
			, "This lane establishes installed PHP-Wasm acceptance only; aggregate support promotion requires separate evidence."
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
		assert.equal(await zeroPayloadHostedDigest(target)
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
