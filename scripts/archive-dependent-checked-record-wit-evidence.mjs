#!/usr/bin/env node
/**
 * Freeze one successful hosted dependent checked-record WIT artifact after
 * replaying every retained record through the archive-authenticating checker.
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
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	dependentCheckedRecordSelection
} from "../tests/helpers/dependent-checked-record-browser-fixture.mjs";
import {
	checkDependentCheckedRecordWitCiRecords
} from "../tests/helpers/dependent-checked-record-wit-ci-report.mjs";
import {
	dependentCheckedRecordWitRoutes
} from "../tests/helpers/dependent-checked-record-wit-fixture.mjs";
import {
	inspectDependentCheckedRecordWitHandoff
} from "../tests/helpers/dependent-checked-record-wit-handoff.mjs";
import {
	dependentCheckedRecordHostedOriginal
	, dependentCheckedRecordWitEvidenceSources
} from "../tests/helpers/dependent-checked-record-hosted-evidence-sources.mjs";
import {
	dependentCheckedRecordHostedDigest
	, extractDependentCheckedRecordHostedArtifact
	, inspectDependentCheckedRecordHostedArtifact
	, parseDependentCheckedRecordHostedArchiveArgs
	, splitDependentCheckedRecordHostedArtifact
} from "../tests/helpers/dependent-checked-record-hosted-archive.mjs";

const usage = "Usage: archive-dependent-checked-record-wit-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
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

const evidence = "docs/evidence/dependent-checked-record-wit-20261021";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectDependentCheckedRecordHostedArtifact(selected, {
	workflow: ".github/workflows/dependent-checked-record-wit.yml"
	, jobName: "Four dependent checked-record checked-record routes through Wasmtime"
	, artifactPrefix: "dependent-checked-record-wit"
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
		, sha256: await dependentCheckedRecordHostedDigest(source), source
	});
};
const extracted = await extractDependentCheckedRecordHostedArtifact(
	selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-dependent-wit-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"dependent-checked-record-wit-ci"
		, "dependent-checked-record-wit-toolchain.log"
	]);
	const hostedRoot = join(extracted.root, "dependent-checked-record-wit-ci");
	assert.deepEqual((await readdir(hostedRoot)).sort()
		, ["tools.json", ...dependentCheckedRecordWitRoutes].sort());
	const runs = [];
	let runtime, tools;
	for(const route of dependentCheckedRecordWitRoutes)
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
		assert.equal(verification.toString(), canonicalJson(observed)
			, `${route} checker output`);
		runtime ??= observed.runtime;
		tools ??= observed.tools;
		assert.deepEqual(observed.runtime, runtime, `${route} runtime identity`);
		assert.deepEqual(observed.tools, tools, `${route} tool identity`);
		const read = path => readFile(join(recordsRoot, path));
		const original = await inspectDependentCheckedRecordWitHandoff(read);
		const selection = dependentCheckedRecordSelection(route);
		const mode = selection.resultOnly ? "result-only" : "full";
		const checked = await checkDependentCheckedRecordWitCiRecords({
			route, mode, producer: revision, directory: recordsRoot
			, tap: join(cell, "run.tap"), glibc: observed.floor
			, cc: observed.tools.selected.cc
			, "wasm-tools": observed.tools.selected.wasmTools
			, "wasmtime-capi": observed.tools.selected.wasmtimeCapi
		}, {
			tap: tap.toString(), runtime: observed.runtime
			, read: path => original.supplements.get(path) ?? read(path)
			, tools: observed.tools, archiveSha256: original.archiveSha256
		});
		assert.equal(verification.toString(), canonicalJson(checked)
			, `${route} checker replay`);
		assert.deepEqual(paths, [
			...checked.records.filter(path => !original.supplements.has(path))
			, original.archivePath
		].sort());
		for(const path of paths)
			await putFile(`${route}/records/${path}`, join(recordsRoot, path));
		for(const name of ["run.tap", "verification.json"])
			await putFile(`${route}/${name}`, join(cell, name));
		runs.push({
			route, mode, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: paths.length
			, accepted: checked, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
	}
	await putFile("hosted/logs/toolchain.log", join(extracted.root
		, "dependent-checked-record-wit-toolchain.log"));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitDependentCheckedRecordHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = dependentCheckedRecordWitEvidenceSources(revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, dependentCheckedRecordHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, descriptor]) => ({
			path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1, kind: "dependent-checked-record-wit-installed-v1"
		, producerCommit: revision, consumerCommit: revision
		, checkerCommit: revision, archiveCommit, runtime, tools
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(
				Object.entries(hosted.api).map(([name, item]) => [
					name, { bytes: item.bytes.length, sha256: item.sha256 }
				])
			)
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
		, runs, selectedSources, files
		, limitations: [
			"The fixture carries a retained Nat bound beside a proof-erased Fin payload and rejects every below value that is not strictly less than its sibling bound."
			, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only WIT component APIs."
			, "The independent native Wasmtime caller covers invalid relations, recovery, immutable inputs and a Nat wider than 128 bits."
			, "Every route is reproduced twice, installed from the retained source-free archive and executed before and after relocation."
			, "The complete component archive, receipt, generated projections, caller binary, records, TAP, toolchain log, GitHub API records and original artifact ZIP are retained."
			, "The component requires the recorded Wasmtime host and glibc 2.38 floor; compiler, Nix and operating-system distributions remain trusted recorded inputs."
			, "This lane establishes installed WIT acceptance only; aggregate support promotion and other hosts require separate evidence."
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
