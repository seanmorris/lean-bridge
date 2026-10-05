/**
 * Compile the recursive callable host against its exact native carrier headers.
 * No fixture substitution may hide an ABI mismatch in generated callback calls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { compileCallableWitGraphModel } from "../src/backends/wit/callable-graph-model.mjs";
import { compileCallableWitGraphPackageModel } from "../src/backends/wit/callable-graph-package.mjs";
import { renderWitGraphCallableHostHeader, renderWitGraphCallableHostSource } from "../src/backends/wit/callable-graph-host.mjs";
import { generateNativeCallableGraphCalls } from "../src/backends/c/native-callable-graph-calls.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { witRecursiveCallableValues } from "./helpers/wit-recursive-callable-values.mjs";
import { witRecursiveMixedFixture, witRecursivePrimitiveConsumer } from "./helpers/wit-recursive-callable-mixed.mjs";

for(const fixture of ["independent", "nested", "mixed"])
	test(`recursive WIT ${fixture} host matches the original native callback ABI under strict C`, {
		skip: process.env.LEAN_BRIDGE_WIT_RECURSIVE_CALLABLE_TEST !== "1"
	}, async t => {
		const ir = fixture === "independent" ? structuredCallableReviewedIr({ recursive: true })
			: fixture === "nested" ? nativeRecursiveCallableReviewedIr() : (await witRecursiveMixedFixture()).ir;
		const model = compileCallableWitGraphModel(ir);
		const native = generateNativeCallableGraphCalls(ir, model.native.descriptor, { initializer: "initialize_LeanBridgeNative0000000000000000" });
		assert.deepEqual(model.layout, native.layout);
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-recursive-host-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		await saveLakeFile(root, `${model.prefix}-graph.h`, native.header + `\nuint32_t ${model.prefix}_graph_initialize(void);\nint ${model.prefix}_graph_ready(void);\n`);
		await saveLakeFile(root, `${model.prefix}-graph-types.h`, native.typesHeader);
		await saveLakeFile(root, `${model.prefix}-callable-borrows.h`, native.borrowsHeader);
		await saveLakeFile(root, "lean_bridge_native_runtime.h", brokerHeader);
		await saveLakeFile(root, `${model.prefix}_wasmtime.h`, renderWitGraphCallableHostHeader(model));
		const source = renderWitGraphCallableHostSource(model, new Uint8Array([0]));
		assert.match(source, /lb_active_frame/);
		assert.match(source, /lb_graph_callback_entry\(data,/);
		assert.match(source, /converted\._bridge_owner = owner; converted\._bridge_release = lb_result_release/);
		assert.match(source, /lb_scope_close\(&scope\.memory\); return valid/);
		await saveLakeFile(root, "host.c", source);
		const sdk = resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42");
		await runCopied("cc", ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror"
			, "-pthread"
			, "-I", root, "-I", join(sdk, "include")
			, "-c", "host.c", "-o", "host.o"], root, process.env);
		const packaged = compileCallableWitGraphPackageModel(ir);
		await saveLakeFile(root, `${model.prefix}_wasmtime.h`, packaged.hostHeader);
		await saveLakeFile(root, "headers.c", `#include "${model.prefix}_wasmtime.h"\n#include "${model.prefix}_wasmtime.h"\n`);
		for(const [compiler, standard, language] of [["cc", "c11", "c"], ["c++", "c++20", "c++"]])
			await runCopied(compiler, [`-std=${standard}`, "-x", language
				, "-Wall", "-Wextra", "-Werror"
				, "-I", root, "-I", join(sdk, "include")
				, "-fsyntax-only", "headers.c"], root, process.env);
		if(fixture !== "independent")
		{
			const consumer = witRecursiveCallableValues(packaged);
			assert.doesNotMatch(consumer, /lb_graph_|lb_entry_|host\.c/);
			await saveLakeFile(root, "values.c", consumer);
			await runCopied("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
				, "-I", root, "-I", join(sdk, "include")
				, "-fsyntax-only", "values.c"], root, process.env);
			if(fixture === "mixed")
			{
				await saveLakeFile(root, "primitives.c", await witRecursivePrimitiveConsumer(packaged));
				await runCopied("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
					, "-I", root, "-I", join(sdk, "include")
					, "-fsyntax-only", "primitives.c"], root, process.env);
			}
		}
	});
