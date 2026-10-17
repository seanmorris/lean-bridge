#!/usr/bin/env node
/**
 * Freeze one successful hosted inherited checked-record npm/browser artifact.
 * The archive is written only after every original route replays exactly.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import {
	checkInheritedCheckedRecordBrowserCiRecords
} from "../tests/helpers/inherited-checked-record-browser-ci-report.mjs";
import {
	inheritedCheckedRecordNpmRoutes,
	inheritedCheckedRecordNpmSelection
} from "../tests/helpers/inherited-checked-record-npm-fixture.mjs";
import {
	inheritedCheckedRecordBrowserEvidenceSources
	, inheritedCheckedRecordBrowserOriginal
} from "../tests/helpers/inherited-checked-record-browser-evidence-sources.mjs";

const usage = "Usage: archive-inherited-checked-record-browser-evidence.mjs --root /absolute/artifact/root --producer <commit> --npm-checker <commit> --consumer <commit> --checker <commit> --run-id <digits>";
const allowed = ["root", "producer", "npm-checker", "consumer", "checker", "run-id"];
const parse = args => {
	assert.equal(args.length, allowed.length * 2, usage);
	const selected = {};
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && value && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.ok(isAbsolute(selected.root), usage);
	for(const key of ["producer", "npm-checker", "consumer", "checker"])
		assert.match(selected[key], /^[a-f0-9]{40}$/u, usage);
	assert.match(selected["run-id"], /^[1-9][0-9]*$/u, usage);
	return selected;
};

let selected;
try
{ selected = parse(process.argv.slice(2)); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }

const evidence = "docs/evidence/inherited-checked-record-browser-20261017";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"], {
	stdio: "ignore"
}), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const revisions = {
	producer: selected.producer, npmChecker: selected["npm-checker"]
	, consumer: selected.consumer, checker: selected.checker
	, archiver: archiveCommit
};
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const runtime = JSON.parse(await readFile(join(
	selected.root, inheritedCheckedRecordNpmRoutes[0], "runtime-before.json"
)));
let browserVersions;
const runs = [];
for(const route of inheritedCheckedRecordNpmRoutes)
{
	const cellRoot = join(selected.root, route);
	const recordsRoot = join(selected.root, "records", route);
	const before = await readFile(join(cellRoot, "runtime-before.json"));
	const after = await readFile(join(cellRoot, "runtime-after.json"));
	assert.deepEqual(after, before, `${route} runtime drift`);
	assert.deepEqual(JSON.parse(before), runtime);
	const npmTap = await readFile(join(cellRoot, "npm.tap"));
	const browserTap = await readFile(join(cellRoot, "browser.tap"));
	const controlsTap = await readFile(join(cellRoot, "controls.tap"));
	const paths = await nativeArtifactPaths(recordsRoot);
	const options = {
		route, producer: selected.producer
		, "npm-checker": selected["npm-checker"], consumer: selected.consumer
		, checker: selected.checker, directory: recordsRoot
		, "npm-tap": join(cellRoot, "npm.tap")
		, "browser-tap": join(cellRoot, "browser.tap")
		, "controls-tap": join(cellRoot, "controls.tap")
		, runtime: join(cellRoot, "runtime-before.json")
	};
	const checked = await checkInheritedCheckedRecordBrowserCiRecords(options, {
		npmTap: npmTap.toString(), browserTap: browserTap.toString()
		, controlsTap: controlsTap.toString(), runtime, paths
		, read: path => readFile(join(recordsRoot, path))
	});
	browserVersions ??= checked.browserVersions;
	assert.deepEqual(checked.browserVersions, browserVersions);
	const verification = await readFile(join(cellRoot, "verification.json"));
	assert.equal(verification.toString(), canonicalJson(checked)
		, `${route} hosted checker output`);
	for(const path of paths)
		put(`${route}/records/${path}`, await readFile(join(recordsRoot, path)));
	for(const [name, bytes] of [
		["npm.tap", npmTap], ["browser.tap", browserTap]
		, ["controls.tap", controlsTap], ["runtime-before.json", before]
		, ["runtime-after.json", after], ["verification.json", verification]
	]) put(`${route}/${name}`, bytes);
	const selection = inheritedCheckedRecordNpmSelection(route);
	const record = path => files.get(`${route}/records/${path}`);
	runs.push({
		route, mode: selection.mode, resultOnly: selection.resultOnly
		, recordCount: paths.length, accepted: checked, controls: checked.controls
		, reportSha256: sha256(record("report.json"))
		, browserReportSha256: sha256(record("browser.json"))
		, npmControlsSha256: sha256(record("controls.json"))
		, browserControlsSha256: sha256(record("browser-controls.json"))
		, npmTapSha256: sha256(npmTap), browserTapSha256: sha256(browserTap)
		, controlsTapSha256: sha256(controlsTap), runtimeSha256: sha256(before)
		, verificationSha256: sha256(verification)
	});
}

const selectedSources = inheritedCheckedRecordBrowserEvidenceSources(revisions);
for(const source of selectedSources)
	put(`sources/${source.role}/${source.path}`
		, inheritedCheckedRecordBrowserOriginal(source.revision, source.path));
const runId = Number(selected["run-id"]);
const index = {
	schemaVersion: 1, kind: "inherited-checked-record-browser-installed-v1"
	, producerCommit: revisions.producer, npmCheckerCommit: revisions.npmChecker
	, consumerCommit: revisions.consumer, checkerCommit: revisions.checker
	, archiveCommit, runtime, browserVersions, loadCeiling: 8
	, hostedRun: {
		repository: "seanmorris/lean-bridge", runId
		, url: `https://github.com/seanmorris/lean-bridge/actions/runs/${runId}`
	}
	, runs, selectedSources
	, limitations: [
		"The fixture covers inherited parent subobjects, child checked fields, aliases, nested inheritance, repeated constructor selections and constructor-free results."
		, "Ordinary and independently reviewed sources are exercised in full and result-only npm packages."
		, "Node JavaScript, strict TypeScript, Chromium, Firefox and WebKit execute source-free installed packages; browser contexts cover plain pages, React production and StrictMode, and dedicated workers."
		, "Complete component/runtime npm archives, installed receipts, reports, controls, TAP streams and browser observations are retained. Browser binaries and generated deployment directories are represented by their recorded identities and observations."
		, "The evidence applies to the exact Linux x64 Node and browser versions recorded in this index. Other hosts require independent installed acceptance."
		, "The hosted workflow serializes the four route/mode selections and caps Lean, compiler and build parallelism; peak memory and constructor-dispatch counts are not measured."
		, "This archive establishes installed npm/browser behavior, not promotion into the public support inventory."
	]
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
};

await mkdir(evidence);
for(const [path, bytes] of files)
{
	const target = join(evidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(evidence, "index.json"), indexBytes, { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: evidence, files: files.size + 1
	, bytes: [...files.values()].reduce(
		(total, bytes) => total + bytes.length, indexBytes.length)
	, ...revisions
	, runId, indexSha256: sha256(indexBytes)
}));
