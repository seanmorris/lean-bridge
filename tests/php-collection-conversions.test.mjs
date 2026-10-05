/**
 * Run real PHP FFI converters with no native library or author toolchain.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { generateCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { copiedPhpDefinitions } from "../src/backends/php/copied-conversions.mjs";
import { phpFfiType } from "../src/backends/php/callables.mjs";
import { bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { primitiveFields } from "./helpers/record-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("PHP collection converters validate raw markers, canonical integers and bounded buffers", { skip: process.env.LEAN_BRIDGE_PHP_CONVERSIONS_TEST !== "1", timeout: 120_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-collection-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = collectionReviewedIr(), model = compileCopiedPhpModel(ir), original = generateCopiedPhpPackage(ir);
	const entry = copy => ({ index: copy.index, ctype: phpFfiType(copy), aggregate: copy.aggregate });
	const result = name => model.surface.copy(model.surface.functions.find(fn => fn.field === name).declaration.result.type);
	const request = {
		scalars: Object.fromEntries(Object.values(primitiveFields).map(name => [name, entry(model.surface.copy({ kind: "primitive", name }))]))
		, rows: Object.fromEntries(["unit", "bool", "uint32"].map(name => [name, entry(result(`array_reverse_${name}`).element)]))
		, deep: entry(result("deep")), nested: entry(result("array_reverse_uint32"))
	};
	const definitions = copiedPhpDefinitions(model).split("\n").filter(line => line.startsWith("typedef ")).join("\n");
	const source = await readFile("tests/fixtures/collection-consumers/php-conversions.php", "utf8");
	for(const [path, contents] of Object.entries({ ...original, ...bundledBrickMath(), "probe.php": source
		, "request.json": canonicalJson(request)
		, "definitions.h": definitions })) await saveLakeFile(root, path, contents);
	const executed = await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "probe.php"], root);
	assert.equal(executed.stderr, "");
	const observation = JSON.parse(executed.stdout);
	assert.ok(observation.checks > 1000); assert.ok(observation.rejected > 750);
	assert.equal(observation.primitives, 19); assert.equal(observation.nativeCalls, 0);
	assert.deepEqual(original, generateCopiedPhpPackage(ir));
	await saveLakeFile("build/collections", "php-native-conversions.json", canonicalJson({ schemaVersion: 1
		, kind: "php-ffi-conversion-preflight"
		, compiledLean: false, installedPackage: false
		, probeSourceSha256: sha256(source)
		, definitionsSha256: sha256(definitions)
		, requestSha256: sha256(canonicalJson(request))
		, generatedSourceHashes: Object.fromEntries(Object.entries(original).filter(([path]) => path.endsWith(".php")).map(([path, source]) => [path, sha256(source)]))
		, observation }));
	t.diagnostic(`${observation.checks} converter checks, ${observation.rejected} malformed values rejected, no native library loaded`);
});
