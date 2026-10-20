#!/usr/bin/env node
/**
 * Freeze one successful hosted value-indexed checked-record Perl artifact.
 * Each route is independently replayed before evidence bytes are retained.
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
	checkCheckedRecordValueIndexPerlCiRecords
} from "../tests/helpers/checked-record-value-index-perl-ci-report.mjs";
import {
	checkedRecordValueIndexPerlRoutes, checkedRecordValueIndexPerlSelection
} from "../tests/helpers/checked-record-value-index-perl-fixture.mjs";
import {
	checkedRecordValueIndexHostedOriginal
	, checkedRecordValueIndexPerlEvidenceSources
} from "../tests/helpers/checked-record-value-index-hosted-evidence-sources.mjs";
import {
	checkedRecordValueIndexHostedDigest
	, extractCheckedRecordValueIndexHostedArtifact
	, inspectCheckedRecordValueIndexHostedArtifact
	, parseCheckedRecordValueIndexHostedArchiveArgs
	, splitCheckedRecordValueIndexHostedArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";

const usage = "Usage: archive-checked-record-value-index-perl-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
let selected;
try
{
	selected = parseCheckedRecordValueIndexHostedArchiveArgs(process.argv.slice(2), usage);
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}

const evidence = "docs/evidence/checked-record-value-index-perl-20261019";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectCheckedRecordValueIndexHostedArtifact(selected, {
	workflow: ".github/workflows/checked-record-value-index-perl.yml"
	, jobName: "Four ABI value-indexed checked-record CPAN matrix"
	, artifactPrefix: "checked-record-value-index-perl"
});
const revision = hosted.revision;
const revisions = {
	producer: revision
	, consumer: revision
	, checker: revision
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
		, sha256: await checkedRecordValueIndexHostedDigest(source)
		, source
	});
};
const extracted = await extractCheckedRecordValueIndexHostedArtifact(selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-perl-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"checked-record-value-index-perl-ci"
		, "checked-record-value-index-perl-toolchain.log"
	]);
	const hostedRoot = join(extracted.root, "checked-record-value-index-perl-ci");
	assert.deepEqual((await readdir(hostedRoot)).sort()
		, [...checkedRecordValueIndexPerlRoutes].sort());
	let runtime, interpreters;
	const runs = [];
	for(const route of checkedRecordValueIndexPerlRoutes)
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
		assert.deepEqual(observed.runtime, runtime, `${route} runtime identity`);
		const routeInterpreters = JSON.parse(await readFile(join(
			recordsRoot, "interpreters.json")));
		interpreters ??= routeInterpreters;
		assert.deepEqual(routeInterpreters, interpreters, `${route} interpreter identity`);
		const checked = await checkCheckedRecordValueIndexPerlCiRecords({
			route, producer: revision, directory: recordsRoot
			, glibc: observed.floor, maxLoad: observed.maxLoad
			, tap: tap.toString(), read: path => readFile(join(recordsRoot, path))
			, paths, runtime, interpreters
		});
		assert.equal(verification.toString(), canonicalJson(checked)
			, `${route} checker replay`);
		for(const path of paths)
			await putFile(`${route}/records/${path}`, join(recordsRoot, path));
		await putFile(`${route}/run.tap`, join(cell, "run.tap"));
		await putFile(`${route}/verification.json`, join(cell, "verification.json"));
		const selection = checkedRecordValueIndexPerlSelection(route);
		runs.push({
			route, reviewed: selection.reviewed, resultOnly: selection.resultOnly
			, recordCount: paths.length, accepted: checked, tapSha256: sha256(tap)
			, verificationSha256: sha256(verification)
		});
	}
	await putFile("hosted/logs/toolchain.log", join(
		extracted.root, "checked-record-value-index-perl-toolchain.log"));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitCheckedRecordValueIndexHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = checkedRecordValueIndexPerlEvidenceSources(revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, checkedRecordValueIndexHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, descriptor]) => ({
			path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1, kind: "checked-record-value-index-perl-installed-v1"
		, producerCommit: revision, consumerCommit: revision, checkerCommit: revision
		, archiveCommit, runtime, interpreters
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(Object.entries(hosted.api).map(([name, item]) => [
				name, { bytes: item.bytes.length, sha256: item.sha256 }
			]))
			, artifact: {
				...hosted.hostedRun.artifact, members: extracted.entries
				, parts: parts.map(({ name, offset, bytes, sha256: digest }) => ({
					path: `hosted/artifact.zip.parts/${name}`, offset, bytes, sha256: digest
				}))
			}
		}
		, runs, selectedSources, files
		, limitations: [
			"The fixture covers closed Bool, String and Nat value indices: both booleans, empty and Unicode strings, zero and a Nat wider than 64 bits."
			, "Ordinary Lean source and independently reviewed Binding IR are exercised through full and result-only CPAN APIs."
			, "Independent Perl callers execute packages after author removal, offline installation, physical relocation and source removal across four ABI configurations and two CPAN installation modes."
			, "Complete CPAN archives, receipts, reports, TAP, toolchain log, GitHub API records and a byte-exact split of the original artifact ZIP are retained."
			, "The package floor is glibc 2.38; external Perl, C compiler, Lean and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
			, "This lane establishes installed Perl acceptance only; aggregate support promotion and other value-index hosts require separate evidence."
		]
	};
	await mkdir(evidence);
	for(const [path, descriptor] of descriptors)
	{
		const target = join(evidence, path); await mkdir(dirname(target), { recursive: true });
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
		, ...revisions, hostedRun: index.hostedRun, indexSha256: sha256(indexBytes)
	}));
}
finally
{
	await rm(extracted.root, { recursive: true });
	await rm(partsRoot, { recursive: true });
}
