/**
 * Authenticate the original local direct Fin producer and all installed execution modes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { assertPhpWasmDirectFinReport, phpWasmDirectChecks, phpWasmDirectReportInputs } from "./php-wasm-fin-direct-report.mjs";

export const phpWasmDirectArchiveRoot = "docs/evidence/php-wasm-fin-direct-20261010";
export const phpWasmDirectProducer = "ccb44b24d17b96bd3327cb976b6d45921f7f3af2";
export const phpWasmDirectSourcePaths = [
	"tests/helpers/php-wasm-fin-direct-tests.mjs"
	, "tests/helpers/php-wasm-fin-direct-fixtures.mjs"
	, "tests/helpers/php-wasm-fin-fixtures.mjs"
	, "tests/helpers/fin-container-edges.mjs"
	, "tests/helpers/fin-container-install.mjs"
	, "tests/helpers/reviewed-fin-container-fixture.mjs"
	, "tests/helpers/reviewed-scalar-host-fixture.mjs"
	, "tests/helpers/type-corpus-reviewed-ir.mjs"
	, "tests/helpers/type-corpus-php-wasm-install.mjs"
	, "tests/helpers/type-corpus-php-wasm-evidence.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/php-fin.test.mjs"
	, "tests/fixtures/php-wasm-fin-scalar.php"
	, "tests/fixtures/fin-container-edges.lean"
	, "tests/fixtures/fin-container-consumers/php-native.php"
	, "tests/fixtures/fin-container-edge-consumers/php-native.php"
	, ...["native-fin", "native-fin-containers"].flatMap(name => [
		`tests/fixtures/onboarding/${name}/${name === "native-fin" ? "NativeFin" : "FinContainers"}.lean`
		, ...["LICENSE", "lakefile.toml", "lean-toolchain", "package.json"].map(file => `tests/fixtures/onboarding/${name}/${file}`)
	])
	, "src/analyze/NativeExports.lean"
	, "src/analyze/native-metadata.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/build/native-model.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/php/copied-values.mjs"
	, "src/release/php-wasm-copied-package.mjs"
];
const records = ["start.json", "end.json", "run.tap", "ordinary.json", "reviewed.json", "runtime.json", "verified.json", "runner.mjs"];

/**
 * Validate retained original bytes and exact producer, source, runtime and execution identities.
 *
 * @param digest - Independently pinned archive index digest.
 * @param read - Reader replaceable for byte-corruption controls.
 */
export const assertPhpWasmDirectFinArchive = async (digest, read = readFile) => {
	const indexBytes = await read(`${phpWasmDirectArchiveRoot}/index.json`);
	assert.equal(sha256(indexBytes), digest);
	const index = JSON.parse(indexBytes);
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "php-wasm-direct-fin-local-acceptance");
	assert.equal(index.outcome, "passed"); assert.equal(index.producer.revision, phpWasmDirectProducer);
	assert.deepEqual(index.files.map(file => file.path).sort(), [...records, ...phpWasmDirectSourcePaths.map(path => "sources/" + path)].sort());
	const files = new Map();
	for(const file of index.files)
	{
		const bytes = await read(`${phpWasmDirectArchiveRoot}/${file.path}`);
		assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(file.path, bytes);
	}
	const json = name => JSON.parse(files.get(name));
	const start = json("start.json"), end = json("end.json"), verified = json("verified.json");
	assert.equal(start.revision, phpWasmDirectProducer); assert.equal(start.tree, index.producer.tree);
	assert.equal(start.environment.LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_TEST, "1");
	assert.equal(start.environment.LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_LEAN_TEST, "1");
	assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
	assert.equal(end.tapSha256, sha256(files.get("run.tap")));
	assert.equal(end.code, 0); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
	assert.ok(start.freeMiB >= 2048); assert.equal(start.stopFloorMiB, 768);
	assert.ok(end.minimumFreeMiB >= start.stopFloorMiB);
	assert.ok(Date.parse(end.endedAt) >= Date.parse(start.startedAt));
	assert.ok(Date.parse(verified.verifiedAt) >= Date.parse(end.endedAt));
	assert.equal(start.runtimeSha256, sha256(files.get("runtime.json")));
	assert.equal(end.runtimeSha256, start.runtimeSha256);
	assert.equal(verified.revision, phpWasmDirectProducer); assert.equal(verified.executionTuples, 48);
	assert.deepEqual(verified.checksPerExecution, phpWasmDirectChecks);
	for(const path of phpWasmDirectSourcePaths) assert.equal(sha256(files.get("sources/" + path)), start.sources[path], path);
	const inputs = await phpWasmDirectReportInputs();
	for(const [name, route] of [["ordinary.json", "ordinary-source"], ["reviewed.json", "reviewed-source"]])
	{
		assert.equal(verified.receipts[name], sha256(files.get(name)));
		const report = json(name); assertPhpWasmDirectFinReport(report, route, inputs);
		for(const row of report.reports)
		{
			assert.equal(sha256(canonicalJson(row.phpWasm.runtime)), start.runtimeSha256);
			assert.equal(row.phpWasm.component.sourceIdentity.extractorSha256, start.sources["src/analyze/NativeExports.lean"]);
			assert.equal(row.phpWasm.nodeVersion, start.node);
		}
	}
	const tap = files.get("run.tap").toString();
	assert.match(tap, /# tests 9\n# suites 0\n# pass 9\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.doesNotMatch(tap, /^\s*not ok /mu);
	for(const fixture of ["scalar", "containers"])
	{
		const builds = [...tap.matchAll(new RegExp(`^# direct-fin-${fixture} build (.+): wasm32$`, "gmu"))].map(match => match[1]);
		assert.deepEqual(builds, ["0", "1", "0", "1"]);
		const executions = [...tap.matchAll(new RegExp(`^# direct-fin-${fixture}: PHP-Wasm (Node|Chromium) (.+)$`, "gmu"))].map(match => `${match[1].toLowerCase()}/${match[2]}`).sort();
		assert.deepEqual(executions, [...phpWasmExecutionTuples, ...phpWasmExecutionTuples].sort());
	}
	for(const [position, label] of ["tightened scalar", "loosened scalar", "omitted scalar", "loosened Fin 0 list", "omitted Fin 0 list", "changed Lean source"].entries())
		assert.ok(tap.includes(`    ok ${position + 1} - ${label}\n`), label);
	return { index, files, start, inputs };
};
