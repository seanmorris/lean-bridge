/**
 * Exercise generated C walkers in a real shared Lean/Wasm heap.
 * This is a transport test, not installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generateComponentRecursiveAdapters } from "../../src/build/component-recursive-adapters.mjs";
import { compileComponentRecursiveCodec } from "../../src/release/component-recursive-codec.mjs";
import { createComponentRecursiveBudget } from "../../src/abi/component-recursive.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

/**
 * Compile the C boundary and run independent values through its typed exports.
 *
 * @param input - Test-owned compilation workspace and checked descriptor.
 * @param input.abi - Fresh recursive copied ABI.
 * @param input.directory - Workspace containing freshly compiled Lean C files.
 */
export const checkRecursiveWasm = async ({ abi, directory }) => {
	const root = process.cwd(), lock = JSON.parse(await readFile("poc/lean-link-spike/graph-lock.json"));
	const runtime = resolve(process.env.LEAN_BRIDGE_RUNTIME_ROOT ?? `build/lean-runtime/${lock.runtime.leanCommit}-${lock.runtime.patchSetSha256}-browser`);
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const emcc = process.env.LEAN_BRIDGE_EMCC ?? join(root, ".toolchains/emsdk/upstream/emscripten/emcc");
	const c = generateComponentRecursiveAdapters(abi);
	assert.doesNotMatch(c, /lean_ctor_get|lean_ctor_set|lean_alloc_ctor/u);
	assert.ok(c.lastIndexOf("_validate(&frame->args") < c.lastIndexOf("_decode(&frame->args"));
	const hooks = await readFile("tests/fixtures/structured-types/recursive-ownership.c", "utf8");
	await writeFile(join(directory, "RecursiveBridge.c"), `${hooks}\n${c}`);
	await processBuildRunner.capture({ command: emcc, cwd: directory
		, args: [
			"-O2", "-fwasm-exceptions", "-flto", "-fPIC", "-ffp-contract=off"
			, "-DLEAN_EMSCRIPTEN", "-UNDEBUG"
			, "-sSIDE_MODULE=2", "-Wl,--no-entry", "-Wl,--export=initialize_Carriers"
			, ...abi.exports.map(item => `-Wl,--export=${item.symbol}`)
			, ...["configure", "live", "attempts", "decodes", "release"].map(name => `-Wl,--export=recursive_test_${name}`)
			, `-I${join(runtime, "cmake/include")}`
			, `-I${join(runtime, "source/src/include")}`
			, `-I${join(root, "poc/lean-link-spike")}`
			, "Recursive.c", "Carriers.c", "RecursiveBridge.c", "-o", "recursive.wasm"]
		, timeoutMs: 120000 }).catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	const { default: createMain } = await import(pathToFileURL(join(runtimeRoot, "main.mjs")));
	const module = await createMain({ locateFile: path => join(runtimeRoot, path) });
	assert.equal(module._bridge_lean_runtime_init(), 1); assert.equal(module._bridge_recursive_abi(), 1);
	module.FS.writeFile("/recursive.wasm", await readFile(join(directory, "recursive.wasm")));
	await module.loadDynamicLibrary("/recursive.wasm", { global: true, loadAsync: true, nodelete: true });
	module.FS.unlink("/recursive.wasm");
	const text = (value, action) => {
		const bytes = new TextEncoder().encode(`${value}\0`), pointer = module._malloc(bytes.length);
		assert.ok(pointer);
		try
		{ module.HEAP8.set(bytes, pointer); return action(pointer); }
		finally
		{ module._free(pointer); }
	};
	assert.equal(text("initialize_Carriers", pointer => module._bridge_lean_component_initialize(pointer)), 1);
	const view = () => new DataView(module.HEAP8.buffer);
	const command = (name, fail = 0, enabled = 1) => {
		const frame = module._malloc(48); assert.ok(frame);
		try
		{
			module.HEAP8.fill(0, frame, frame + 48);
			view().setUint32(frame + 36, enabled, true); view().setUint32(frame + 40, fail, true);
			return text(`recursive_test_${name}`, pointer => module._bridge_scalar_call(pointer, frame));
		} finally
		{ module._free(frame); }
	};
	const invoke = (name, args, options = {}) => {
		const item = abi.exports.find(item => item.bindingId === `lean:Recursive.${name}`);
		const owners = [], allocate = bytes => {
			const pointer = module._malloc(Math.max(1, bytes)); assert.ok(pointer); owners.push(pointer); return pointer;
		};
		const budget = createComponentRecursiveBudget();
		const frame = allocate(32 + args.length * 16);
		module.HEAP8.fill(0, frame, frame + 32 + args.length * 16);
		view().setUint32(frame, 8, true); view().setUint32(frame + 4, 32 + args.length * 16, true); view().setUint32(frame + 12, args.length, true);
		const codec = root => compileComponentRecursiveCodec({ schemaVersion: 1, root, types: abi.types });
		try
		{
			args.forEach((arg, index) => codec(item.parameters[index]).write(module, frame + 32 + index * 16, arg, allocate, budget));
			options.mutate?.(frame, allocate);
			const status = text(item.symbol, name => module._bridge_scalar_call(name, frame));
			assert.equal(status, options.status ?? 0, name); assert.equal(view().getUint32(frame + 8, true), status);
			if(status) assert.deepEqual([...module.HEAP8.slice(frame + 16, frame + 32)], Array(16).fill(0));
			else return codec(item.result).read(module, frame + 16, budget);
		} finally
		{
			assert.equal(text("recursive_test_release", name => module._bridge_scalar_call(name, frame)), 0);
			assert.deepEqual([...module.HEAP8.slice(frame + 16, frame + 32)], Array(16).fill(0));
			module._bridge_copied_frame_clear(frame);
			for(const pointer of owners.reverse()) module._free(pointer);
			assert.equal(command("live"), 0);
		}
	};
	const scalars = {
		unit: undefined, bool: true, u8: 255, u16: 65535, u32: 0xffffffff
		, u64: (1n << 64n) - 1n
		, i8: -128, i16: -32768, i32: -2147483648, i64: -(1n << 63n)
		, natural: (1n << 128n) + 1n, integer: -((1n << 128n) + 1n)
		, f32: Math.fround(1.5), f64: -2.25, text: "\uFEFF🌱\0"
		, bytes: Uint8Array.of(0, 255, 42), char: "🌱", word: 0xffffffff
		, signedWord: -2147483648 };
	const leaf = { kind: "leaf", payload: scalars }, empty = { kind: "branch", children: [] };
	const tree = { kind: "branch", children: [leaf, { kind: "branch", children: [leaf, empty] }] };
	for(const [name, value] of [["tree", tree], ["forest", [tree, leaf]], ["scalars", scalars], ["deepAliases", tree]])
	{
		const output = invoke(name, [value]); assert.deepEqual(output, value); assert.notEqual(output, value);
	}
	const output = invoke("tree", [tree]);
	assert.notEqual(output.children[0].payload, output.children[1].children[0].payload);
	output.children[0].payload.bytes[0] = 17;
	assert.equal(scalars.bytes[0], 0); assert.equal(output.children[1].children[0].payload.bytes[0], 0);
	assert.deepEqual(invoke("empty", []), empty);
	assert.deepEqual(invoke("joinTrees", [leaf, empty]), { kind: "branch", children: [leaf, empty] });
	const left = { kind: "next", right: { kind: "many", lefts: [{ kind: "leaf", value: 42 }] } };
	assert.deepEqual(invoke("left", [left]), left);
	assert.deepEqual(invoke("right", [left.right]), left.right);
	const faultCheck = (name, value) => {
		command("configure");
		assert.deepEqual(invoke(name, [value]), value);
		const attempts = command("attempts"); assert.ok(attempts > 40);
		for(let failure = 1; failure <= attempts; failure++)
		{
			command("configure", failure);
			invoke(name, [value], { status: 5 });
			assert.equal(command("attempts"), failure);
			assert.deepEqual(invoke(name, [value]), value);
		}
		command("configure", 0, 0);
	};
	faultCheck("tree", tree);
	faultCheck("envelope", {
		tree: leaf, alternatives: [[tree], []]
		, fallback: { tag: "some", value: empty }
		, outcome: { ok: [leaf, empty] }
		, marker: { tag: "some", value: { tag: "some", value: undefined } }
	});
	command("configure", 0, 0);
	invoke("joinTrees", [leaf, empty], { status: 3, mutate: frame => view().setUint32(frame + 48, 999, true) });
	assert.equal(command("decodes"), 0);
	for(const marker of [{ tag: "none" }, { tag: "some", value: { tag: "none" } }, { tag: "some", value: { tag: "some", value: undefined } }])
	{
		for(const outcome of [{ ok: [leaf, empty] }, { error: "test" }])
		{
			const value = { tree: leaf, alternatives: [[tree], []], fallback: { tag: "some", value: empty }, outcome, marker };
			assert.deepEqual(invoke("envelope", [value]), value);
		}
	}
	const spine = depth => {
		let value = { kind: "leaf", value: 42 };
		for(let index = 0; index < depth; index++) value = { kind: "next", value };
		return value;
	};
	assert.deepEqual(invoke("spine", [spine(127)]), spine(127));
	for(let index = 0; index < 40; index++)
	{
		invoke("grow", [spine(127)], { status: 4 });
		assert.deepEqual(invoke("spine", [spine(8)]), spine(8));
	}
	const loop = frame => { view().setUint32(frame + 40, frame + 32, true); };
	invoke("spine", [spine(1)], { status: 3, mutate: loop });
	invoke("spine", [spine(1)], { status: 3, mutate: frame => view().setUint32(frame + 36, 12, true) });
	invoke("spine", [spine(1)], { status: 3, mutate: frame => view().setUint32(frame + 44, 2, true) });
	invoke("tree", [tree], { status: 3, mutate: frame => view().setUint32(frame + 40, 1, true) });
	invoke("tree", [tree], { status: 1, mutate: frame => view().setUint32(frame, 7, true) });
	command("configure", 0, 0);
	invoke("spine", [spine(0)], { status: 4
		, mutate: (frame, allocate) => {
			let slot = frame + 32;
			for(let index = 0; index < 130; index++)
			{
				const next = allocate(16);
				module.HEAP8.fill(0, next, next + 16);
				view().setUint32(slot, 37, true); view().setUint32(slot + 4, 0, true);
				view().setUint32(slot + 8, next, true); view().setUint32(slot + 12, 1, true);
				slot = next;
			}
		}
	});
	assert.equal(command("decodes"), 0);
	assert.deepEqual(invoke("forest", [Array(65535).fill(empty)]), Array(65535).fill(empty));
	invoke("forest", [Array(65536).fill(empty)], { status: 4 });
	const nearBytes = { ...scalars, text: "a".repeat(8 * 1024 * 1024 - 1024) };
	assert.deepEqual(invoke("scalars", [nearBytes]), nearBytes);
	const overBytes = { ...scalars, text: "a".repeat(8 * 1024 * 1024) };
	invoke("scalars", [overBytes], { status: 4 });
	command("configure", 0, 0);
	invoke("joinTrees", [{ kind: "leaf", payload: overBytes }, empty], { status: 4
		, mutate: frame => module.HEAP8.copyWithin(frame + 48, frame + 32, frame + 48) });
	assert.equal(command("decodes"), 0);
	assert.deepEqual(invoke("tree", [tree]), tree);
};
