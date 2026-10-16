#!/usr/bin/env node
/**
 * Freeze accepted recursive checked-record Node and browser records once.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	mutualCheckedRecordNpmRoutes
} from "../tests/helpers/mutual-checked-record-npm-fixture.mjs";
import {
	mutualCheckedRecordChangedPaths
} from "../tests/helpers/mutual-checked-record-source-history.mjs";
import {
	mutualCheckedRecordNpmAddedPaths
	, mutualCheckedRecordNpmChangedPaths
} from "../tests/helpers/mutual-checked-record-npm-source-history.mjs";
import {
	checkMutualCheckedRecordBrowserReport
} from "../tests/helpers/mutual-checked-record-browser-report.mjs";

const evidence = "docs/evidence/mutual-checked-record-npm-browser-20261016";
const recordsRoot = "build/mutual-checked-record-npm";
const producerSources = [...new Set([
	...mutualCheckedRecordChangedPaths
	, ...mutualCheckedRecordNpmChangedPaths.filter(path =>
		path !== "docs/type-surface.v1.json")
	, ...mutualCheckedRecordNpmAddedPaths
	, "src/abi/component-recursive-abi.mjs"
	, "src/abi/component-recursive.mjs"
	, "src/build/canonical-build.mjs"
	, "src/build/component-refinement-mirrors.mjs"
	, "src/release/component-npm-package.mjs"
	, "src/release/component-package-receipt.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/refinement-engine.mjs"
	, "tests/helpers/mutual-checked-record-browser-fixture.mjs"
	, "tests/helpers/mutual-checked-record-browser.mjs"
	, "tests/helpers/mutual-checked-record-fixture.mjs"
	, "tests/helpers/mutual-checked-record-native-installed-tests.mjs"
	, "tests/helpers/mutual-checked-record-npm-installed-tests.mjs"
	, "tests/helpers/mutual-checked-record-npm-fixture.mjs"
	, "tests/mutual-checked-record-browser.test.mjs"
	, "tests/mutual-checked-records.test.mjs"
	, ...["browser.mjs", "c.c", "cpp.cpp", "javascript.mjs", "typescript.mts"]
		.map(path => `tests/fixtures/mutual-checked-record-consumers/${path}`)
	, ...["LICENSE", "MutualCheckedRecords.lean", "lakefile.toml"
		, "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/mutual-checked-records/${path}`)
])].sort();
const consumerSources = [
	"package.json", "package-lock.json", "site/serve.mjs"
	, "tests/fixtures/mutual-checked-record-consumers/browser.mjs"
	, "tests/fixtures/mutual-checked-record-consumers/javascript.mjs"
	, ...["plain", "react", "worker", "worker-main"]
		.map(path => `tests/fixtures/type-corpus/consumers/browser/${path}.mjs`)
	, "tests/helpers/mutual-checked-record-browser-fixture.mjs"
	, "tests/helpers/mutual-checked-record-browser.mjs"
	, "tests/helpers/mutual-checked-record-npm-fixture.mjs"
	, "tests/helpers/type-corpus.mjs"
	, "tests/helpers/type-corpus-browser.mjs"
	, "tests/helpers/type-corpus-browser-build.mjs"
	, "tests/mutual-checked-record-browser.test.mjs"
].sort();
const checkerSources = [
	"scripts/archive-mutual-checked-record-npm-browser.mjs"
	, "src/binding-ir/canonical.mjs", "src/capsule/node.mjs"
	, "tests/helpers/mutual-checked-record-browser-fixture.mjs"
	, "tests/helpers/mutual-checked-record-browser-report.mjs"
	, "tests/helpers/mutual-checked-record-npm-fixture.mjs"
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
	maxBuffer: 64 * 1024 * 1024
});
const paths = async (root, prefix = "") => {
	const result = [];
	for(const entry of await readdir(root, { withFileTypes: true }))
	{
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) result.push(...await paths(join(root, entry.name), relative));
		else if(entry.isFile()) result.push(relative);
		else assert.fail(`Unexpected retained record entry: ${relative}`);
	}
	return result.sort();
};

let producerCommit, consumerCommit, browserVersions;
const runs = [];
for(const route of mutualCheckedRecordNpmRoutes)
{
	const root = join(recordsRoot, route);
	const npm = JSON.parse(await readFile(join(root, "report.json")));
	const browser = JSON.parse(await readFile(join(root, "browser.json")));
	producerCommit ??= npm.producerCommit;
	consumerCommit ??= browser.consumerCommit;
	assert.equal(npm.producerCommit, producerCommit);
	assert.equal(browser.producerCommit, producerCommit);
	assert.equal(browser.consumerCommit, consumerCommit);
	const checked = await checkMutualCheckedRecordBrowserReport(
		path => readFile(join(root, path)), {
			route, producerCommit, consumerCommit, runtime
		}
	);
	browserVersions ??= checked.browserVersions;
	assert.deepEqual(checked.browserVersions, browserVersions);
	const recordPaths = await paths(root);
	for(const path of recordPaths)
		put(`${route}/records/${path}`, await readFile(join(root, path)));
	runs.push({
		route, producerCommit, consumerCommit, runtime
		, recordCount: recordPaths.length
		, npmReportSha256: checked.npmReportSha256
		, browserReportSha256: checked.browserReportSha256
		, nodeObservations: checked.nodeObservations
		, browserExecutions: checked.browserExecutions
		, lifecycleObservations: checked.lifecycleObservations
		, checksPerExecution: checked.expected.checks
		, rejectionsPerExecution: checked.expected.rejections
		, recoveriesPerExecution: checked.expected.recoveries
		, componentArchive: checked.receipt.package
		, runtimeArchive: checked.receipt.runtime
	});
}

const sourceSnapshots = [
	{ role: "producer", commit: producerCommit, paths: producerSources }
	, { role: "consumer", commit: consumerCommit, paths: consumerSources }
	, { role: "checker", commit: archiveCommit, paths: checkerSources }
];
for(const snapshot of sourceSnapshots)
	for(const path of snapshot.paths)
		put(`sources/${snapshot.role}/${path}`, original(snapshot.commit, path));

const index = {
	schemaVersion: 1, kind: "mutual-checked-record-npm-browser-installed-v1"
	, producerCommit, consumerCommit, archiveCommit, runtime, browserVersions
	, runs, sourceSnapshots
	, limitations: [
		"The archive authenticates local Linux x64 Node, strict TypeScript, Chromium, Firefox and WebKit execution; it does not claim hosted-runner acceptance."
		, "Acceptance covers the tested finite mutually recursive Envelope and Branch records/variants, transparent aliases, Array and Option copies; host cycles are rejected and traversal is bounded."
		, "Callback, owned, asynchronous and retained-identity positions remain separate requirements."
		, "Browser binaries, framework archives and generated deployments are represented by recorded identities and observations rather than copied."
		, "Constructor dispatch counts and peak memory remain unmeasured."
	]
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
};
for(const [path, bytes] of files)
{
	const target = join(evidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
}
await writeFile(join(evidence, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(`Archived ${files.size} original files for ${runs.length} routes at ${evidence}.\n`);
