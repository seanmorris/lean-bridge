/**
 * Build the real Lean fixture and production C/GMP generators for a bounded source test.
 * This compiler-shaped model is not fresh extractor metadata or installed-package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateGmpProjection } from "../../src/backends/c/gmp-projection.mjs";
import { generateNativePrimitiveC } from "../../src/backends/c/native-primitives.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { compilePrimitiveCppModel, renderPrimitiveCppPackage } from "../../src/backends/cpp/primitives.mjs";
import { brokerHeader, brokerSource } from "../../src/backends/native/runtime-broker.mjs";
import { generateNativeLeanAdapters, nativeTypeKey } from "../../src/build/native-model.mjs";
import { finContainerEntryAdapter } from "./fin-container-entry-dispatch.mjs";
import { finContainerEdgeRefinements, finContainerEdgeReviewedIr, finContainerEdgeSource } from "./fin-container-edges.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/** Independently authored signatures, with transparent aliases erased to their transport shapes. */
export const finContainerEdgeCompilerModel = () => {
	const bindingIr = finContainerEdgeReviewedIr(), types = new Map();
	const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const convert = reference => {
		if(reference.kind === "named")
		{
			const named = bindingIr.types.find(item => item.id === reference.id);
			assert.equal(named?.kind, "alias");
			return convert(named.target);
		}
		let type;
		if(reference.kind === "primitive")
		{
			assert.ok(["nat", "string"].includes(reference.name));
			type = { kind: "primitive", name: reference.name, lean: reference.name === "nat" ? "Nat" : "String", abi: { ...heap, heap: reference.name !== "nat" } };
		}
		else
		{
			assert.equal(reference.kind, "apply");
			assert.ok(["array", "list", "option"].includes(reference.constructor));
			assert.equal(reference.arguments.length, 1);
			type = { kind: reference.constructor, element: convert(reference.arguments[0]), abi: heap };
		}
		types.set(nativeTypeKey(type), { ...type, key: nativeTypeKey(type) });
		return type;
	};
	const exports = bindingIr.declarations.map(item => ({
		name: item.source.declaration, module: "FinContainers"
		, symbol: finContainerEntryAdapter(bindingIr.component.id, item.source.declaration)
		, parameters: item.parameters.map(parameter => ({ name: parameter.name, type: convert(parameter.type) }))
		, result: convert(item.result.type)
		, refinements: structuredClone(finContainerEdgeRefinements[item.source.declaration])
	}));
	assert.equal(exports.length, 12);
	return { component: bindingIr.component, bindingIr, pointerBits: 64, exports, types: [...types.values()] };
};

/**
 * Compile actual Lean, the normal native C binding and the GMP projection, without a package producer.
 *
 * @param root - Fresh test-owned directory.
 * @param lean - Absolute pinned Lean compiler path.
 * @param options - Optional public C++ headers for its source gate.
 * @param options.cpp - Generate the ordinary C++ wrappers and pinned standalone Boost headers.
 */
export const compileFinContainerEdgeFixture = async (root, lean, { cpp = false } = {}) => {
	assert.equal(typeof cpp, "boolean");
	const model = finContainerEdgeCompilerModel(), adapters = generateNativeLeanAdapters(model);
	const environment = { ...copiedCleanEnvironment, LEAN_PATH: root, LEAN_NUM_THREADS: "1", PATH: "/usr/bin:/bin" };
	const prefix = (await runCopied(lean, ["--print-prefix"], root)).stdout.trim();
	await saveLakeFile(root, "FinContainers.lean", await finContainerEdgeSource());
	await saveLakeFile(root, `${adapters.module}.lean`, adapters.leanSource);
	await runCopied(lean, ["-o", "FinContainers.olean", "-c", "FinContainers.c", "FinContainers.lean"], root, environment);
	await runCopied(lean, ["-c", "adapters.c", `${adapters.module}.lean`], root, environment);
	for(const [path, source] of Object.entries(generateCBindingPackage(model.bindingIr))) await saveLakeFile(root, `raw/${path}`, source);
	for(const [path, source] of Object.entries(generateGmpProjection(model.bindingIr).files)) await saveLakeFile(root, `gmp/${path}`, source);
	if(cpp)
		for(const [path, source] of Object.entries({ ...renderPrimitiveCppPackage(compilePrimitiveCppModel(model.bindingIr)), ...boostSources() }))
			await saveLakeFile(root, `cpp/${path}`, source);
	await saveLakeFile(root, "native.c", generateNativePrimitiveC(model, { initializer: `initialize_${adapters.module}` }));
	await saveLakeFile(root, "component.h", adapters.header);
	await saveLakeFile(root, "lean_bridge_native_runtime.h", brokerHeader);
	await saveLakeFile(root, "broker.c", brokerSource);
	const runtime = [`-L${join(prefix, "lib/lean")}`, "-lleanshared", `-Wl,-rpath,${join(prefix, "lib/lean")}`];
	await runCopied("/usr/bin/cc", [
		"-shared", "-fPIC", "-O2", `-I${join(prefix, "include")}`
		, "-I.", "-Iraw/include", "-Iraw/internal", "FinContainers.c", "adapters.c"
		, "broker.c", "native.c", "raw/src/fincontainers.c", ...runtime
		, "-lpthread", "-Wl,-z,defs", "-o", "libedge-source.so"
	], root, environment);
	await runCopied("/usr/bin/cc", [
		"-shared", "-fPIC", "-O2", "-Iraw/include", "-Igmp/include"
		, "gmp/src/fincontainers_gmp.c", "-L.", "-ledge-source", "-lgmp"
		, "-Wl,-z,defs"
		, "-Wl,-rpath,$ORIGIN", "-o", "libedge-gmp.so"
	], root, environment);
	return { model, adapters, prefix, environment };
};

/**
 * Split out the normal shared broker for loaders that require its separate library identity.
 *
 * @param root - Fresh source-test directory.
 * @param lean - Absolute pinned Lean compiler.
 * @param options - Source fixture library layout.
 * @param options.relocatable - Resolve the bundled Lean runtime beside the extracted libraries.
 */
export const compileFinContainerEdgeSplitFixture = async (root, lean, { relocatable = false } = {}) => {
	assert.equal(typeof relocatable, "boolean");
	const compiled = await compileFinContainerEdgeFixture(root, lean);
	const { environment, prefix } = compiled;
	const runtime = [`-L${join(prefix, "lib/lean")}`, "-lleanshared", `-Wl,-rpath,${relocatable ? "$ORIGIN" : join(prefix, "lib/lean")}`];
	await runCopied("/usr/bin/cc", ["-shared", "-fPIC", "-O2", `-I${join(prefix, "include")}`, "-I.", "broker.c", ...runtime, "-lpthread", "-Wl,-z,defs", "-o", "liblean_bridge_native.so"], root, environment);
	await runCopied("/usr/bin/cc", [
		"-shared", "-fPIC", "-O2", `-I${join(prefix, "include")}`
		, "-I.", "-Iraw/include", "-Iraw/internal", "FinContainers.c", "adapters.c"
		, "native.c", "raw/src/fincontainers.c", "-L.", "-llean_bridge_native"
		, ...runtime, "-Wl,-rpath,$ORIGIN", "-Wl,-z,defs", "-o", "libedge-source.so"
	], root, environment);
	return compiled;
};
