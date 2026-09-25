/**
 * Keep PHP diagnostics out of fault evidence and select exact package sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { assertPhpWasmLegacyPackageComparison, phpWasmPreGraphSources } from "./helpers/php-wasm-legacy-comparison.mjs";
import { beforePhpWasmStructuredCallables } from "./helpers/php-wasm-structured-callable-source-history.mjs";

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";

test("PHP fault probes inspect zeroed memory through their FFI instance without diagnostics", {
	skip: !existsSync(php)
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-fault-cast-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const source = await readFile("tests/fixtures/structured-callable-consumers/php-faults.php", "utf8");
	const start = source.indexOf("// Evaluate an instrumented copy in memory.");
	const end = source.indexOf("$request = json_decode(");
	assert.ok(start > 0 && end > start);
	const code = `<?php\ndeclare(strict_types=1);\nnamespace LeanStructured\\Internal;\n${source.slice(start, end)}
$ffi = \\FFI::cdef('typedef struct { unsigned first; unsigned second; } Probe;');
$out = $ffi->new('Probe');
StructuredFaults::$active = true;
StructuredFaults::clear($ffi, $out);
ensure(StructuredFaults::$clears === 1);
$out->second = 1; $rejected = false;
try { StructuredFaults::clear($ffi, $out); }
catch (\\RuntimeException $error) { $rejected = true; }
ensure($rejected && StructuredFaults::$clears === 2);
echo "instance-cast-and-nonzero-rejection-ok\\n";
`;
	await saveLakeFile(root, "probe.php", code);
	const result = await runCopied(php, ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "-d", "error_reporting=-1", "probe.php"], root);
	assert.equal(result.stderr, ""); assert.equal(result.stdout, "instance-cast-and-nonzero-rejection-ok\n");
	assert.doesNotMatch(source, /\\FFI::cast\(/u);
});

test("live PHP-Wasm comparisons do not accept a historical packager as the current source", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-wasm-shared-regressions-20260924.json", "utf8"));
	const { sources } = await phpWasmPreGraphSources();
	const run = record.report.packages[0];
	await assert.rejects(() => assertPhpWasmLegacyPackageComparison(run, sources));
});

test("historical PHP-Wasm comparisons require the exact authenticated packager source", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-wasm-shared-regressions-20260924.json", "utf8"));
	const { sources } = await phpWasmPreGraphSources();
	const path = "src/release/php-wasm-copied-package.mjs";
	const packagingSource = beforePhpWasmStructuredCallables(path, await readFile(path, "utf8"), record.report.sourceHashes[path]);
	for(const run of record.report.packages)
	{
		await assertPhpWasmLegacyPackageComparison(run, sources, { packagingSource });
		await assert.rejects(() => assertPhpWasmLegacyPackageComparison(run, sources, { packagingSource: packagingSource + "\n" }));
	}
});
