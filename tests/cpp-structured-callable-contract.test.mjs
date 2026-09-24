/**
 * Structured C++ callback admission, scoped type names and typed public callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateCppBindingPackage } from "../src/backends/cpp/generate.mjs";
import { compilePrimitiveCppModel } from "../src/backends/cpp/primitives.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertCppStructuredCodegenRegression } from "./helpers/cpp-structured-callable-regression.mjs";

test("structured C++ callables preserve all existing copied fixture packages byte for byte", async () => {
	const record = JSON.parse(await readFile("docs/evidence/cpp-structured-codegen-regression-20260924.json"));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assertCppStructuredCodegenRegression(record);
	const altered = structuredClone(record);
	Object.values(altered.fixtures[0].files)[0].sha256 = "0".repeat(64);
	assert.throws(() => assertCppStructuredCodegenRegression(altered));
});

test("C++ admits copied structured callables while retaining ownership and recursive gates", () => {
	const { surface } = compilePrimitiveCppModel(structuredCallableReviewedIr());
	assert.equal(surface.functions.length, 26); assert.equal(surface.callbacks.size, 14);
	for(const mutate of [
		ir => { ir.types.find(type => type.callable).callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.callable).callable.result.lifetime = { scope: "explicit", anchor: null }; }
		, ir => { ir.types.find(type => type.callable).callable.resultMode = "promise"; }
		, ir => { const callback = ir.types.find(type => type.callable); callback.callable.result.type = { kind: "named", id: callback.id }; }
	]) {
		const ir = structuredCallableReviewedIr(); mutate(ir);
		assert.throws(() => compilePrimitiveCppModel(ir), { code: "unsupported-native-c-signature" });
	}
	assert.throws(() => compilePrimitiveCppModel(structuredCallableReviewedIr({ recursive: true })), { code: "unsupported-native-c-signature" });
});

test("C++ structured callbacks qualify public Result and record types inside helpers", () => {
	const header = generateCppBindingPackage(structuredCallableReviewedIr())["include/structured.hpp"];
	assert.ok(header.includes("::lean_bridge::structured::Result<std::optional<uint32_t>, std::vector<std::string>>"));
	assert.ok(header.includes("::lean_bridge::structured::Payload"));
	assert.doesNotMatch(header, /struct Result \{ Result</u);
});

test("C++ nested callable consumers and helper-shaped public names compile", { timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-structured-types-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [path, bytes] of Object.entries(boostSources())) await saveLakeFile(root, path, bytes);
	const execute = promisify(execFile);
	for(const recordName of ["Payload", "Lease", "CallbackState", "Callback0", "Function1", "View0"])
	{
		const ir = structuredCallableReviewedIr();
		ir.types.find(type => type.id === "lean:Structured.Payload").name = recordName;
		const files = { ...generateCBindingPackage(ir), ...generateCppBindingPackage(ir) };
		for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
		const caller = recordName === "Payload" ? await readFile("tests/fixtures/structured-callable-consumers/cpp.cpp", "utf8")
			: `#include "structured.hpp"\nnamespace api = lean_bridge::structured;\nint main() { api::${recordName} value{}; (void)api::twice_record(value, [](api::${recordName} input) { return input; }); auto closure = api::make_record(value); (void)closure.call(true, value); }\n`;
		await saveLakeFile(root, "consumer.cpp", caller);
		await execute(process.env.CXX ?? "c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude", "consumer.cpp"], { cwd: root, maxBuffer: 1024 * 1024 });
	}
});
