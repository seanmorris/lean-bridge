/**
 * Source and parser controls for measured public C++ Fin entrypoints.
 * Installed execution remains in the separately gated native-fin root.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { cppFinDispatchExpected, cppFinDispatchProbe, cppFinDispatchSymbols, cppFinMissingCounter } from "./cpp-fin-dispatch.mjs";
import { nativeFinAdapterSymbol, nativeFinDispatchMutations, nativeFinDispatchSources, nativeFinDispatchSteps, nativeFinDispatchSymbols, readNativeFinDispatch } from "./native-fin-dispatch.mjs";
import { nativeFinReviewedIr } from "./reviewed-fin-fixture.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("C++ scalar Fin symbols must match the actual component and unique model exports", () => {
	const exports = nativeFinDispatchSources.map(name => ({
		name: `NativeFin.${name}`
		, symbol: nativeFinAdapterSymbol("native-fin@1.0.0", `NativeFin.${name}`)
		, parameters: Array(name === "label" ? 3 : 1).fill({})
	}));
	const model = { component: { id: "native-fin@1.0.0" }, exports };
	assert.deepEqual(cppFinDispatchSymbols(model), nativeFinDispatchSymbols("native-fin@1.0.0"));
	for(const mutate of [
		copy => { copy.component.id = "wrong@1.0.0"; }
		, copy => { copy.exports.pop(); }
		, copy => { copy.exports.push(copy.exports[0]); }
		, copy => { copy.exports[0].symbol = nativeFinAdapterSymbol("wrong@1.0.0", "NativeFin.mirror"); }
		, copy => { copy.exports[2].parameters.pop(); }
	]) {
		const copy = structuredClone(model); mutate(copy);
		assert.throws(() => cppFinDispatchSymbols(copy));
	}
});

test("C++ scalar Fin rows reject wrong errors, reordered calls, hidden entries and compensated totals", () => {
	const { valid, mutations } = nativeFinDispatchMutations(cppFinDispatchExpected);
	assert.deepEqual(readNativeFinDispatch(valid, cppFinDispatchExpected), cppFinDispatchExpected);
	assert.equal(cppFinDispatchExpected.length, 12);
	for(const [reason, output] of Object.entries(mutations))
		assert.throws(() => readNativeFinDispatch(output, cppFinDispatchExpected), undefined, reason);
	assert.deepEqual(cppFinDispatchExpected.at(-1)[2], [2, 0, 2, 2, 0, 2]);
});

test("C++ scalar Fin probe uses the public wrapper and exact native error contract", () => {
	const source = cppFinDispatchProbe();
	assert.match(source, /#include <native_fin\.hpp>/u);
	assert.match(source, /namespace api = lean_bridge::native_fin;/u);
	assert.match(source, /error\.status != NATIVE_FIN_STATUS_INVALID_ARGUMENT \|\| error\.code != NATIVE_FIN_ERROR_INVALID_ARGUMENT \|\| std::string\(error.what\(\)\) != message/u);
	assert.ok(source.includes(JSON.stringify(cppFinMissingCounter)));
	assert.ok(source.indexOf("if (!counter)") < source.indexOf('report("start"'));
	assert.match(source, /Nat\("1180591620717411303424"\)/u);
	assert.doesNotMatch(source, /lean\/lean\.h|lean_box|lb_[0-9a-f]{24}|l_NativeFin_/u);
	for(const [step, method, , outcome] of nativeFinDispatchSteps)
	{
		assert.ok(source.includes(JSON.stringify(step)), step);
		if(method) assert.ok(source.includes(`api::${method}(`), method);
		if(outcome.rejected) assert.ok(source.includes(`${outcome.rejected[0]} is not below its Fin ${outcome.rejected[1]} bound`));
	}
});

test("C++ scalar Fin probe compiles against generated public C++ declarations", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-fin-probe-syntax-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = nativeFinReviewedIr(), c = generateCBindingPackage(ir), cpp = generateCppBindingPackage(ir);
	await saveLakeFile(root, "native_fin.h", c["include/native_fin.h"]);
	await saveLakeFile(root, "native_fin.hpp", cpp["include/native_fin.hpp"]);
	for(const [path, bytes] of Object.entries(boostSources())) await saveLakeFile(root, path, bytes);
	await saveLakeFile(root, "probe.cpp", cppFinDispatchProbe());
	// This checks C++ syntax only. Real installed packages and entry counts are tested by the gated producer.
	const result = await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-DBOOST_MP_STANDALONE", "-I", root, "-I", join(root, "include"), "-fsyntax-only", "probe.cpp"], root
		, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});
