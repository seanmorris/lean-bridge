/**
 * Relocatable, bounded author headers with exact inventories and retained notices.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { javascriptWasmOwnedPins as pins, javascriptWasmTargetHeaders } from "../src/build/javascript-wasm-owned-artifacts.mjs";
import { buildJavaScriptWasmCompilerInputs, readVerifiedJavaScriptWasmCompilerInputs, javascriptWasmCompilerInputsName as name } from "../src/release/javascript-wasm-compiler-inputs.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-javascript-inputs-test-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const target = join(root, "target");
	for(const name of javascriptWasmTargetHeaders) await saveLakeFile(target, `cmake/include/lean/${name}`, name === "lean_libuv.h" ? "" : "/* fixture header */\n");
	await saveLakeFile(target, "cmake/include/lean/version.h", '#define LEAN_VERSION_STRING "4.32.2"\n#define LEAN_PLATFORM_TARGET "wasm32-unknown-emscripten"\n');
	await saveLakeFile(target, "source/LICENSE", "Lean compiler input fixture license\n");
	await saveLakeFile(target, "source/.lean-wasm-patched", `${pins.leanCommit} ${pins.patchSetSha256} browser\n`);
	const built = await buildJavaScriptWasmCompilerInputs({ leanRuntimeRoot: target, outputRoot: join(root, "one") });
	return { root, target, built };
};

test("JavaScript compiler inputs reproduce, relocate and retain empty target headers", async t => {
	const { root, target, built } = await fixture(t);
	const again = await buildJavaScriptWasmCompilerInputs({ leanRuntimeRoot: target, outputRoot: join(root, "two") });
	assert.equal(built.identity, again.identity);
	assert.deepEqual(await readFile(built.archive), await readFile(again.archive));
	await assert.rejects(buildJavaScriptWasmCompilerInputs({ leanRuntimeRoot: target, outputRoot: built.output }), /already exists/);
	const relocated = join(root, "relocated"); await cp(built.directory, relocated, { recursive: true });
	await rm(target, { recursive: true }); await rm(built.output, { recursive: true });
	const checked = await readVerifiedJavaScriptWasmCompilerInputs(relocated);
	assert.equal(checked.identity, built.identity);
	assert.equal(checked.files.get("cmake/include/lean/lean_libuv.h").length, 0);
	assert.match(checked.files.get("source/LICENSE").toString(), /fixture license/);
});

test("JavaScript header bundles reject changed pins, headers, inventories and links", async t => {
	const { root, built } = await fixture(t);
	const original = await readFile(join(built.directory, name));
	const manifest = JSON.parse(original.toString());
	const changes = [
		value => { value.pins.emscriptenVersion = "3.1.68"; }
		, value => { value.files["cmake/include/lean/lean.h"].bytes = 8 * 1024 ** 2; }
		, value => { value.files["cmake/include/lean/lean.h"].sha256 = "0".repeat(64); }
		, value => { delete value.files["source/LICENSE"]; }
		, value => { value.files["../outside"] = { bytes: 1, sha256: "0".repeat(64) }; }
	];
	for(const change of changes)
	{
		const changed = structuredClone(manifest); change(changed);
		const bytes = canonicalJson(changed);
		await saveLakeFile(built.directory, name, bytes);
		await saveLakeFile(built.directory, name + ".sha256", `${sha256(bytes)}  ${name}\n`);
		await assert.rejects(readVerifiedJavaScriptWasmCompilerInputs(built.directory), { code: "invalid-javascript-wasm-compiler-inputs" });
	}
	await saveLakeFile(built.directory, name, original);
	await saveLakeFile(built.directory, name + ".sha256", `${sha256(original)}  ${name}\n`);
	await saveLakeFile(built.directory, "source/extra.h", "unrecorded");
	await assert.rejects(readVerifiedJavaScriptWasmCompilerInputs(built.directory), /unrecorded/);
	await rm(join(built.directory, "source/extra.h"));
	await symlink(built.directory, join(root, "linked"));
	await assert.rejects(readVerifiedJavaScriptWasmCompilerInputs(join(root, "linked")), /regular directory/);
	const path = join(built.directory, "source/LICENSE"); await rm(path);
	await symlink(join(built.directory, name), path);
	await assert.rejects(readVerifiedJavaScriptWasmCompilerInputs(built.directory), /regular file/);
});
