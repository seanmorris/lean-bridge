/**
 * Source-only controls for recursive checked records through PHP-Wasm packages. The oracle runs
 * the shared native-PHP caller on the genuine PHP-Wasm public sources; no wasm component runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { generateCopiedPhpGraphPackage } from "../../src/backends/php/copied-graph-package.mjs";
import { generateCopiedPhpGraphZendAdapter } from "../../src/backends/php/copied-graph-zend.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { mutualCheckedRecordConfiguration } from "./mutual-checked-record-fixture.mjs";
import { recursiveCheckedRecordConfiguration } from "./recursive-checked-record-fixture.mjs";
import {
	adaptRecursiveCheckedRecordPhpWasm, recursiveCheckedRecordPhpWasmCaller
	, recursiveCheckedRecordPhpWasmCallerBlob, recursiveCheckedRecordPhpWasmCallerSource
	, recursiveCheckedRecordPhpWasmConfiguration, recursiveCheckedRecordPhpWasmConsumerFixture
	, recursiveCheckedRecordPhpWasmCounts
	, recursiveCheckedRecordPhpWasmExpected, recursiveCheckedRecordPhpWasmPackage
	, recursiveCheckedRecordPhpWasmRequest, recursiveCheckedRecordPhpWasmReview
	, recursiveCheckedRecordPhpWasmSelection
} from "./recursive-checked-record-php-wasm-fixture.mjs";

const php = resolve(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php");
const model = "tests/helpers/recursive-checked-record-php-model.php", modelBlob = "2d3572595efa35b9f507b9736619151b6d82430b";
const faults = [
	"produce-offset", "produce-single", "produce-digits", "accept-int"
	, "accept-keyed", "wrong-host-exception", "missing-fin"
	, "missing-normalization", "conflated-constructor", "diagnostic-suffix"
	, "wrong-status", "wrong-path", "root-only", "echo-unnormalized"
	, "echo-drops-tail", "cycle-as-lean", "depth-unbounded", "shared-as-cycle"
	, "groups-drop-none", "echo-groups-drops-none", "poison-after-reject"
];
const moduleFaults = { recursive: ["second-normalizes-root-only"], mutual: ["stop-as-none"] };

test("recursive checked-record PHP-Wasm reuses the native-PHP caller and oracle byte for byte", () => {
	// Both packages carry the same blobs, so either may integrate first without a conflict.
	for(const [path, blob] of [[recursiveCheckedRecordPhpWasmCaller, recursiveCheckedRecordPhpWasmCallerBlob], [model, modelBlob]])
		assert.equal(execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim(), blob, path);
	for(const fixture of ["recursive", "mutual"])
	{
		const ir = recursiveCheckedRecordPhpWasmReview(fixture);
		const wasm = generateCopiedPhpGraphZendAdapter(ir, { refinementDiagnostics: true }), native = generateCopiedPhpGraphPackage(ir);
		// Host checks and public classes are shared; only the private transport differs.
		for(const path of ["src/Internal/Values.php", "src/Internal/GraphTypes.php"]) assert.equal(wasm[path], native[path], path);
		// A missing delimiter fails instead of comparing two truncated prefixes.
		const surface = source => {
			const end = source.indexOf("require_once __DIR__ . '/Internal/Native.php'");
			assert.ok(end > 0, "PHP-Wasm public surface delimiter"); return source.slice(0, end);
		};
		assert.equal(surface(wasm["src/Api.php"]), surface(native["src/Api.php"]));
		assert.match(wasm["src/Api.php"], new RegExp(`^namespace ${recursiveCheckedRecordPhpWasmPackage(fixture).namespace};$`, "mu"));
		// Status 1 carries the adapter's exact text into LeanBridgeError code 1.
		const extension = Object.entries(wasm).find(([path]) => path.startsWith("extension/"))[1];
		assert.match(extension, /if \(!message && status == 1\) message = [a-z]+checkedrecords_graph_error\(\);/u);
		assert.match(wasm["src/Internal/Native.php"], /catch \(\\Exception \$error\) \{ throw new \\Lean[A-Za-z]+\\LeanBridgeError\(\$error->getMessage\(\), \$error->getCode\(\), \$error\); \}/u);
	}
});

test("recursive checked-record PHP-Wasm diagnostics are opt-in and leave default transports byte-identical", () => {
	for(const fixture of ["recursive", "mutual"])
	{
		const ir = recursiveCheckedRecordPhpWasmReview(fixture);
		const off = generateCopiedPhpGraphZendAdapter(ir), on = generateCopiedPhpGraphZendAdapter(ir, { refinementDiagnostics: true });
		assert.deepEqual(generateCopiedPhpGraphZendAdapter(ir, { refinementDiagnostics: false }), off);
		for(const text of Object.values(off)) assert.doesNotMatch(text, /_graph_error/u);
		assert.deepEqual(Object.keys(on), Object.keys(off));
		// Only the private extension source, its header declaration and their inventory change.
		const changed = Object.keys(off).filter(path => on[path] !== off[path]).sort();
		assert.deepEqual(changed.map(path => path.replace(/_[0-9a-f]{16}\.c$/u, ".c")), [
			`extension/lb_${fixture}checkedrecords_graph.c`, "graph-zend-manifest.json"
			, `include/${fixture}checkedrecords-graph.h`]);
		const before = JSON.parse(off["graph-zend-manifest.json"]), after = JSON.parse(on["graph-zend-manifest.json"]);
		assert.deepEqual({ ...after, files: null }, { ...before, files: null });
		assert.deepEqual(Object.keys(after.files).filter(path => after.files[path].sha256 !== before.files[path].sha256).sort()
			, changed.filter(path => path !== "graph-zend-manifest.json"));
		for(const value of [0, 1, "true", null])
			assert.throws(() => generateCopiedPhpGraphZendAdapter(ir, { refinementDiagnostics: value }), /must be explicit/u);
	}
});

test("recursive checked-record PHP-Wasm adapts only host entry, strictness and observation", async () => {
	const source = await readFile(recursiveCheckedRecordPhpWasmCaller, "utf8");
	for(const strictness of ["weak", "strict"])
	{
		const adapted = await recursiveCheckedRecordPhpWasmCallerSource(strictness);
		assert.equal(adapted, adaptRecursiveCheckedRecordPhpWasm(source, strictness));
		assert.ok(adapted.startsWith(`<?php\ndeclare(strict_types=${strictness === "strict" ? 1 : 0});\n`));
		assert.doesNotMatch(adapted, /\$argc|SCRIPT_FILENAME|vendor\/autoload\.php/u);
		assert.match(adapted, /'word_bits' => PHP_INT_SIZE \* 8, 'php' => PHP_VERSION/u);
		// Everything but the three substituted spans is the native corpus verbatim.
		const body = source.slice(source.indexOf("\n", source.indexOf("declare(")) + 1, source.indexOf("if (realpath("));
		assert.ok(adapted.includes(body));
	}
	// Any drift in the substituted spans fails closed instead of leaving a partial caller.
	for(const [before, after] of [
		["declare(strict_types=0);", "declare(strict_types=1);"]
		, ["The installed package selects the module", "The package selects the module"]
		, ["    require 'vendor/autoload.php';\n", "    require_once 'vendor/autoload.php';\n"]
		, ["echo json_encode(check_recursive_checked_records_php($api, $module)", "print json_encode(check_recursive_checked_records_php($api, $module)"]
		, ["if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {", "if (true) {"]
	]) {
		assert.equal(source.split(before).length, 2, before);
		assert.throws(() => adaptRecursiveCheckedRecordPhpWasm(source.replace(before, after), "weak"), undefined, before);
	}
	assert.throws(() => adaptRecursiveCheckedRecordPhpWasm(source + "\n", "weak"));
	assert.throws(() => adaptRecursiveCheckedRecordPhpWasm(source, "lax"));
});

test("recursive checked-record PHP-Wasm caller detects every fault on the genuine PHP-Wasm surface", async t => {
	if(await access(php).then(() => false, () => true))
	{
		t.skip(`PHP is unavailable at ${php}`);
		return;
	}
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-php-wasm-model-"));
	t.after(() => rm(root, { recursive: true }));
	for(const [path, text] of Object.entries(bundledBrickMath())) await saveLakeFile(root, path, text);
	const apis = [];
	for(const fixture of ["recursive", "mutual"])
	{
		const files = generateCopiedPhpGraphZendAdapter(recursiveCheckedRecordPhpWasmReview(fixture), { refinementDiagnostics: true });
		for(const [path, text] of Object.entries(files)) if(path.startsWith("src/")) await saveLakeFile(root, `${fixture}/${path}`, text);
		// The oracle names the native type table; expose PHP-Wasm's own private table under that name.
		const table = files["src/Internal/Native.php"].match(/private const FUNCTIONS = (\[[^]*?\n {4}\]);/u)[1];
		const { namespace } = recursiveCheckedRecordPhpWasmPackage(fixture);
		await saveLakeFile(root, `${fixture}/surface.php`, `<?php\nnamespace { require __DIR__ . '/src/Api.php'; }\nnamespace ${namespace}\\Internal { final class GraphNativeTypes { public const FUNCTIONS = ${table}; } }\n`);
		apis.push(join(root, fixture, "surface.php"));
	}
	const brick = join(root, "dependencies/brick-math/autoload.php");
	// Hosted runners load Xdebug, whose 256-frame guard aborts the 100-level snapshot probe.
	const args = ["-d", "display_errors=stderr", "-d", "xdebug.mode=off"
		, resolve(model), resolve(recursiveCheckedRecordPhpWasmCaller)
		, brick, ...apis];
	const run = await runCopied(php, args, root);
	assert.equal(run.stderr, "");
	const result = JSON.parse(run.stdout);
	assert.equal(result.installedAcceptance, false);
	assert.deepEqual(result.results, [recursiveCheckedRecordPhpWasmCounts.recursive, recursiveCheckedRecordPhpWasmCounts.mutual]);
	assert.deepEqual(result.rejectedFaults, Object.fromEntries(["recursive", "mutual"].map(fixture =>
		[fixture, [...faults, ...moduleFaults[fixture], "alias-constant"]])));
	t.diagnostic("A PHP double runs the shared caller on the PHP-Wasm public classes and host checks; no wasm component executes.");
});

test("recursive checked-record PHP-Wasm keeps both author contracts, package coordinates and probes", () => {
	const base = { recursive: recursiveCheckedRecordConfiguration, mutual: mutualCheckedRecordConfiguration };
	for(const route of ["ordinary", "reviewed"]) for(const fixture of ["recursive", "mutual"])
	{
		const expected = base[fixture](route), actual = recursiveCheckedRecordPhpWasmConfiguration(route, fixture);
		validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { "php-wasm": {
			npm: { name: `lean-bridge-${fixture}checkedrecords-wasm`, version: "1.0.0" }
			, composer: { name: `lean-bridge-${fixture}checkedrecords/wasm`, version: "1.0.0" } } });
	}
	for(const fixture of ["recursive", "mutual"])
	{
		const { namespace, settings } = recursiveCheckedRecordPhpWasmPackage(fixture);
		assert.deepEqual(JSON.parse(recursiveCheckedRecordPhpWasmRequest(fixture, "composer")), { module: namespace, operations: { probe: "first" }, autoload: "vendor/autoload.php" });
		assert.equal(JSON.parse(recursiveCheckedRecordPhpWasmRequest(fixture, "embedded")).autoload, `vendor/${settings.composer.name}/bootstrap.php`);
		assert.deepEqual(recursiveCheckedRecordPhpWasmExpected(fixture), { ...recursiveCheckedRecordPhpWasmCounts[fixture], word_bits: 32, php: "8.4.1" });
	}
	assert.throws(() => recursiveCheckedRecordPhpWasmRequest("recursive", "bundled"));
	assert.throws(() => recursiveCheckedRecordPhpWasmPackage("unknown"));
});

test("recursive checked-record PHP-Wasm consumer fixture passes module names, never consumer objects", async () => {
	const sources = { weak: await recursiveCheckedRecordPhpWasmCallerSource("weak"), strict: await recursiveCheckedRecordPhpWasmCallerSource("strict") };
	for(const fixtureName of ["recursive", "mutual"])
	{
		const consumer = recursiveCheckedRecordPhpWasmConsumerFixture(fixtureName, sources);
		assert.deepEqual(consumer.settings, recursiveCheckedRecordPhpWasmPackage(fixtureName).settings);
		assert.equal(consumer.removeHandoff, true);
		for(const arrangement of ["embedded", "composer"])
			assert.equal(consumer.request(arrangement), recursiveCheckedRecordPhpWasmRequest(fixtureName, arrangement));
		assert.equal(JSON.parse(consumer.request("composer")).module, recursiveCheckedRecordPhpWasmPackage(fixtureName).namespace);
		for(const strictness of ["weak", "strict"]) assert.equal(consumer.source(strictness), sources[strictness]);
		assert.throws(() => consumer.source("lax"));
		assert.throws(() => consumer.request("bundled"));
		// The installed-path shadowing bug passed the consumer object where a name belongs.
		assert.throws(() => recursiveCheckedRecordPhpWasmConsumerFixture(consumer, sources), /by name/u);
		assert.throws(() => recursiveCheckedRecordPhpWasmRequest(consumer, "composer"));
	}
	assert.throws(() => recursiveCheckedRecordPhpWasmConsumerFixture("recursive", { weak: sources.weak }));
	// The gated harness names its module binding once and never rebinds it to the consumer.
	const installed = await readFile("tests/helpers/recursive-checked-record-php-wasm-installed-tests.mjs", "utf8");
	assert.doesNotMatch(installed, /\b(?:const|let|var)\s+fixture\b|\bfor\(const fixture of\b/u);
	assert.match(installed, /for\(const fixtureName of fixtures\)/u);
	assert.match(installed, /recursiveCheckedRecordPhpWasmConsumerFixture\(fixtureName, sources\)/u);
});

test("recursive checked-record PHP-Wasm gates reject disabled selections and unsupported modules", () => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_WASM_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(recursiveCheckedRecordPhpWasmSelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, fixtures: ["recursive", "mutual"], maxLoad: 8
	});
	for(const flag of ["", "true", "2", true, null])
		assert.throws(() => recursiveCheckedRecordPhpWasmSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["FIXTURES", "recursive"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => recursiveCheckedRecordPhpWasmSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => recursiveCheckedRecordPhpWasmSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
	}
	for(const maxLoad of [8, 12, 16, 20])
		assert.equal(recursiveCheckedRecordPhpWasmSelection({ ...enabled, [prefix + "MAX_LOAD"]: String(maxLoad) }).maxLoad, maxLoad);
	for(const maxLoad of ["", "6", "24", "eight"])
		assert.throws(() => recursiveCheckedRecordPhpWasmSelection({ ...enabled, [prefix + "MAX_LOAD"]: maxLoad }));
});
