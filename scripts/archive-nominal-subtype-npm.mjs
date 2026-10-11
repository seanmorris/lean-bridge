/**
 * Preserve the four original nominal npm package runs and selected producer sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkNominalSubtypeNpmReport, nominalSubtypeNpmRecordPaths } from "../tests/helpers/nominal-subtype-npm-report.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 4, "Supply ordinary/full, ordinary/result-only, reviewed/full, reviewed/result-only prefixes");
const destination = "docs/evidence/nominal-subtype-npm-20261011";
await assert.rejects(access(destination), { code: "ENOENT" });
const selections = [["ordinary", "full"], ["ordinary", "result-only"], ["reviewed", "full"], ["reviewed", "result-only"]];
const files = new Map(), runs = [];
const original = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
const runner = await readFile("build/run-nominal-subtype-npm.mjs");
files.set("runner.mjs", runner);
const runtime = { node: "v22.23.2", platform: "linux", arch: "x64" };
for(const [index, prefix] of prefixes.entries())
{
	const [route, mode] = selections[index], label = `${route}/${mode}`;
	assert.match(prefix, new RegExp(`^build/vo1444-nominal-npm-${route}-${mode}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assert.equal(start.route, route); assert.equal(start.mode, mode); assert.match(start.revision, /^[a-f0-9]{40}$/u);
	assert.equal(start.runnerSha256, sha256(runner));
	assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST, "1");
	assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ROUTES, route);
	assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_MODES, mode);
	assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_OUTPUT, prefix + "-records");
	assert.equal(start.command, "/usr/bin/nice");
	assert.deepEqual(start.args.slice(0, 8), ["-n", "19", "/usr/bin/ionice", "-c", "3", "/usr/bin/taskset", "-c", "3"]);
	assert.deepEqual(start.args.slice(9), ["--test", "--test-concurrency=1", "tests/helpers/nominal-subtype-npm-installed-tests.mjs"]);
	assert.ok(start.initial.freeMiB >= 2048 && start.initial.availableMiB >= 2048 && start.initial.load < 6);
	assert.ok(end.minimum.freeMiB >= 768 && end.minimum.availableMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]);
	assert.equal(end.tapSha256, sha256(tap));
	assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.ok(tap.toString().includes(`ok 1 - installed npm nominal Subtypes reproduce and relocate ${route} ${mode}\n`));
	assert.ok(Date.parse(start.started) < Date.parse(end.finished));
	const root = `${prefix}-records/${label}`, paths = await nativeArtifactPaths(root);
	assert.deepEqual(paths.slice().sort(), nominalSubtypeNpmRecordPaths(mode).sort());
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${name}`, bytes);
	for(const path of paths) files.set(`${label}/records/${path}`, await readFile(join(root, path)));
	const checked = await checkNominalSubtypeNpmReport(path => readFile(join(root, path)), { route, mode, producerCommit: start.revision, runtime });
	runs.push({ ...checked, label, prefix, started: start.started
		, finished: end.finished, tapSha256: sha256(tap)
		, reportSha256: sha256(await readFile(join(root, "report.json"))) });
}
const chronological = runs.slice().sort((left, right) => left.started.localeCompare(right.started));
for(let index = 1; index < chronological.length; index++)
	assert.ok(Date.parse(chronological[index - 1].finished) <= Date.parse(chronological[index].started), "Producers did not overlap");
const producerCommit = runs[0].producerCommit;
assert.ok(runs.every(run => run.producerCommit === producerCommit));
const selectedSources = [
	"src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean", "src/analyze/native-types.mjs"
	, "src/analyze/export-configuration.mjs", "src/analyze/reviewed-subtypes.mjs"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/build/component-refinements.mjs", "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-refinement-mirrors.mjs"
	, "src/build/component-recursive-adapters.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-fin-guards.mjs", "src/build/refinement-mirrors.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/release/component-npm-package.mjs"
	, "src/release/component-package-receipt.mjs"
	, "tests/helpers/nominal-subtype-npm-installed-tests.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture-tests.mjs"
	, "tests/helpers/nominal-subtype-caller-model.mjs"
	, "tests/helpers/structural-subtype-npm-package.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/refinement-engine.mjs"
	, "tests/fixtures/nominal-subtype-consumers/javascript.mjs"
	, "tests/fixtures/nominal-subtype-consumers/index.mts"
	, "tests/fixtures/nominal-subtype-consumers/results.mts"
	, "tests/fixtures/structural-subtype-consumers/javascript.mjs"
	, ...["NominalSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(path => `tests/fixtures/onboarding/nominal-subtypes/${path}`)
];
for(const path of selectedSources) files.set(`sources/${path}`, original(producerCommit, path));
files.set("checker.mjs", await readFile("tests/helpers/nominal-subtype-npm-report.mjs"));
const index = { schemaVersion: 1, kind: "nominal-subtype-npm-installed-v1"
	, producerCommit, runs, selectedSources
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Only ordinary/reviewed full and result-only Node and strict TypeScript nominal fixtures."
		, "Runtime observation is Node 22.23.2 on Linux x64; no other runtime floor is inferred."
		, "Constructor/source dispatch and memory usage are unmeasured."
		, "Package binaries and full toolchain closures are not retained; original receipts and installed-file hashes are retained."
		, "No browser, hosted acceptance, support-cell promotion or required recurring gate follows from this archive."] };
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
