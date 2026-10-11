/**
 * Retain original ordinary/reviewed structural PHP-Wasm runs and their exact producer sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkStructuralSubtypePhpWasmReport, structuralSubtypePhpWasmRecords } from "../tests/helpers/structural-subtype-php-wasm-report.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 2, "Supply ordinary, then reviewed original prefixes");
const destination = "docs/evidence/structural-subtype-php-wasm-20261011";
await assert.rejects(access(destination), { code: "ENOENT" });
const runner = await readFile("build/run-structural-subtype-php-wasm.mjs"), files = new Map([["runner.mjs", runner]]), runs = [];
const source = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
for(const [index, prefix] of prefixes.entries())
{
	const route = index ? "reviewed" : "ordinary";
	assert.match(prefix, new RegExp(`^build/vo1444-structural-php-wasm-${route}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json");
	const tap = await readFile(prefix + ".tap"), runtime = await readFile(prefix + ".runtime.json");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assert.equal(start.route, route); assert.equal(start.runnerSha256, sha256(runner));
	assert.match(start.revision, /^[a-f0-9]{40}$/u);
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_WASM_TEST, "1");
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_WASM_ROUTES, route);
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_WASM_OUTPUT, prefix + "-records");
	assert.equal(start.command, "/usr/bin/taskset"); assert.equal(start.args[1], "3");
	assert.deepEqual(start.args.slice(3), ["--test", "--test-concurrency=1", "tests/helpers/structural-subtype-php-wasm-installed-tests.mjs"]);
	assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
	assert.equal(end.tapSha256, sha256(tap)); assert.equal(start.runtimeSha256, sha256(runtime));
	assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.match(tap.toString(), new RegExp(`^ok 1 - installed structural Subtypes PHP-Wasm ${route} reproduce and relocate$`, "mu"));
	assert.doesNotMatch(tap.toString(), /^not ok |# (?:SKIP|TODO)\b/mu);
	assert.ok(Date.parse(start.started) <= Date.parse(end.finished));
	const root = `${prefix}-records/${route}`, records = structuralSubtypePhpWasmRecords(route);
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...records].sort());
	const checked = await checkStructuralSubtypePhpWasmReport(path => readFile(join(root, path)), { route, producerCommit: start.revision });
	const report = JSON.parse(await readFile(join(root, "report.json")));
	assert.deepEqual(report.phpWasm.runtime, JSON.parse(runtime));
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap], ["runtime.json", runtime]]) files.set(`${route}/${name}`, bytes);
	for(const path of records) files.set(`${route}/records/${path}`, await readFile(join(root, path)));
	runs.push({ ...checked, label: route, tapSha256: sha256(tap), reportSha256: sha256(await readFile(join(root, "report.json"))) });
}
assert.equal(new Set(runs.map(run => run.producerCommit)).size, 1);
const producerCommit = runs[0].producerCommit;
const selectedSources = [
	"src/analyze/NativeExports.lean", "src/build/native-model.mjs"
	, "src/build/component-refinements.mjs", "src/build/elaborated-component.mjs"
	, "src/build/canonical-build.mjs", "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, ...["copied-values.mjs", "copied-conversions.mjs"
		, "copied-model.mjs"
		, "copied-support.mjs", "php-wasm-copied-loader.mjs"
		, "brick-math.mjs"
		, "brick-math.source.json"].map(path => `src/backends/php/${path}`)
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/structural-subtype-installed.test.mjs"
	, ...["structural-subtype-installed-fixture.mjs"
		, "structural-subtype-php-fixture.mjs", "structural-subtype-php-model.php"
		, "structural-subtype-php-wasm-fixture.mjs"
		, "structural-subtype-php-wasm-tests.mjs"
		, "structural-subtype-php-wasm-installed-tests.mjs"
		, "copied-fixture-install.mjs", "brick-math.mjs"
		, "type-corpus-php-wasm-install.mjs", "type-corpus-php-wasm-browser.mjs"
		, "type-corpus-php-wasm-evidence.mjs"].map(path => `tests/helpers/${path}`)
	, "tests/fixtures/structural-subtype-consumers/php-native.php"
	, ...["php-wasm", "php-wasm-node", "php-wasm-browser"].map(name => `tests/fixtures/type-corpus/consumers/${name}.mjs`)
	, ...["StructuralSubtypes.lean", "lakefile.toml", "lean-toolchain"
		, "package.json"
		, "LICENSE"].map(path => `tests/fixtures/onboarding/structural-subtypes/${path}`)
];
for(const path of selectedSources) files.set(`sources/${path}`, source(producerCommit, path));
files.set("checker.mjs", await readFile("tests/helpers/structural-subtype-php-wasm-report.mjs"));
const index = {
	schemaVersion: 1, kind: "structural-subtype-php-wasm-installed-v1"
	, producerCommit, runs, selectedSources
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local wasm32 PHP 8.4.1 Node/Chromium acceptance, not hosted acceptance."
		, "No entry counts or memory measurement for these unmodified packages."
		, "Package binaries and full toolchain closures are not retained."
		, "No support promotion or mandatory recurring installed CI is claimed here."] };
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
