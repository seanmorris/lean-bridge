/**
 * Archive all four checked-record browser routes at their original producer revisions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkedRecordBrowserRoutes } from "../tests/helpers/checked-record-browser-fixture.mjs";
import { checkCheckedRecordBrowserReport, checkedRecordBrowserRecords } from "../tests/helpers/checked-record-browser-report.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 4, "Supply ordinary, reviewed, result-only ordinary and result-only reviewed prefixes");
const destination = "docs/evidence/checked-record-browser-20261011";
await assert.rejects(access(destination), { code: "ENOENT" });
const runner = await readFile("build/run-checked-record-browser.mjs");
const files = new Map([["runner.mjs", runner]]), runs = [];
const source = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
for(const [index, prefix] of prefixes.entries())
{
	const route = checkedRecordBrowserRoutes[index];
	assert.match(prefix, new RegExp(`^build/vo1446-checked-browser-${route}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assert.equal(start.route, route); assert.equal(start.runnerSha256, sha256(runner));
	assert.match(start.revision, /^[a-f0-9]{40}$/u); assert.ok(prefix.endsWith(start.revision.slice(0, 7)));
	assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_TEST, "1");
	assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_BROWSER_TEST, "1");
	assert.equal(start.environment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, "chromium,firefox,webkit");
	assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_ROUTES, route);
	assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_OUTPUT, prefix + "-records");
	assert.equal(start.command, "/usr/bin/taskset");
	assert.deepEqual(start.args.slice(0, 2), ["-c", "3"]);
	assert.deepEqual(start.args.slice(3), ["--test", "--test-reporter=tap", "--test-concurrency=1", "tests/helpers/checked-record-browser-installed-tests.mjs"]);
	assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
	assert.equal(end.tapSha256, sha256(tap));
	assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.match(tap.toString(), new RegExp(`ok 1 - installed npm checked records reproduce and relocate ${route}`, "u"));
	assert.ok(Date.parse(start.started) <= Date.parse(end.finished));
	const root = `${prefix}-records/${route}`;
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...checkedRecordBrowserRecords].sort());
	const checked = await checkCheckedRecordBrowserReport(path => readFile(join(root, path)), { route, producerCommit: start.revision });
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${route}/${name}`, bytes);
	for(const path of checkedRecordBrowserRecords) files.set(`${route}/records/${path}`, await readFile(join(root, path)));
	runs.push({ ...checked, tapSha256: sha256(tap), reportSha256: sha256(await readFile(join(root, "report.json"))) });
}
const producerCommits = [...new Set(runs.map(run => run.producerCommit))];
const selectedSources = [
	"package-lock.json", "schema/compiler-adapter-plan.schema.json"
	, "src/analyze/NativeExports.lean", "src/analyze/elaborated-metadata.mjs"
	, "src/build/component-refinements.mjs", "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/release/component-npm-package.mjs"
	, "src/release/component-package-receipt.mjs"
	, "tests/checked-records.test.mjs", "tests/helpers/checked-record-fixture.mjs"
	, ...["fixture", "installed-tests", "npm-report", "report", "tests"].map(name => `tests/helpers/checked-record-browser-${name}.mjs`)
	, "tests/helpers/checked-record-browser.mjs"
	, "tests/helpers/structural-subtype-npm-package.mjs"
	, "tests/helpers/type-corpus-browser.mjs"
	, "tests/helpers/type-corpus-browser-build.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/refinement-engine.mjs"
	, "tests/helpers/lake-workspace.mjs", "tests/helpers/json-schema.mjs"
	, ...["javascript.mjs", "browser.mjs", "full.mts", "result-only.mts"].map(name => `tests/fixtures/checked-record-browser/${name}`)
	, ...["plain", "react", "worker-main", "worker"].map(name => `tests/fixtures/type-corpus/consumers/browser/${name}.mjs`)
	, ...["CheckedRecords.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(name => `tests/fixtures/onboarding/checked-records/${name}`)
];
assert.equal(new Set(selectedSources).size, selectedSources.length);
for(const revision of producerCommits) for(const path of selectedSources)
	files.set(`sources/${revision}/${path}`, source(revision, path));
for(const name of ["npm-report", "report"])
	files.set(`checkers/${name}.mjs`, await readFile(`tests/helpers/checked-record-browser-${name}.mjs`));
const index = {
	schemaVersion: 1, kind: "checked-record-browser-installed-v1"
	, producerCommits, runs, selectedSources
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local Linux Node and Chromium/Firefox/WebKit acceptance, not hosted acceptance."
		, "No constructor/source entry counts or memory measurement."
		, "Package binaries and complete toolchain closures are not retained."
		, "No support-inventory promotion or recurring installed CI gate follows from this archive."]
};
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommits, indexSha256: sha256(canonicalJson(index)) }));
