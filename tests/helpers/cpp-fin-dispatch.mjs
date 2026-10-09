/**
 * Count actual installed C++ scalar Fin calls without modifying package libraries.
 * These observations cover the public C++ wrapper, not a raw C adapter caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { cIdentifier } from "../../src/backends/c/generate.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nativeFinAdapterSymbol, nativeFinCountInterposerFor, nativeFinDispatchSources, nativeFinDispatchSteps, nativeFinDispatchSymbols, readNativeFinDispatch } from "./native-fin-dispatch.mjs";

export const cppFinMissingCounter = "native_fin_dispatch_count is not resolvable in this C++ process\n";
const validateNames = names => {
	assert.deepEqual(Object.keys(names).sort(), [...nativeFinDispatchSources].sort());
	for(const method of nativeFinDispatchSources)
	{
		assert.ok(Array.isArray(names[method]));
		assert.equal(names[method].length, method === "label" ? 3 : 1);
		assert.equal(new Set(names[method]).size, names[method].length);
		for(const name of names[method]) assert.match(name, /^[a-z][a-z0-9_]*$/u);
	}
};

/**
 * Read public argument labels from the verified contract, including reviewed aliases.
 * NativeFin's Lean binder spelling does not dictate independently reviewed public names.
 *
 * @param model - Verified installed model, including its binding IR.
 */
export const cppFinDispatchParameterNames = model => {
	assert.equal(model.component.id, "native-fin@1.0.0");
	assert.equal(model.bindingIr.component.id, model.component.id);
	const names = Object.fromEntries(nativeFinDispatchSources.map(method => {
		const matches = model.bindingIr.declarations.filter(item => item.source.declaration === `NativeFin.${method}`);
		assert.equal(matches.length, 1, method);
		return [method, matches[0].parameters.map(parameter => cIdentifier(parameter.name))];
	}));
	validateNames(names);
	return names;
};

const rejectionName = (names, method, outcome) => names[method][Number(outcome.rejected[0].slice(3))];

/**
 * Exact rows with the error labels published by this package, not inferred from its route.
 *
 * @param names - Verified per-export public argument labels.
 */
export const cppFinDispatchExpected = names => {
	validateNames(names);
	return nativeFinDispatchSteps.map(([step, method, , outcome, counts]) => [step
		, outcome.ok === null ? "ok" : outcome.rejected
			? `invalid:1:1:${rejectionName(names, method, outcome)}:${outcome.rejected[1]}` : `ok:${outcome.ok}`
		, counts]);
};

/**
 * Check the fixture's actual compiled model before using its adapter symbols.
 *
 * @param model - Receipt-verified installed NativeFin model.
 */
export const cppFinDispatchSymbols = model => {
	assert.equal(model.component.id, "native-fin@1.0.0");
	for(const name of nativeFinDispatchSources)
	{
		const matches = model.exports.filter(item => item.name === `NativeFin.${name}`);
		assert.equal(matches.length, 1, name);
		assert.equal(matches[0].symbol, nativeFinAdapterSymbol(model.component.id, matches[0].name));
		assert.equal(matches[0].parameters.length, name === "label" ? 3 : 1);
	}
	return nativeFinDispatchSymbols(model.component.id);
};

/**
 * Render public C++ API calls and exact values/errors, with one counter row per call.
 *
 * @param names - Verified per-export public argument labels.
 */
export const cppFinDispatchProbe = names => {
	const expected = cppFinDispatchExpected(names);
	const calls = nativeFinDispatchSteps.map(([step, method, args, outcome], index) => {
		if(method === null) return '    report("start", "ok");';
		const call = `api::${method}(${args.map(value => typeof value === "bigint" ? `Nat("${value}")` : JSON.stringify(value)).join(", ")})`;
		const status = JSON.stringify(expected[index][1]);
		if(outcome.rejected)
		{
			const parameter = rejectionName(names, method, outcome), bound = outcome.rejected[1];
			return `    refused(${JSON.stringify(step)}, [] { (void)${call}; }, ${JSON.stringify(`${parameter} is not below its Fin ${bound} bound`)}, ${status});`;
		}
		return `    if (${call} != ${method === "label" ? JSON.stringify(outcome.ok) : `Nat("${outcome.ok}")`}) throw std::runtime_error("${step}: result differs");
    report("${step}", ${status});`;
	}).join("\n");
	return `#include <native_fin.hpp>
#include <dlfcn.h>
#include <iostream>
#include <stdexcept>
#include <string>
namespace api = lean_bridge::native_fin;
using Nat = api::Nat;
static unsigned long (*counter)(unsigned);
static void report(const char *step, const char *status) {
  std::cout << step << ' ' << status;
  for (unsigned i = 0; i < 6; ++i) std::cout << ' ' << counter(i);
  std::cout << '\\n';
}
template<class F> static void refused(const char *step, F call, const char *message, const char *status) {
  try { call(); }
  catch (const api::Error& error) {
    if (error.status != NATIVE_FIN_STATUS_INVALID_ARGUMENT || error.code != NATIVE_FIN_ERROR_INVALID_ARGUMENT || std::string(error.what()) != message)
      throw std::runtime_error(std::string(step) + ": unexpected rejection: " + error.what());
    report(step, status);
    return;
  }
  throw std::runtime_error(std::string(step) + ": invalid call returned");
}
int main() {
  counter = reinterpret_cast<unsigned long (*)(unsigned)>(dlsym(RTLD_DEFAULT, "native_fin_dispatch_count"));
  if (!counter) { std::cerr << ${JSON.stringify(cppFinMissingCounter)}; return 2; }
  try {
${calls}
  } catch (const std::exception& error) {
    std::cerr << error.what() << '\\n';
    return 1;
  }
  return 0;
}
`;
};

/**
 * Run the public C++ probe against the moved installed tree. The caller has verified the handoff
 * receipt and removed the author source. No compiler or Lean installation is on the execution PATH.
 *
 * @param root0 - Fixture installation and its compiled model.
 * @param root0.consumer - Private consumer directory containing cpp-relocated.
 * @param root0.packages - Verified C++ entries from the package-set receipt.
 * @param root0.model - Model captured from the author build before its removal.
 */
export const observeCppFinDispatch = async ({ consumer, packages, model }) => {
	const root = join(consumer, "cpp-relocated"), pkg = packages.find(item => item.role === "component");
	assert.ok(pkg); assert.equal(pkg.target, "cpp");
	await assert.rejects(access(join(consumer, "cpp")), error => error.code === "ENOENT");
	const installed = join(root, `${pkg.name}-${pkg.version}-cpp`);
	const receiptPath = join(installed, "lean-bridge-package.json"), receiptBytes = await readFile(receiptPath);
	const receipt = JSON.parse(receiptBytes);
	assert.equal(receipt.kind, "lean-bridge-native-c-package"); assert.equal(receipt.ecosystem, "cpp");
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.deepEqual(receipt.component, model.component); assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	await verifyNativeFiles(installed, receipt.files);
	const modelPath = "share/lean-bridge/component/model.json";
	assert.ok(receipt.files[modelPath], "the installed model must belong to the verified inventory");
	const installedModel = JSON.parse(await readFile(join(installed, modelPath)));
	assert.equal(canonicalJson(installedModel), canonicalJson(model));
	const columns = cppFinDispatchSymbols(installedModel);
	const parameterNames = cppFinDispatchParameterNames(installedModel);
	const expected = cppFinDispatchExpected(parameterNames);
	const libraries = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => /^lib\/[^/]+\.so(?:\.[0-9]+)*$/u.test(path)));
	assert.ok(Object.keys(libraries).length > 0);
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const definitions = new Map(columns.map(symbol => [symbol, []]));
	for(const path of Object.keys(libraries))
	{
		const listed = await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(installed, path)], root, compile);
		for(const line of listed.stdout.split("\n"))
		{
			const [, kind, symbol] = line.trim().split(/\s+/u);
			if(definitions.has(symbol))
			{ assert.equal(kind, "T", symbol); definitions.get(symbol).push(path); }
		}
	}
	const definers = columns.map(symbol => {
		assert.equal(definitions.get(symbol).length, 1, `${symbol}: exactly one installed definition`);
		return definitions.get(symbol)[0];
	});
	const probeRoot = join(consumer, "cpp-dispatch"), interposer = join(probeRoot, "libdispatch.so");
	const source = cppFinDispatchProbe(parameterNames), instrument = nativeFinCountInterposerFor(model.component.id);
	await saveLakeFile(probeRoot, "probe.cpp", source);
	await saveLakeFile(probeRoot, "interposer.c", instrument);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libdispatch.so"], probeRoot, compile);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/u);
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "probe.cpp", ...flags, "-ldl", "-o", "probe"], probeRoot, compile);
	const executable = join(probeRoot, "probe");
	await assert.rejects(runCopied(executable, [], root), error => /exited with status 2/u.test(error.message)
		&& error.details.stdout === "" && error.details.stderr === cppFinMissingCounter);
	const run = await runCopied(executable, [], root, { ...copiedCleanEnvironment, LD_PRELOAD: interposer });
	assert.equal(run.stderr, "");
	const observed = readNativeFinDispatch(run.stdout, expected);
	const repeat = await runCopied(executable, [], root, { ...copiedCleanEnvironment, LD_PRELOAD: interposer });
	assert.equal(repeat.stderr, ""); assert.equal(repeat.stdout, run.stdout);
	await verifyNativeFiles(installed, receipt.files);
	assert.deepEqual(await readFile(receiptPath), receiptBytes);
	return { kind: "cpp-public-fin-entry-v1"
		, columns, observed, definers, libraries, parameterNames
		, instrument: "LD_PRELOAD"
		, scope: "public C++ scalar Fin calls in two cold C++ processes; no raw-adapter caller in this observation"
		, routes: "native_fin.hpp -> public C ABI -> checked runtime -> typed adapter -> Lean source"
		, positiveControl: "valid public C++ calls increment source and adapter; invalid calls increment neither"
		, missingInstrumentRejected: true, repeatedColdProcess: true
		, installedFilesUnchanged: true
		, probeSha256: sha256(source), interposerSha256: sha256(instrument)
		, executableSha256: sha256(await readFile(executable))
		, packageReceiptSha256: sha256(receiptBytes) };
};
