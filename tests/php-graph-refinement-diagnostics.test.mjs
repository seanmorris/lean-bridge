/**
 * Exact checked-refinement diagnostics through recursive native PHP graph packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCopiedPhpGraphConversions } from "../src/backends/php/copied-graph-conversions.mjs";
import { compileCopiedPhpGraphPackageModel, generateCopiedPhpGraphPackage } from "../src/backends/php/copied-graph-package.mjs";
import { auditPhpPackage } from "../src/backends/php/package-audit.mjs";
import { mutualCheckedRecordReview } from "./helpers/mutual-checked-record-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { recursiveCheckedRecordReview } from "./helpers/recursive-checked-record-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import "./helpers/php-graph-diagnostic-source-history-tests.mjs";

const native = "src/Internal/Native.php", runtime = "src/Internal/GraphNative.php", manifest = "binding-manifest.json";

test("PHP graph diagnostics are explicit and leave other packages byte-identical", () => {
	for(const ir of [nativeRecursiveReviewedIr(), mutualCheckedRecordReview(), recursiveCheckedRecordReview()])
	{
		const before = structuredClone(ir), files = generateCopiedPhpGraphPackage(ir);
		assert.deepEqual(generateCopiedPhpGraphPackage(ir, null, { refinementDiagnostics: false }), files);
		assert.deepEqual(ir, before);
		for(const text of Object.values(files)) assert.doesNotMatch(text, /_graph_error|checkedStatus|refinementDiagnostics/u);
		auditPhpPackage(ir, files);
	}
	for(const value of [0, 1, "true", null])
	{
		assert.throws(() => generateCopiedPhpGraphConversions(mutualCheckedRecordReview(), { refinementDiagnostics: value }), /must be explicit/u);
		assert.throws(() => generateCopiedPhpGraphPackage(mutualCheckedRecordReview(), null, { refinementDiagnostics: value }), /must be explicit/u);
	}
});

test("PHP graph diagnostics declare the adapter reader once and route every call", () => {
	const ir = mutualCheckedRecordReview(), { prefix } = compileCopiedPhpGraphPackageModel(ir);
	const off = generateCopiedPhpGraphPackage(ir), on = generateCopiedPhpGraphPackage(ir, null, { refinementDiagnostics: true });
	assert.deepEqual(Object.keys(on), Object.keys(off));
	for(const path of Object.keys(off).filter(path => ![native, runtime, manifest].includes(path))) assert.equal(on[path], off[path], path);
	assert.equal(on[native].match(new RegExp(`^const char \\*${prefix}_graph_error\\(void\\);$`, "gmu")).length, 1);
	assert.equal(on[native].replace(`const char *${prefix}_graph_error(void);\n`, ""), off[native]);
	const calls = on[runtime].match(/^ {12}self::(?:checkedS|s)tatus\(\$target->ffi->\{\$target->symbol\}.*$/gmu);
	assert.deepEqual(calls, ["            self::checkedStatus($target->ffi->{$target->symbol}(...[...$inputs, $output]), $target->ffi);"]);
	assert.equal(on[runtime].match(new RegExp(`\\$ffi->${prefix}_graph_error\\(\\)`, "gu")).length, 1);
	assert.equal(on[runtime].replace(/ {4}private static function checkedStatus[^]*?\n {4}\}\n/u, "")
		.replace("self::checkedStatus(", "self::status(").replace("), $target->ffi);\n", "));\n"), off[runtime]);
	const onManifest = JSON.parse(on[manifest]), offManifest = JSON.parse(off[manifest]);
	assert.equal(onManifest.refinementDiagnostics, true); assert.equal(offManifest.refinementDiagnostics, undefined);
	auditPhpPackage(ir, on);
	// The audit regenerates from the recorded flag and refuses any other value or generator.
	for(const value of [false, 1, "true"])
		assert.throws(() => auditPhpPackage(ir, { ...on, [manifest]: JSON.stringify({ ...onManifest, refinementDiagnostics: value }) }), /absent or exactly true/u);
	const stripped = { ...onManifest }; delete stripped.refinementDiagnostics;
	assert.throws(() => auditPhpPackage(ir, { ...on, [manifest]: JSON.stringify(stripped) }), /differs from its complete generated source/u);
});

test("PHP graph diagnostics read once, only for invalid input, and reject malformed text", {
	skip: process.env.LEAN_BRIDGE_PHP_GRAPH_CONVERSION_TEST !== "1"
}, async () => {
	const ir = mutualCheckedRecordReview(), { prefix, namespace } = compileCopiedPhpGraphPackageModel(ir);
	const source = generateCopiedPhpGraphPackage(ir, null, { refinementDiagnostics: true })[runtime];
	const methods = source.slice(source.indexOf("    private static function checkedStatus("), source.indexOf("    public static function call("));
	assert.match(methods, /private static function status\(int \$status\): void \{/u);
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-graph-diagnostics-"));
	try
	{
		// The stand-in adapter returns each staged text once, like the real thread-local reset.
		await saveLakeFile(root, "diagnostic.c", `#include <string.h>
static char text[64]; static int present, reads;
void diagnostic_set(const char *value, int length) { present = length >= 0; if (present) { memcpy(text, value, (size_t)length); text[length] = 0; } }
int diagnostic_reads(void) { return reads; }
const char *${prefix}_graph_error(void) { ++reads; if (!present) return 0; present = 0; return text; }
`);
		await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror", "-fPIC", "-shared", "diagnostic.c", "-o", "libdiagnostic.so"], root, { PATH: "/usr/bin:/bin" });
		await saveLakeFile(root, "probe.php", `<?php
declare(strict_types=1);
namespace ${namespace} { class LeanBridgeError extends \\RuntimeException {} }
namespace ${namespace}\\Internal {
final class GraphInvalidNative extends \\RuntimeException {}
final class Statuses
{
${methods.replaceAll("private static function", "public static function")}}
$ffi = \\FFI::cdef("void diagnostic_set(const char *, int); int diagnostic_reads(void); const char *${prefix}_graph_error(void);", $argv[1]);
$outcome = static function (int $status, ?string $text) use ($ffi): ?array {
    $ffi->diagnostic_set($text ?? '', $text === null ? -1 : \\strlen($text));
    try { Statuses::checkedStatus($status, $ffi); return null; }
    catch (\\Throwable $error) { return [(new \\ReflectionClass($error))->getShortName(), $error->getCode(), $error->getMessage()]; }
    finally { $ffi->diagnostic_set('', -1); }
};
$text = 'arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne';
echo \\json_encode([$outcome(0, 'stale'), $outcome(1, $text), $outcome(1, null), $outcome(1, "\\u{e9}"), $outcome(1, "\\xff"),
    $outcome(2, 'stale'), $outcome(3, 'stale'), $outcome(5, 'stale'), $outcome(4, 'stale'), $ffi->diagnostic_reads()], JSON_THROW_ON_ERROR), "\\n";
}
`);
		const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
		const result = await runCopied(php, ["-d", "ffi.enable=true", "-d", "display_errors=stderr", "probe.php", join(root, "libdiagnostic.so")], root);
		assert.equal(result.stderr, "");
		assert.deepEqual(JSON.parse(result.stdout), [
			null
			, ["LeanBridgeError", 1, "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne"]
			, ["LeanBridgeError", 1, "Native copied call failed with status 1"]
			, ["LeanBridgeError", 1, "é"]
			, ["GraphInvalidNative", 0, "Malformed native refinement diagnostic"]
			, ["LeanBridgeError", 2, "Native copied call failed with status 2"]
			, ["LeanBridgeError", 3, "Native copied call failed with status 3"]
			, ["LeanBridgeError", 5, "Native copied call failed with status 5"]
			, ["GraphInvalidNative", 4, "Invalid native copied result or status"]
			, 4
		]);
	}
	finally
	{
		await rm(root, { recursive: true });
	}
});

test("native Composer selects PHP graph diagnostics with the shared adapter rule", async () => {
	const composer = await readFile("src/release/native-composer.mjs", "utf8");
	assert.match(composer, /generateCopiedPhpGraphPackage\(model\.bindingIr, evidence, \{ refinementDiagnostics: nativeGraphRefinementDiagnostics\(model\) \}\)/u);
	assert.match(composer, /model\.copiedGraph\.callbacks \? generateCallablePhpGraphPackage\(model\.bindingIr, evidence\)/u);
	for(const ir of [mutualCheckedRecordReview(), recursiveCheckedRecordReview()])
		assert.ok(ir.declarations.some(item => item.source.extensions["lean-lang.org/refinements"].parameters.some(Boolean)));
});
