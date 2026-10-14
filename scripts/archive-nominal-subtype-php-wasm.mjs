/**
 * Retain original nominal PHP-Wasm packages, frozen inputs and installed observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkNominalSubtypePhpWasmReport } from "../tests/helpers/nominal-subtype-php-wasm-report.mjs";
import { checkNominalSubtypePhpWasmControls } from "../tests/helpers/nominal-subtype-php-wasm-controls.mjs";
import { assertNominalSubtypePhpWasmRun, nominalSubtypePhpWasmSelections } from "../tests/helpers/nominal-subtype-php-wasm-provenance.mjs";
import { nominalSubtypePhpWasmOriginal, nominalSubtypePhpWasmSnapshot, nominalSubtypePhpWasmGeneratorClosure } from "../tests/helpers/nominal-subtype-php-wasm-sources.mjs";
import { waitNominalSubtypeDotnetResources } from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";

const arguments_ = process.argv.slice(2), check = arguments_[0] === "--check";
const roots = check ? arguments_.slice(1) : arguments_;
assert.equal(roots.length, 4, "Supply ordinary/full, ordinary/result-only, reviewed/full and reviewed/result-only run directories");
const producerCommit = "d121427862a7235b4e5e4a35a2355e56fc0f61f4";
const root = "docs/evidence/nominal-subtype-php-wasm-20261014";
if(!check) await assert.rejects(access(root), { code: "ENOENT" });
const snapshot = nominalSubtypePhpWasmSnapshot(producerCommit);
const generatorClosure = nominalSubtypePhpWasmGeneratorClosure(producerCommit);
const selectedSources = [...new Set([
	...generatorClosure
	, "src/analyze/NativeExports.lean"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "src/release/deterministic-archive.mjs"
	, "src/release/deterministic-zip.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-fixture.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-installed-tests.mjs"
	, "tests/helpers/nominal-subtype-php-fixture.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture.mjs"
	, "tests/fixtures/nominal-subtype-consumers/php-native.php"
	, "tests/fixtures/onboarding/nominal-subtypes/NominalSubtypes.lean"
	, "tests/helpers/type-corpus-php-wasm-install.mjs"
	, "tests/helpers/type-corpus-php-wasm-browser.mjs"
	, "tests/helpers/type-corpus-php-wasm-evidence.mjs"
	, "tests/helpers/type-corpus-php-source.mjs"
	, "tests/helpers/type-corpus-php.mjs"
	, "tests/helpers/php-wasm-fin-direct-report.mjs"
	, "tests/helpers/php-wasm-fin-fixtures.mjs"
	, "tests/helpers/nominal-subtype-php-provenance.mjs"
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/closed-package-zip.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-archives.mjs"
	, "tests/fixtures/type-corpus/consumers/php-wasm.mjs"
	, "tests/fixtures/type-corpus/consumers/php-wasm-node.mjs"
	, "tests/fixtures/type-corpus/consumers/php-wasm-browser.mjs"
])].sort();
const checkers = ["controls", "provenance", "report", "sources"].map(name => `tests/helpers/nominal-subtype-php-wasm-${name}.mjs`).sort();
const saved = new Map(), runs = [];
const save = (path, bytes) => { assert.ok(!saved.has(path), path); saved.set(path, Buffer.from(bytes)); };
const runner = await readFile("build/vo1457-php-wasm-installed-runner.mjs"); save("runner.mjs", runner);
for(const path of selectedSources)
{
	const bytes = nominalSubtypePhpWasmOriginal(producerCommit, path);
	assert.equal(sha256(bytes), snapshot[path]); save("sources/" + path, bytes);
}
for(const path of checkers) save("checkers/" + path, await readFile(path));
for(const [index, [route, mode]] of nominalSubtypePhpWasmSelections.entries())
{
	await waitNominalSubtypeDotnetResources("build", { notify: console.log });
	const label = `${route}-${mode}`, prefix = roots[index], records = prefix + `/records/${route}/${mode}`;
	assert.match(prefix, new RegExp(`^build/vo1457-php-wasm-installed-${label}-r[1-9][0-9]*-${producerCommit.slice(0, 7)}$`, "u"));
	const paths = await nativeArtifactPaths(records), originals = new Map();
	for(const path of paths) originals.set(path, await readFile(records + "/" + path));
	const options = { route, mode, producerCommit };
	const checked = await checkNominalSubtypePhpWasmReport(async path => originals.get(path), options);
	assert.deepEqual(checked.records, paths);
	const controls = await checkNominalSubtypePhpWasmControls(originals, options);
	for(const [path, bytes] of originals) save(`${label}/records/${path}`, bytes);
	const launch = {};
	for(const path of ["preflight.json", "start.json", "end.json", "independent-runtime.json", "run.tap"])
	{
		const bytes = await readFile(prefix + "/" + path); save(`${label}/${path}`, bytes);
		launch[path.endsWith(".json") ? path.slice(0, -5) : path] = path.endsWith(".json") ? JSON.parse(bytes) : bytes;
		if(path.endsWith(".json")) assert.equal(bytes.toString(), canonicalJson(JSON.parse(bytes)));
	}
	const { start, end, preflight } = launch, report = JSON.parse(originals.get("report.json"));
	assert.deepEqual(start.sources, snapshot);
	assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_OUTPUT, resolve(prefix, "records"));
	assert.deepEqual(start.runtime, { node: "v22.23.2", platform: "linux", arch: "x64" });
	assertNominalSubtypePhpWasmRun({ ...options, start, end, preflight
		, independentRuntime: launch["independent-runtime"], tap: launch["run.tap"]
		, runner, runtime: start.runtime, report });
	if(index) assert.ok(Date.parse(runs[index - 1].finished) <= Date.parse(start.started));
	runs.push({ ...checked, label, controls, runtime: start.runtime
		, started: start.started, finished: end.finished, tapSha256: end.tapSha256
		, reportSha256: sha256(originals.get("report.json"))
		, browserVersion: report.phpWasm.browserVersion });
	process.stdout.write(canonicalJson({ label, records: paths.length, controls, executions: checked.executions }));
}
const index = { schemaVersion: 1, kind: "nominal-subtype-php-wasm-installed-v1"
	, producerCommit, sourceSnapshotCount: Object.keys(snapshot).length
	, generatorClosure, selectedSources, checkers, runs
	, files: [...saved].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) };
for(const [path, bytes] of saved)
{
	if(check) assert.deepEqual(await readFile(root + "/" + path), bytes);
	else
	{
		await mkdir(dirname(root + "/" + path), { recursive: true });
		await writeFile(root + "/" + path, bytes, { flag: "wx" });
	}
}
const bytes = Buffer.from(canonicalJson(index));
if(check) assert.deepEqual(await readFile(root + "/index.json"), bytes);
else await writeFile(root + "/index.json", bytes, { flag: "wx" });
assert.deepEqual(await nativeArtifactPaths(root), [...saved.keys(), "index.json"].sort());
process.stdout.write(canonicalJson({ root, indexSha256: sha256(bytes)
	, files: saved.size + 1, sourceSnapshotCount: index.sourceSnapshotCount
	, runs: runs.length
	, recordsBytes: [...saved.values()].reduce((total, bytes) => total + bytes.length, 0) }));
