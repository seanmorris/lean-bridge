/**
 * Constructor admission follows the allocator used by the pinned Lean headers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeAllocationGuardHeader } from "../src/build/native-allocation-guard.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { readVerifiedNativeComponent } from "../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_RECURSIVE_TEST === "1";
const prefix = join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const run = (command, args, cwd) => processBuildRunner.capture({ command, args, cwd, timeoutMs: 180000 });

test("native constructor guard uses allocator headers and retains the original allocation call", () => {
	assert.match(nativeAllocationGuardHeader, /MI_SMALL_SIZE_MAX/u);
	assert.match(nativeAllocationGuardHeader, /LEAN_MAX_SMALL_OBJECT_SIZE/u);
	assert.match(nativeAllocationGuardHeader, /sizeof\(lean_ctor_object\)/u);
	assert.match(nativeAllocationGuardHeader, /lean_alloc_ctor\(\(tag\), \(n\), \(s\)\)/u);
	assert.ok(nativeAllocationGuardHeader.indexOf("#include <lean/lean.h>") < nativeAllocationGuardHeader.indexOf("#define lean_alloc_ctor"));
	assert.doesNotMatch(nativeAllocationGuardHeader, /mi_malloc|lean_alloc_closure|m_cs_sz/u);
});

test("C compiler rejects unsupported constructor sizes at exact allocator boundaries", { skip: !enabled, timeout: 180000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-native-allocation-boundary-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, "guard.h"), nativeAllocationGuardHeader);
	const check = async (objects, scalars, expected) => {
		await writeFile(join(root, "probe.c"), `#include "guard.h"\nlean_object *probe(unsigned count) { (void)count; return lean_alloc_ctor(0, ${objects}, ${scalars}); }\n`);
		const action = () => run("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-I", join(prefix, "include"), "probe.c"], root);
		if(expected) await assert.rejects(action, error => error.details?.stderr.includes(expected), `${objects}/${scalars}`);
		else await action();
	};
	await check("0", "0");
	await check("127", "0");
	await check("1", "1008");
	await check("1", "510");
	await check("128", "0", "pinned runtime allocator limit");
	await check("1", "1009", "pinned runtime allocator limit");
	await check("1", "1020", "pinned runtime allocator limit");
	await check("256", "0", "object-field limit");
	await check("0", "1024", "scalar-byte limit");
	await check("-1", "0", "object-field limit");
	await check("0", "-1", "scalar-byte limit");
	await check("SIZE_MAX", "SIZE_MAX", "object-field limit");
	await check("count", "0", "compiler-constant field sizes");
	await check("0", "count", "compiler-constant field sizes");
});

test("fresh native packages authenticate the guard and reject oversized Lean constructors atomically", { skip: !enabled, timeout: 600000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-native-allocation-package-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const runtime = await buildNativeSharedRuntime({ outputRoot: join(root, "runtime"), leanPrefix: prefix });
	const project = join(root, "project");
	await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(project, "lakefile.toml", 'name = "allocation"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Allocation"\n');
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Allocation"], exports: ["Allocation.make"] }));
	const source = type => `set_option maxRecDepth 10000\nnamespace Allocation\nstructure Wide where\n${Array.from({ length: 255 }, (_, i) => `  field${i} : ${type}`).join("\n")}\ndef make (value : ${type}) : Wide := ⟨${Array(255).fill("value").join(", ")}⟩\nend Allocation\n`;
	const build = outputRoot => buildNativeComponent({ projectRoot: project, outputRoot, runtimeRoot: runtime.root, leanPrefix: prefix, targets: ["c"] });
	await saveLakeFile(project, "Allocation.lean", source("UInt16"));
	const component = await build(join(root, "small"));
	const verified = await readVerifiedNativeComponent(component.root, runtime.identity);
	assert.equal(verified.receipt.schemaVersion, 2);
	assert.equal(verified.receipt.allocationGuardSha256, sha256(nativeAllocationGuardHeader));
	assert.equal(await readFile(join(component.root, "allocation-guard.h"), "utf8"), nativeAllocationGuardHeader);
	const relocatedRuntime = await buildNativeSharedRuntime({ outputRoot: join(root, "runtime-relocated"), leanPrefix: prefix });
	assert.equal(relocatedRuntime.identity, runtime.identity);
	const relocated = await buildNativeComponent({ projectRoot: project, outputRoot: join(root, "small-relocated"), runtimeRoot: relocatedRuntime.root, leanPrefix: prefix, targets: ["c"] });
	assert.deepEqual(relocated.receipt, component.receipt, "Compiler header paths must not change the guarded component's identity");
	// Rehashing a tampered guard into the closed inventory and receipt cannot
	// replace the verifier's independently regenerated policy.
	const guard = `${nativeAllocationGuardHeader}\n#undef lean_alloc_ctor\n`;
	await writeFile(join(component.root, "allocation-guard.h"), guard);
	const inventory = JSON.parse(await readFile(join(component.root, "artifacts.json")));
	const receipt = { ...verified.receipt, allocationGuardSha256: sha256(guard) };
	const receiptBytes = canonicalJson(receipt);
	await writeFile(join(component.root, "native-component.json"), receiptBytes);
	inventory.files["allocation-guard.h"] = { bytes: Buffer.byteLength(guard), sha256: sha256(guard) };
	inventory.files["native-component.json"] = { bytes: Buffer.byteLength(receiptBytes), sha256: sha256(receiptBytes) };
	await writeFile(join(component.root, "artifacts.json"), canonicalJson(inventory));
	await assert.rejects(() => readVerifiedNativeComponent(component.root, runtime.identity), /differs from compiler metadata or runtime/u);
	await saveLakeFile(project, "Allocation.lean", source("UInt32"));
	await assert.rejects(() => build(join(root, "oversized")), error => error.code === "native-constructor-allocation-unsupported" && error.details.stderr.includes("pinned runtime allocator limit"));
	assert.deepEqual((await readdir(root)).sort(), ["project", "runtime", "runtime-relocated", "small", "small-relocated"]);
});
