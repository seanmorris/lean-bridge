/**
 * Preserve two original structural PHP installed runs with exact producer sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkStructuralSubtypePhpReport, structuralSubtypePhpRecords } from "../tests/helpers/structural-subtype-php-report.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 2, "Supply ordinary, then reviewed prefixes");
const destination = "docs/evidence/structural-subtype-php-20261011";
await assert.rejects(access(destination), { code: "ENOENT" });
const runner = await readFile("build/run-structural-subtype-php.mjs"), files = new Map([["runner.mjs", runner]]), runs = [];
const source = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
for(const [index, prefix] of prefixes.entries())
{
	const route = index ? "reviewed" : "ordinary", label = route;
	assert.match(prefix, new RegExp(`^build/vo1444-structural-php-${route}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assert.equal(start.route, route); assert.equal(start.runnerSha256, sha256(runner));
	assert.match(start.revision, /^[a-f0-9]{40}$/u);
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_TEST, "1");
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_ROUTES, route);
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_OUTPUT, prefix + "-records");
	assert.equal(start.command, "/usr/bin/taskset"); assert.equal(start.args[1], "3");
	assert.equal(start.args.at(-1), "tests/helpers/structural-subtype-php-installed-tests.mjs");
	assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
	assert.equal(end.tapSha256, sha256(tap));
	assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.match(tap.toString(), new RegExp(`ok 1 - installed structural Subtypes PHP ${route} reproduce and relocate`, "u"));
	assert.ok(Date.parse(start.started) <= Date.parse(end.finished));
	const root = `${prefix}-records/${route}`;
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...structuralSubtypePhpRecords].sort());
	const checked = await checkStructuralSubtypePhpReport(path => readFile(join(root, path)), { route, producerCommit: start.revision });
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${name}`, bytes);
	for(const path of structuralSubtypePhpRecords) files.set(`${label}/records/${path}`, await readFile(join(root, path)));
	runs.push({ ...checked, label, tapSha256: sha256(tap), reportSha256: sha256(await readFile(join(root, "report.json"))) });
}
assert.equal(new Set(runs.map(run => run.producerCommit)).size, 1);
const producerCommit = runs[0].producerCommit;
const selectedSources = [
	"src/analyze/NativeExports.lean", "src/build/native-model.mjs"
	, "src/build/component-refinements.mjs", "src/build/native-component.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, ...["copied-values.mjs", "copied-conversions.mjs", "copied-model.mjs"
		, "copied-assets.mjs", "copied-support.mjs", "brick-math.mjs"
		, "brick-math.source.json"].map(path => `src/backends/php/${path}`)
	, "src/build/native-php-artifacts.mjs", "src/release/native-composer.mjs"
	, "tests/structural-subtype-installed.test.mjs"
	, "tests/helpers/structural-subtype-installed-fixture.mjs"
	, "tests/helpers/structural-subtype-php-fixture.mjs"
	, "tests/helpers/structural-subtype-php-installed-tests.mjs"
	, "tests/helpers/structural-subtype-php-tests.mjs"
	, "tests/helpers/structural-subtype-php-model.php"
	, "tests/helpers/copied-fixture-install.mjs", "tests/helpers/brick-math.mjs"
	, "tests/helpers/fin-container-edge-php-closure.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/closed-package-zip.mjs"
	, "tests/fixtures/structural-subtype-consumers/php-native.php"
	, ...["StructuralSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(path => `tests/fixtures/onboarding/structural-subtypes/${path}`)
];
for(const path of selectedSources) files.set(`sources/${path}`, source(producerCommit, path));

files.set("checker.mjs", await readFile("tests/helpers/structural-subtype-php-report.mjs"));
const index = {
	schemaVersion: 1, kind: "structural-subtype-php-installed-v1"
	, producerCommit, runs, selectedSources
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local Linux x86-64 glibc 2.36 acceptance, not hosted release-floor acceptance."
		, "No PHP constructor/source entry counts or memory measurement."
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
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
