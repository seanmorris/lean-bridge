/**
 * Closure leases belong to one thread lifetime, including after OS ID reuse.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { closureThreadRegistry, closureThreadRegistryProbe, beforeClosureThreadRegistry } from "./helpers/closure-thread-registry.mjs";
import { witStructuredNativeModels, witStructuredNativeReceipt } from "./helpers/wit-structured-callable-regression.mjs";
import { generateNativePrimitiveC } from "../src/backends/c/native-primitives.mjs";

test("closure lifetime repair preserves every other byte in the recorded native callback families", async () => {
	const record = JSON.parse(await readFile("docs/evidence/wit-structured-codegen-regression-20260925.json", "utf8"));
	const models = witStructuredNativeModels();
	assert.deepEqual(record.native.map(row => row.name), Object.keys(models));
	for(const row of record.native)
	{
		const source = generateNativePrimitiveC(models[row.name], witStructuredNativeReceipt);
		const previous = beforeClosureThreadRegistry(source), expected = row.files["native.c"];
		assert.equal(Buffer.byteLength(previous), expected.bytes, row.name);
		assert.equal(sha256(previous), expected.sha256, row.name);
		assert.notEqual(sha256(beforeClosureThreadRegistry(source + "\n/* unrelated */\n")), expected.sha256);
		if(source.includes("typedef struct { uintptr_t token;"))
		{
			assert.notEqual(source, previous);
			assert.throws(() => beforeClosureThreadRegistry(source.replace("slot->thread == lb_lease_thread", "1")));
		}
		else assert.equal(source, previous);
	}
});

for(const pointerBits of [32, 64]) test(`${pointerBits}-bit closure leases reject departed creators and fail closed at serial exhaustion`, {
	skip: !existsSync("/usr/bin/cc"), timeout: 60_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-closure-thread-registry-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const source = closureThreadRegistryProbe(pointerBits);
	const observations = [];
	for(const sanitized of [false, true])
	{
		await saveLakeFile(root, "probe.c", source);
		const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-pthread"];
		const instrumentation = sanitized ? ["-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-fno-pie", "-no-pie"] : [];
		await runCopied("/usr/bin/cc", [...flags, ...instrumentation, "probe.c", "-o", "probe"]
			, root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
		const result = await runCopied(join(root, "probe"), [], root, { ...copiedCleanEnvironment
			, ASAN_OPTIONS: "detect_leaks=1:abort_on_error=1"
			, UBSAN_OPTIONS: "halt_on_error=1" });
		assert.equal(result.stderr, "");
		const observed = JSON.parse(result.stdout);
		assert.deepEqual(observed, { checks: 8469, replacements: 32, released: 4130, objects: 0, identities: 0 });
		observations.push({ sanitized, ...observed });
	}
	const registry = closureThreadRegistry(pointerBits);
	const rejected = [];
	for(const [name, current, replacement] of [
		["thread-binding", "slot->thread == lb_lease_thread", "1"]
		, ["serial-exhaustion", "lb_lease_thread_serial == UINT64_MAX", "0"]
	]) {
		assert.equal(registry.split(current).length, 2);
		const mutant = closureThreadRegistryProbe(pointerBits, registry.replace(current, replacement));
		await saveLakeFile(root, "mutant.c", mutant);
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-pthread", "mutant.c", "-o", "mutant"]
			, root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
		await assert.rejects(() => runCopied(join(root, "mutant"), [], root), error => {
			assert.equal(error.code, "build-command-failed");
			assert.match(error.details.stderr, /Assertion .* failed/u); return true;
		});
		rejected.push(name);
	}
	t.diagnostic(JSON.stringify({ pointerBits, sourceSha256: sha256(source), observations, rejected }));
});
