/**
 * Alias-preserving public callbacks bind to alias-erased native trampolines.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createNativeModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { nativeCallbackHeader } from "../src/build/native-component.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateNativePrimitiveC } from "../src/backends/c/native-primitives.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateNativeCallables } from "../src/backends/c/native-callables.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const modelFor = (aliasedInput, aliasedResult) => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const scalar = projection.result, abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const alias = { kind: "alias", name: "Sample.Count", lean: "Sample.Count", target: scalar, abi: scalar.abi };
	const nested = aliased => ({ kind: "array", element: { kind: "option", element: aliased ? alias : scalar, abi }, abi });
	const callback = aliased => ({ kind: "callback", parameters: [nested(aliased)], result: nested(aliased), abi });
	projection.parameters[0].type = callback(aliasedInput); projection.result = callback(aliasedResult);
	return createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
};
const surfaceFor = model => compilePrimitiveCSurface(model.bindingIr, { callables: true, structuredCallables: true, compounds: true });

test("native aliases share a checked trampoline without dropping public callback entries", () => {
	for(const [input, result] of [[true, true], [true, false], [false, true], [false, false]])
	{
		const model = modelFor(input, result), surface = surfaceFor(model);
		assert.equal(model.types.filter(type => type.kind === "callback").length, 1);
		assert.equal(surface.callbacks.size, input === result ? 1 : 2);
		const rendered = generateNativeCallables(model, surface);
		assert.doesNotMatch(rendered.source, /undefined/u);
		for(const callback of surface.callbacks.values())
		{
			assert.ok(rendered.vtable.includes(`.${callback.field}_call = lb_owned_`));
			assert.ok(rendered.vtable.includes(`.${callback.field}_dispose = lb_dispose_`));
		}
		assert.equal((rendered.source.match(/static inline lean_object \* lb_invoke_/gu) ?? []).length, 1);
	}
});

test("native callback bindings reject a missing or semantically different public signature", () => {
	const model = modelFor(true, false), surface = surfaceFor(model);
	for(const entry of surface.callbacks.values()) entry.type.callable.parameters.push(entry.type.callable.parameters[0]);
	assert.throws(() => generateNativeCallables(model, surface), /Missing public C callback/u);
});

test("mixed aliased callback C structs compile without pointer casts", { skip: process.env.LEAN_BRIDGE_WIT_STRUCTURED_CALLABLE_TEST !== "1" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-callback-aliases-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [input, result] of [[true, true], [true, false], [false, true]])
	{
		const model = modelFor(input, result), directory = join(root, `${input}-${result}`);
		for(const [path, source] of Object.entries(generateCBindingPackage(model.bindingIr))) await saveLakeFile(directory, path, source);
		await saveLakeFile(directory, "component.h", generateNativeLeanAdapters(model).header);
		await saveLakeFile(directory, "lean_bridge_native_runtime.h", brokerHeader + nativeCallbackHeader);
		await saveLakeFile(directory, "native.c", generateNativePrimitiveC(model, { initializer: "initialize_LeanBridgeNative0123456789abcdef" }));
		const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
		await runCopied("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
			, "-pthread", "-fsyntax-only"
			, "-I", directory
			, "-I", join(directory, "include")
			, "-I", join(directory, "internal")
			, "-I", join(lean, "include")
			, "native.c"], directory, process.env);
	}
});
