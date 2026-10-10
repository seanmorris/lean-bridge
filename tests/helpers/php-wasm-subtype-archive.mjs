/**
 * Authenticate original local installed Subtype results, including the failed host-path attempt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { phpWasmExecutionTuples } from "./php-wasm-fin-fixtures.mjs";
import { assertPhpWasmSubtypeReport, phpWasmSubtypeChecks, phpWasmSubtypeReportInput } from "./php-wasm-subtype-report.mjs";

export const phpWasmSubtypeArchiveRoot = "docs/evidence/php-wasm-subtype-installed-20261010";
export const phpWasmSubtypeProducer = "b7706ed7be1b24c0592fa4e3f7eccbd21ba7eb5d";
export const phpWasmSubtypeSourcePaths = [
	"tests/helpers/php-wasm-subtype-tests.mjs"
	, "tests/helpers/php-wasm-subtype-fixture.mjs"
	, "tests/helpers/php-wasm-fin-fixtures.mjs"
	, "tests/helpers/native-subtype-install.mjs"
	, "tests/helpers/reviewed-subtype-installed-fixture.mjs"
	, "tests/helpers/type-corpus-php-wasm-install.mjs"
	, "tests/helpers/type-corpus-php-wasm-evidence.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/fixtures/onboarding/native-subtype/Subtypes.lean"
	, "tests/fixtures/onboarding/native-subtype/LICENSE"
	, "tests/fixtures/onboarding/native-subtype/lakefile.toml"
	, "tests/fixtures/onboarding/native-subtype/lean-toolchain"
	, "tests/fixtures/onboarding/native-subtype/package.json"
	, "tests/fixtures/subtype-consumers/php-native.php"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/native-metadata.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/build/native-model.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/php/copied-values.mjs"
	, "src/release/php-wasm-copied-package.mjs"
];
const records = [
	"start.json", "end.json", "run.tap", "ordinary.json", "reviewed.json"
	, "runtime.json", "verified.json", "runner.mjs"
	, ...["start.json", "end.json", "run.tap", "runtime.json", "runner.mjs"].map(name => `failed-host-path/${name}`)];

/**
 * Validate original records and selected source bytes against a separately pinned index.
 *
 * @param digest - Independent archive index digest.
 * @param read - Reader replaceable for byte-corruption controls.
 */
export const assertPhpWasmSubtypeArchive = async (digest, read = readFile) => {
	const indexBytes = await read(`${phpWasmSubtypeArchiveRoot}/index.json`);
	assert.equal(sha256(indexBytes), digest);
	const index = JSON.parse(indexBytes);
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "php-wasm-subtype-local-acceptance");
	assert.equal(index.outcome, "passed"); assert.equal(index.producer.revision, phpWasmSubtypeProducer);
	assert.deepEqual(index.files.map(file => file.path).sort(), [...records, ...phpWasmSubtypeSourcePaths.map(path => "sources/" + path)].sort());
	const files = new Map();
	for(const file of index.files)
	{
		const bytes = await read(`${phpWasmSubtypeArchiveRoot}/${file.path}`);
		assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(file.path, bytes);
	}
	const json = name => JSON.parse(files.get(name));
	const start = json("start.json"), end = json("end.json"), verified = json("verified.json");
	for(const prefix of ["", "failed-host-path/"])
	{
		const beginning = json(prefix + "start.json"), ending = json(prefix + "end.json");
		assert.equal(beginning.revision, phpWasmSubtypeProducer); assert.equal(beginning.tree, index.producer.tree);
		assert.equal(beginning.environment.LEAN_BRIDGE_PHP_WASM_SUBTYPE_TEST, "1");
		assert.equal(beginning.runnerSha256, sha256(files.get(prefix + "runner.mjs")));
		assert.equal(ending.tapSha256, sha256(files.get(prefix + "run.tap")));
		assert.equal(ending.signal, null); assert.equal(ending.stoppedForDisk, false);
		assert.ok(beginning.freeMiB >= 2048); assert.equal(beginning.stopFloorMiB, 768);
		assert.ok(ending.minimumFreeMiB >= beginning.stopFloorMiB);
		assert.ok(Date.parse(ending.endedAt) >= Date.parse(beginning.startedAt));
		assert.equal(beginning.runtimeSha256, sha256(files.get(prefix + "runtime.json")));
		assert.equal(ending.runtimeSha256, beginning.runtimeSha256);
		for(const path of phpWasmSubtypeSourcePaths) assert.equal(sha256(files.get("sources/" + path)), beginning.sources[path], path);
	}
	assert.equal(end.code, 0); assert.equal(json("failed-host-path/end.json").code, 1);
	assert.equal(start.runtimeSha256, json("failed-host-path/start.json").runtimeSha256);
	assert.equal(json("failed-host-path/start.json").environment.LEAN_BRIDGE_PHP_WASM_HOST, undefined);
	assert.equal(typeof start.environment.LEAN_BRIDGE_PHP_WASM_HOST, "string");
	assert.ok(Date.parse(verified.verifiedAt) >= Date.parse(end.endedAt));
	assert.equal(verified.revision, phpWasmSubtypeProducer); assert.equal(verified.executionTuples, 24);
	assert.equal(verified.checksPerExecution, phpWasmSubtypeChecks); assert.equal(verified.dispatch, "not measured");
	const input = await phpWasmSubtypeReportInput();
	for(const [name, route] of [["ordinary.json", "ordinary-source"], ["reviewed.json", "reviewed-source"]])
	{
		assert.equal(verified.receipts[name], sha256(files.get(name)));
		const report = json(name); assertPhpWasmSubtypeReport(report, route, input);
		assert.equal(sha256(canonicalJson(report.phpWasm.runtime)), start.runtimeSha256);
		assert.equal(report.phpWasm.component.sourceIdentity.extractorSha256, start.sources["src/analyze/NativeExports.lean"]);
		assert.equal(report.phpWasm.nodeVersion, start.node);
	}
	const tap = files.get("run.tap").toString(), failed = files.get("failed-host-path/run.tap").toString();
	assert.match(tap, /# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.doesNotMatch(tap, /^\s*not ok /mu);
	assert.match(failed, /# tests 2\n# suites 0\n# pass 0\n# fail 2\n# cancelled 0\n# skipped 0\n/u);
	assert.match(failed, /ENOENT[^\n]*php-wasm-host\/node_modules\/php-wasm\/package\.json/u);
	const builds = [...tap.matchAll(/^# subtypes build (.+): wasm32$/gmu)].map(match => match[1]);
	assert.deepEqual(builds, ["0", "1", "0", "1"]);
	const executions = [...tap.matchAll(/^# subtypes: PHP-Wasm (Node|Chromium) (.+)$/gmu)].map(match => `${match[1].toLowerCase()}/${match[2]}`).sort();
	assert.deepEqual(executions, [...phpWasmExecutionTuples, ...phpWasmExecutionTuples].sort());
	return { index, files, start, input };
};
