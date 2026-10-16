#!/usr/bin/env node
/**
 * Freeze the accepted nested checked-record npm and browser records once.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nestedCheckedRecordChangedPaths } from "../tests/helpers/nested-checked-record-source-history.mjs";
import {
	nestedCheckedRecordNpmRoutes,
	nestedCheckedRecordNpmSelection
} from "../tests/helpers/nested-checked-record-npm-fixture.mjs";
import {
	checkNestedCheckedRecordBrowserReport,
	nestedCheckedRecordBrowserRecordPaths
} from "../tests/helpers/nested-checked-record-browser-report.mjs";

const evidence = "docs/evidence/nested-checked-record-browser-20261016";
const recordsRoot = "build/vo1477-nested-checked-record-npm-r1";
const producerSources = [...new Set([
	...nestedCheckedRecordChangedPaths
	, "src/build/canonical-build.mjs", "src/release/component-npm-package.mjs"
	, "src/release/component-package-receipt.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/refinement-engine.mjs"
	, "tests/helpers/nested-checked-record-fixture.mjs"
	, "tests/helpers/nested-checked-record-npm-fixture.mjs"
	, "tests/helpers/nested-checked-record-npm-installed-tests.mjs"
	, "tests/helpers/nested-checked-record-npm-report.mjs"
	, ...["javascript.mjs", "full.mts", "result-only.mts"]
		.map(path => `tests/fixtures/nested-checked-record-consumers/${path}`)
	, ...["NestedCheckedRecords.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"]
		.map(path => `tests/fixtures/onboarding/nested-checked-records/${path}`)
])].sort();
const consumerSources = [
	"package.json", "package-lock.json", "site/serve.mjs"
	, "tests/fixtures/nested-checked-record-consumers/browser.mjs"
	, ...["plain", "react", "worker", "worker-main"]
		.map(path => `tests/fixtures/type-corpus/consumers/browser/${path}.mjs`)
	, "tests/helpers/type-corpus.mjs", "tests/helpers/type-corpus-browser.mjs"
	, "tests/helpers/type-corpus-browser-build.mjs"
	, "tests/helpers/nested-checked-record-browser-fixture.mjs"
	, "tests/helpers/nested-checked-record-browser.mjs"
	, "tests/helpers/nested-checked-record-browser-report.mjs"
	, "tests/nested-checked-record-browser.test.mjs"
].sort();
const checkerSources = [
	"src/binding-ir/canonical.mjs", "src/capsule/node.mjs"
	, "tests/helpers/nested-checked-record-npm-fixture.mjs"
	, "tests/helpers/nested-checked-record-npm-report.mjs"
	, "tests/helpers/nested-checked-record-browser-fixture.mjs"
	, "tests/helpers/nested-checked-record-browser-report.mjs"
	, "tests/helpers/nested-checked-record-browser-controls.mjs"
	, "tests/nested-checked-record-browser-controls.test.mjs"
].sort();

assert.equal(process.argv.length, 2, "The frozen archive takes no arguments");
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"], {
	stdio: "ignore"
}), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const runtime = { node: process.version, platform: process.platform, arch: process.arch };
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path);
	files.set(path, Buffer.from(bytes));
};
const original = (commit, path) => execFileSync("git", ["show", `${commit}:${path}`], {
	maxBuffer: 32 * 1024 * 1024
});
const canonical = bytes => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value));
	return value;
};

let producerCommit, consumerCommit, checkerCommit, browserVersions;
const runs = [];
for(const route of nestedCheckedRecordNpmRoutes)
{
	const root = join(recordsRoot, route);
	const npmBytes = await readFile(join(root, "report.json"));
	const npm = canonical(npmBytes);
	const browserBytes = await readFile(join(root, "browser.json"));
	const browser = canonical(browserBytes);
	const npmControlBytes = await readFile(join(root, "controls.json"));
	const npmControls = canonical(npmControlBytes);
	const browserControlBytes = await readFile(join(root, "browser-controls.json"));
	const browserControls = canonical(browserControlBytes);
	producerCommit ??= npm.producerCommit;
	consumerCommit ??= browser.consumerCommit;
	checkerCommit ??= browserControls.checkerCommit;
	assert.equal(npm.producerCommit, producerCommit);
	assert.equal(browser.producerCommit, producerCommit);
	assert.equal(browser.consumerCommit, consumerCommit);
	assert.equal(browserControls.checkerCommit, checkerCommit);
	const checked = await checkNestedCheckedRecordBrowserReport(
		path => readFile(join(root, path)), {
			route, producerCommit, consumerCommit, runtime
		}
	);
	assert.deepEqual(browserControls.accepted, checked);
	browserVersions ??= checked.browserVersions;
	assert.deepEqual(checked.browserVersions, browserVersions);
	const mode = nestedCheckedRecordNpmSelection(route).mode;
	const paths = nestedCheckedRecordBrowserRecordPaths(mode, npm.receipt);
	assert.equal(new Set(paths).size, paths.length);
	for(const path of paths)
		put(`${route}/records/${path}`, await readFile(join(root, path)));
	put(`${route}/records/controls.json`, npmControlBytes);
	put(`${route}/records/browser-controls.json`, browserControlBytes);
	assert.equal(npmControls.recordControls, 64);
	assert.equal(npmControls.reportControls, 10);
	assert.equal(npmControls.adapterControls, mode === "full" ? 7 : 4);
	assert.equal(browserControls.recordControls, paths.length * 2);
	assert.equal(browserControls.npmReportControls, 10);
	assert.equal(browserControls.npmAdapterControls, mode === "full" ? 7 : 4);
	assert.equal(browserControls.browserControls, 162);
	runs.push({
		route, mode, producerCommit, consumerCommit, checkerCommit, runtime
		, recordCount: paths.length + 2, counts: checked
		, reportSha256: sha256(npmBytes), browserReportSha256: sha256(browserBytes)
		, npmControlsSha256: sha256(npmControlBytes)
		, browserControlsSha256: sha256(browserControlBytes)
		, controls: {
			record: browserControls.recordControls
			, npmReport: browserControls.npmReportControls
			, npmAdapter: browserControls.npmAdapterControls
			, browser: browserControls.browserControls
		}
	});
}

const sourceSnapshots = [
	{ role: "producer", commit: producerCommit, paths: producerSources }
	, { role: "consumer", commit: consumerCommit, paths: consumerSources }
	, { role: "checker", commit: checkerCommit, paths: checkerSources }
	, { role: "archive", commit: archiveCommit
		, paths: ["scripts/archive-nested-checked-record-browser.mjs"] }
];
for(const snapshot of sourceSnapshots)
	for(const path of snapshot.paths)
		put(`sources/${snapshot.role}/${path}`, original(snapshot.commit, path));

const index = {
	schemaVersion: 1, kind: "nested-checked-record-browser-installed-v1"
	, producerCommit, consumerCommit, checkerCommit, archiveCommit
	, runtime, browserVersions, loadCeiling: 8
	, runs, sourceSnapshots
	, limitations: [
		"The fixture covers checked records whose fields contain Fin and checked Subtype values, including arrays, lists, options, products, Except branches, enclosing records and variants, repeated parameters and constructor-free results."
		, "Generic records, recursive records, callbacks, owned values and dependent refinements require their own acceptance evidence."
		, "Complete reproduced npm component/runtime archives and every npm/browser report input are retained. React framework archives, browser binaries and generated deployment directories are represented by recorded identities and execution observations rather than copied."
		, "The producer, browser consumer and destructive checker are separate frozen revisions. Absolute build paths describe the original local Linux x64 run and are not CI prerequisites."
		, "The local runs do not establish hosted acceptance. Constructor dispatch counts and peak memory were not measured."
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
	, producerCommit, consumerCommit, checkerCommit, archiveCommit
	, indexSha256: sha256(indexBytes)
}));
