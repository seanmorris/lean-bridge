#!/usr/bin/env node
/**
 * Freeze one successful hosted HostNull npm/browser artifact together with
 * its original ZIP, API provenance, complete package handoffs and sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, constants, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { hostNullReviewedIr } from "../tests/helpers/host-null-fixture.mjs";
import { checkHostNullJavaScriptHostedReport } from "../tests/helpers/host-null-javascript-hosted-report.mjs";
import {
	hostNullJavaScriptHostedEvidenceSources
	, hostNullJavaScriptHostedOriginal
} from "../tests/helpers/host-null-javascript-hosted-evidence-sources.mjs";
import {
	checkedRecordValueIndexHostedDigest as digestFile
	, extractCheckedRecordValueIndexHostedArtifact as extractArtifact
	, inspectCheckedRecordValueIndexHostedArtifact as inspectArtifact
	, parseCheckedRecordValueIndexHostedArchiveArgs as parseArgs
	, splitCheckedRecordValueIndexHostedArtifact as splitArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";

const usage = "Usage: archive-host-null-javascript-browser-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
let selected;
try
{ selected = parseArgs(process.argv.slice(2), usage); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }

const evidence = "docs/evidence/host-null-javascript-browser-20261029";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const runApi = JSON.parse(await readFile(selected["run-json"]));
assert.ok(["failure", "success"].includes(runApi.conclusion));
const conclusions = { run: runApi.conclusion, job: "success" };
const hosted = await inspectArtifact(selected, {
	workflow: ".github/workflows/consumer-matrix.yml"
	, jobName: "Node and browser npm consumers"
	, artifactPrefix: "host-null-node-browser", conclusions
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
		bytes: information.size, sha256: await digestFile(source), source
	});
};
const shape = ir => {
	const abi = createComponentPrivateAbi(ir);
	return {
		...abi
		, types: abi.types.toSorted((left, right) => left.id.localeCompare(right.id))
		, callbacks: abi.callbacks.toSorted((left, right) => left.id.localeCompare(right.id))
		, exports: abi.exports.toSorted((left, right) =>
			left.bindingId.localeCompare(right.bindingId))
	};
};

const extracted = await extractArtifact(selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(tmpdir(), "lean-bridge-host-null-zip-"));
try
{
	const reportBytes = await readFile(join(extracted.root, "report.json"));
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString(), canonicalJson(report), "report.json");
	const accepted = checkHostNullJavaScriptHostedReport(report);
	const expectedPaths = ["report.json"];
	for(const run of report.runs)
	{
		const root = join(extracted.root, run.path);
		const records = [
			"component-package-receipt.json", run.receipt.package.archive
			, run.receipt.runtime.archive, "verify-component-package-receipt.mjs"
		].sort();
		assert.deepEqual(await nativeArtifactPaths(root), records, run.path);
		const receiptBytes = await readFile(join(
			root, "component-package-receipt.json"));
		assert.deepEqual(JSON.parse(receiptBytes), run.receipt
			, `${run.path} receipt`);
		await verifyComponentPackageReceipt({
			receiptPath: join(root, "component-package-receipt.json")
		});
		const companion = JSON.parse(execFileSync(process.execPath, [
			join(root, "verify-component-package-receipt.mjs")
			, "--receipt", join(root, "component-package-receipt.json")
		], { encoding: "utf8" }));
		assert.equal(companion.verified, true);
		assert.equal(companion.package, "host-null-demo@1.0.0");
		const archive = join(root, run.receipt.package.archive);
		const irBytes = execFileSync("/usr/bin/tar", [
			"-xOf", archive, "package/metadata/binding-ir.json"
		], { maxBuffer: 16 * 1024 ** 2 });
		const ir = JSON.parse(irBytes);
		assert.deepEqual(shape(ir), shape(hostNullReviewedIr()), run.path);
		assert.doesNotMatch(irBytes.toString(), /(?:null|value)Constructor/u);
		const declarations = execFileSync("/usr/bin/tar", [
			"-xOf", archive, "package/index.d.ts"
		], { encoding: "utf8", maxBuffer: 4 * 1024 ** 2 });
		assert.match(declarations, /null/u);
		assert.doesNotMatch(declarations, /undefined/u);
		for(const path of records)
			expectedPaths.push(`${run.path}/${path}`);
	}
	assert.deepEqual((await nativeArtifactPaths(extracted.root)).sort()
		, expectedPaths.sort());
	for(const path of expectedPaths)
		await putFile(`artifact/${path}`, join(extracted.root, path));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitArtifact(selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = hostNullJavaScriptHostedEvidenceSources(revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, hostNullJavaScriptHostedOriginal(source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, descriptor]) => ({
		path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
	const index = {
		schemaVersion: 1, kind: "host-null-javascript-browser-installed-v1"
		, producerCommit: revision, consumerCommit: revision
		, checkerCommit: archiveCommit, archiveCommit
		, accepted, selectedSources, files
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(
				Object.entries(hosted.api).map(([name, item]) => [
					name, { bytes: item.bytes.length, sha256: item.sha256 }
				])
			)
			, artifact: {
				...hosted.hostedRun.artifact, members: extracted.entries
				, parts: parts.map(part => ({
					path: `hosted/artifact.zip.parts/${part.name}`
					, offset: part.offset, bytes: part.bytes, sha256: part.sha256
				}))
			}
		}
		, limitations: [
			"The explicit compiler-authenticated HostNull wrapper maps its null branch to host null and its payload branch directly to T; it remains distinct from Option and omitted parameters."
			, "Ordinary Lean source and independently reviewed Binding IR are exercised through source-free installed npm packages."
			, "Node JavaScript, strict TypeScript, Chromium, Firefox and WebKit cover parameters, results, record fields, callback parameters and callback results in pages, React StrictMode and dedicated workers."
			, "Complete component/runtime npm archives, receipts, verifiers, report, GitHub API records and a byte-exact split of the original artifact ZIP are retained and independently replayed."
			, "External browser, Node, compiler, Nix and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
			, "This archive establishes JavaScript/browser HostNull acceptance only; other downstream hosts and aggregate support promotion require separate evidence."
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
		assert.equal(await digestFile(target), descriptor.sha256, path);
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
