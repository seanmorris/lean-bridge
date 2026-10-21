#!/usr/bin/env node
/**
 * Freeze one successful hosted Rust dependent checked-record artifact. Every route is
 * replayed from its original crate, vendored dependency closure and retained
 * execution records before any evidence is written.
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
	dependentCheckedRecordRustCiReader
	, checkDependentCheckedRecordRustCiRecords
} from "../tests/helpers/dependent-checked-record-rust-ci-report.mjs";
import {
	dependentCheckedRecordRustRoutes
} from "../tests/helpers/dependent-checked-record-rust-fixture.mjs";
import {
	dependentCheckedRecordSelection
} from "../tests/helpers/dependent-checked-record-browser-fixture.mjs";
import {
	dependentCheckedRecordHostedOriginal
	, dependentCheckedRecordRustEvidenceSources
} from "../tests/helpers/dependent-checked-record-hosted-evidence-sources.mjs";
import {
	dependentCheckedRecordHostedDigest
	, extractDependentCheckedRecordHostedArtifact
	, inspectDependentCheckedRecordHostedArtifact
	, parseDependentCheckedRecordHostedArchiveArgs
	, splitDependentCheckedRecordHostedArtifact
} from "../tests/helpers/dependent-checked-record-hosted-archive.mjs";

const usage = "Usage: archive-dependent-checked-record-rust-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
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

const evidence = "docs/evidence/dependent-checked-record-rust-20261021";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectDependentCheckedRecordHostedArtifact(selected, {
	workflow: ".github/workflows/dependent-checked-record-rust.yml"
	, jobName: "Four dependent checked-record selections in Rust"
	, artifactPrefix: "dependent-checked-record-rust"
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
		, sha256: await dependentCheckedRecordHostedDigest(source), source
	});
};
const extracted = await extractDependentCheckedRecordHostedArtifact(
	selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-dependent-rust-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"dependent-checked-record-rust-ci"
		, "dependent-checked-record-rust-toolchain.log"
	]);
	const hostedRoot = join(
		extracted.root, "dependent-checked-record-rust-ci");
	assert.deepEqual((await readdir(hostedRoot)).sort()
		, [...dependentCheckedRecordRustRoutes].sort());
	const runs = []; let runtime, toolchain;
	for(const route of dependentCheckedRecordRustRoutes)
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
		toolchain ??= observed.toolchain;
		assert.deepEqual(observed.runtime, runtime, `${route} runtime identity`);
		assert.deepEqual(observed.toolchain, toolchain
			, `${route} toolchain identity`);
		const read = await dependentCheckedRecordRustCiReader(
			path => readFile(join(recordsRoot, path)));
		const checked = await checkDependentCheckedRecordRustCiRecords({
			route, producer: revision, directory: recordsRoot
			, tap: join(cell, "run.tap"), glibc: observed.floor
			, rustc: toolchain.rustc.command, cargo: toolchain.cargo.command
		}, { tap: tap.toString(), read, runtime, toolchain });
		assert.equal(verification.toString(), canonicalJson(checked)
			, `${route} checker replay`);
		for(const path of paths)
			await putFile(`${route}/records/${path}`, join(recordsRoot, path));
		for(const name of ["run.tap", "verification.json"])
			await putFile(`${route}/${name}`, join(cell, name));
		const selection = dependentCheckedRecordSelection(route);
		runs.push({
			route, reviewed: selection.reviewed
			, resultOnly: selection.resultOnly, recordCount: paths.length
			, accepted: checked, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
	}
	await putFile("hosted/logs/toolchain.log", join(extracted.root
		, "dependent-checked-record-rust-toolchain.log"));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitDependentCheckedRecordHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = dependentCheckedRecordRustEvidenceSources(revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, dependentCheckedRecordHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, descriptor]) => ({
			path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1, kind: "dependent-checked-record-rust-installed-v1"
		, producerCommit: revision, consumerCommit: revision
		, checkerCommit: revision, archiveCommit, runtime, toolchain
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
		, runs, selectedSources, files
		, limitations: [
			"The fixture carries a runtime bound Nat beside a proof-erased Fin payload and rejects every observed below value that is not strictly less than its sibling bound."
			, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only Rust crate APIs."
			, "The independent Rust caller covers valid values, equality and zero-bound refusals, recovery, immutable inputs and a Nat wider than 128 bits."
			, "Each route reproduces a complete crate twice, removes author roots, installs with an authenticated vendored dependency closure, replays after relocation and executes one source-free binary."
			, "The complete crate, dependency closure, receipts, generated sources, caller binary, execution records, TAP, toolchain log, GitHub API records and a byte-exact split of the original artifact ZIP are retained."
			, "The native crate floor is glibc 2.38; external Rust, Cargo, linker, Lean and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
			, "This lane establishes installed Rust acceptance only; aggregate support promotion and other host targets require separate evidence."
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
