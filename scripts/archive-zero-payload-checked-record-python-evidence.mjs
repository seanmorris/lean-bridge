#!/usr/bin/env node
/**
 * Freeze one successful hosted Python zero-payload artifact. Every route is
 * replayed from its original wheel and interpreter records before evidence is
 * written.
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
	checkZeroPayloadPythonCiRecords
} from "../tests/helpers/zero-payload-checked-record-python-ci-report.mjs";
import {
	zeroPayloadPythonRoutes, zeroPayloadPythonSelection
} from "../tests/helpers/zero-payload-checked-record-python-fixture.mjs";
import {
	zeroPayloadHostedOriginal, zeroPayloadPythonEvidenceSources
} from "../tests/helpers/zero-payload-checked-record-hosted-evidence-sources.mjs";
import {
	zeroPayloadHostedDigest
	, extractZeroPayloadHostedArtifact
	, inspectZeroPayloadHostedArtifact
	, parseZeroPayloadHostedArchiveArgs
	, splitZeroPayloadHostedArtifact
} from "../tests/helpers/zero-payload-checked-record-hosted-archive.mjs";

const usage = "Usage: archive-zero-payload-checked-record-python-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
let selected;
try
{
	selected = parseZeroPayloadHostedArchiveArgs(process.argv.slice(2), usage);
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}

const evidence = "docs/evidence/zero-payload-checked-record-python-20261021";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectZeroPayloadHostedArtifact(selected, {
	workflow: ".github/workflows/zero-payload-checked-record-python.yml"
	, jobName: "Four zero-payload checked-record routes on both Python floors"
	, artifactPrefix: "zero-payload-checked-record-python"
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
const check = async (route, records, tap, observed, paths) => {
	const args = [
		"--route", route, "--producer", revision, "--directory", records
		, "--tap", tap, "--glibc", observed.floor
	];
	const rechecked = await checkZeroPayloadPythonCiRecords(args, {
		tap: await readFile(tap, "utf8")
		, read: path => readFile(join(records, path))
		, runtime: observed.runtime
	});
	assert.ok(paths.length >= rechecked.records, `${route} retained records`);
	return rechecked;
};
const extracted = await extractZeroPayloadHostedArtifact(selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-zero-payload-python-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"zero-payload-checked-record-python-ci"
		, "zero-payload-checked-record-python-engine.log"
	]);
	const hostedRoot = join(extracted.root, "zero-payload-checked-record-python-ci");
	assert.deepEqual((await readdir(hostedRoot)).sort()
		, [...zeroPayloadPythonRoutes].sort());
	const runs = []; let runtime;
	for(const route of zeroPayloadPythonRoutes)
	{
		const cell = join(hostedRoot, route);
		assert.deepEqual((await readdir(cell)).sort(), [
			"records", "run.tap", "verification.json"
		]);
		const recordsRoot = join(cell, "records", route);
		const paths = await nativeArtifactPaths(recordsRoot);
		const tap = await readFile(join(cell, "run.tap"));
		const verification = await readFile(join(cell, "verification.json"));
		const observed = JSON.parse(verification);
		assert.equal(verification.toString(), `${JSON.stringify(observed, null, 2)}\n`
			, `${route} checker output`);
		runtime ??= observed.runtime;
		assert.deepEqual(observed.runtime, runtime, `${route} runtime identity`);
		const rechecked = await check(route, recordsRoot, join(cell, "run.tap")
			, observed, paths);
		assert.deepEqual(observed, rechecked, `${route} checker replay`);
		assert.equal(verification.toString(), `${JSON.stringify(rechecked, null, 2)}\n`
			, `${route} checker replay bytes`);
		for(const path of paths)
			await putFile(`${route}/records/${path}`, join(recordsRoot, path));
		for(const name of ["run.tap", "verification.json"])
			await putFile(`${route}/${name}`, join(cell, name));
		const selection = zeroPayloadPythonSelection(route);
		runs.push({
			route, reviewed: selection.reviewed, resultOnly: selection.resultOnly
			, recordCount: paths.length, accepted: rechecked
			, tapSha256: sha256(tap), verificationSha256: sha256(verification)
		});
	}
	await putFile("hosted/logs/engine.log", join(extracted.root
		, "zero-payload-checked-record-python-engine.log"));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitZeroPayloadHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = zeroPayloadPythonEvidenceSources(revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, zeroPayloadHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, descriptor]) => ({
			path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1, kind: "zero-payload-checked-record-python-installed-v1"
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
		, runs, selectedSources, files
		, limitations: [
			"The fixture covers proof-only Witness, Unit-bearing Token, empty Marker, Option, arrays and both inhabited and empty Mark branches."
			, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only Python wheel APIs."
			, "An independent Python caller checks exact classes, accepted constructors, refused constructors and recovery after each refusal."
			, "One reproducible wheel executes after author removal, offline installation and physical relocation on CPython 3.11 and 3.12 across four closed routes."
			, "Complete wheels, package members, receipts, interpreter records, TAP, engine log, GitHub API records and a byte-exact split of the original artifact ZIP are retained."
			, "The wheel floor is manylinux glibc 2.38; external Python, pip, Lean, Nix and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
			, "This lane establishes installed Python acceptance only; aggregate support promotion requires separate evidence."
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
