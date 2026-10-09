/**
 * Public C++ FinContainers entry counters (VO #1438): the installed fincontainers.hpp wrapper makes the 24
 * public calls of fin-container-entry-dispatch.mjs under its ten-column LD_PRELOAD interposer, in two cold
 * processes. The separate C raw-adapter observation of the same installed libraries is labelled as that C
 * caller's, never as a C++ call.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { cIdentifier } from "../../src/backends/c/generate.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerDefiners } from "./fin-container-dispatch-gdb.mjs";
import { finContainerEntryColumns, finContainerEntryExpected, finContainerEntryInterposer, finContainerEntryReport, finContainerEntrySources, finContainerEntryStatus, finContainerEntrySteps, readFinContainerEntry } from "./fin-container-entry-dispatch.mjs";
import { observeFinContainerRawAdapters } from "./fin-container-entry-probes.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const cppFinContainerEntryMissing = "fin_container_entry_count is not resolvable in this C++ process\n";
/** The labels the shared rows and the fixture's error texts use; the installed contract must publish exactly these. */
export const cppFinContainerEntryLabels = Object.freeze({ mirrorAll: ["arg0"], sumHuge: ["arg0"], orDefault: ["arg0"], present: ["arg0"], label: ["arg0", "arg1"] });

/**
 * Read each measured export's public argument labels, in their C spelling, from the installed binding IR and
 * require the labels the shared rows expect, before anything is measured.
 *
 * @param model - Receipt-verified installed model, including its binding IR.
 */
export const cppFinContainerEntryParameterNames = model => {
	assert.equal(model.bindingIr.component.id, model.component.id);
	const names = Object.fromEntries(finContainerEntrySources.map(method => {
		const matches = model.bindingIr.declarations.filter(item => item.source.declaration === `FinContainers.${method}`);
		assert.equal(matches.length, 1, method);
		return [method, matches[0].parameters.map(parameter => cIdentifier(parameter.name))];
	}));
	assert.deepEqual(names, cppFinContainerEntryLabels, "the installed contract publishes the labels the rows expect");
	return names;
};

const types = { mirrorAll: [["array", "nat"]], sumHuge: [["list", "nat"]], orDefault: [["option", "nat"]], present: [["array", ["option", "nat"]]], label: [["array", "string"], ["array", "nat"]] };
const results = { mirrorAll: ["array", "nat"], sumHuge: "nat", orDefault: "nat", present: ["array", "nat"], label: "string" };
const cppType = type => type === "nat" ? "Nat" : type === "string" ? "std::string" : type[0] === "option" ? `std::optional<${cppType(type[1])}>` : `std::vector<${cppType(type[1])}>`;
const cppValue = (type, value) => {
	if(type === "nat") return `Nat("${value}")`;
	if(type === "string") return `std::string(${JSON.stringify(value)})`;
	if(type[0] === "option") return value === null ? `${cppType(type)}(std::nullopt)` : `${cppType(type)}(${cppValue(type[1], value.some)})`;
	return `${cppType(type)}{${value.map(item => cppValue(type[1], item)).join(", ")}}`;
};
const cppName = method => method.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`);

/**
 * Public C++ probe. The counter is resolved before any call; each valid result is compared with its exact
 * expected value and each refusal with its status, code and exact message before the row is printed.
 */
export const cppFinContainerEntryProbe = () => {
	const calls = finContainerEntrySteps.slice(1).map(([step, method, args, outcome]) => {
		const call = `api::${cppName(method)}(${types[method].map((type, k) => cppValue(type, args[k])).join(", ")})`;
		const status = JSON.stringify(finContainerEntryStatus(outcome));
		if(outcome.rejected)
			return `    refused(${JSON.stringify(step)}, [] { (void)${call}; }, ${JSON.stringify(`${outcome.rejected[0]} is not below its Fin ${outcome.rejected[1]} bound`)}, ${status});`;
		return `    if (!(${call} == ${cppValue(results[method], outcome.ok)})) throw std::runtime_error(${JSON.stringify(`${step}: result differs`)});
    report(${JSON.stringify(step)}, ${status});`;
	}).join("\n");
	return `#include <fincontainers.hpp>
#include <dlfcn.h>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>
namespace api = lean_bridge::fincontainers;
using Nat = api::Nat;
static unsigned long (*counter)(unsigned);
static void report(const char *step, const char *status) {
  std::cout << step << ' ' << status;
  for (unsigned i = 0; i < 10; ++i) std::cout << ' ' << counter(i);
  std::cout << '\\n';
}
template<class F> static void refused(const char *step, F call, const char *message, const char *status) {
  try { call(); }
  catch (const api::Error& error) {
    if (error.status != FINCONTAINERS_STATUS_INVALID_ARGUMENT || error.code != FINCONTAINERS_ERROR_INVALID_ARGUMENT || std::string(error.what()) != message)
      throw std::runtime_error(std::string(step) + ": unexpected rejection: " + error.what());
    report(step, status);
    return;
  }
  throw std::runtime_error(std::string(step) + ": invalid call returned");
}
int main() {
  counter = reinterpret_cast<unsigned long (*)(unsigned)>(dlsym(RTLD_DEFAULT, "fin_container_entry_count"));
  if (!counter) { std::cerr << ${JSON.stringify(cppFinContainerEntryMissing)}; return 2; }
  try {
    report("start", "ok");
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
 * Run the public C++ probe against the installed C++ package, twice cold, then the separate C raw-adapter
 * probe of the same verified libraries. The caller has verified the handoff receipt and removed the author
 * source; no compiler or Lean installation is on the execution PATH.
 *
 * @param root0 - Installed C++ consumer and its build.
 * @param root0.consumer - Consumer root holding the installed cpp tree.
 * @param root0.packages - Verified C++ entries from the package-set receipt.
 * @param root0.model - Model captured from the author build before its removal.
 * @param root0.environment - Producer toolchain selection, for the raw probe's pinned lean.h.
 */
export const observeCppFinContainerEntry = async ({ consumer, packages, model, environment }) => {
	const root = join(consumer, "cpp"), pkg = packages.find(item => item.role === "component");
	assert.ok(pkg); assert.equal(pkg.target, "cpp");
	const installed = join(root, `${pkg.name}-${pkg.version}-cpp`), receiptPath = join(installed, "lean-bridge-package.json");
	const receiptBytes = await readFile(receiptPath), receipt = JSON.parse(receiptBytes);
	assert.equal(receipt.kind, "lean-bridge-native-c-package"); assert.equal(receipt.ecosystem, "cpp");
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.deepEqual(receipt.component, model.component); assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	await verifyNativeFiles(installed, receipt.files);
	const modelPath = "share/lean-bridge/component/model.json";
	assert.ok(receipt.files[modelPath], "the installed model must belong to the verified inventory");
	const installedModel = JSON.parse(await readFile(join(installed, modelPath)));
	assert.equal(canonicalJson(installedModel), canonicalJson(model));
	const columns = finContainerEntryColumns(installedModel, receipt.component);
	const parameterNames = cppFinContainerEntryParameterNames(installedModel);
	const directory = join(installed, "lib");
	const listed = {};
	for(const path of Object.keys(receipt.files).filter(path => /^lib\/[^/]+\.so(?:\.[0-9]+)*$/u.test(path)))
		listed[path.slice(4)] = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(installed, path)], root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" })).stdout;
	const definedBy = finContainerDefiners(installedModel.component.id, listed);
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const probeRoot = join(consumer, "cpp-entry"), interposer = join(probeRoot, "libentry.so");
	const source = cppFinContainerEntryProbe(), instrument = finContainerEntryInterposer(columns);
	await saveLakeFile(probeRoot, "probe.cpp", source);
	await saveLakeFile(probeRoot, "interposer.c", instrument);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "interposer.c", "-ldl", "-o", "libentry.so"], probeRoot, compile);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/u);
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "probe.cpp", ...flags, "-ldl", "-o", "probe"], probeRoot, compile);
	const executable = join(probeRoot, "probe");
	// Without the interposer the counter is missing and the probe refuses before any public call.
	await assert.rejects(runCopied(executable, [], root), error => /exited with status 2/u.test(error.message)
		&& error.details.stdout === "" && error.details.stderr === cppFinContainerEntryMissing);
	const run = await runCopied(executable, [], root, { ...copiedCleanEnvironment, LD_PRELOAD: interposer });
	assert.equal(run.stderr, "");
	readFinContainerEntry(run.stdout, finContainerEntryExpected);
	const repeat = await runCopied(executable, [], root, { ...copiedCleanEnvironment, LD_PRELOAD: interposer });
	assert.equal(repeat.stderr, ""); assert.equal(repeat.stdout, run.stdout, "a second cold process prints the same rows");
	await verifyNativeFiles(installed, receipt.files);
	assert.deepEqual(await readFile(receiptPath), receiptBytes);
	const identities = {
		probeSha256: sha256(source)
		, interposerSha256: sha256(instrument)
		, executableSha256: sha256(await readFile(executable))
		, packageReceiptSha256: sha256(receiptBytes)
		, definers: columns.map(column => definedBy[column])
		, parameterNames
		, missingInstrumentRefused: true
		, repeatedColdProcess: true
	};
	const caller = "public C++ calls of lean_bridge::fincontainers mirror_all, sum_huge, or_default, present and label through fincontainers.hpp, the public C ABI and the checked runtime into the bundled C adapters";
	const publicHost = { stdout: run.stdout, caller, instrument: "LD_PRELOAD", identities };
	const rawAdapter = await observeFinContainerRawAdapters({ probeRoot: join(probeRoot, "raw"), directory, componentId: installedModel.component.id, columns, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX });
	await verifyNativeFiles(installed, receipt.files);
	const libraries = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.startsWith("lib/") && /\.so(?:\.[0-9]+)*$/u.test(path)));
	return finContainerEntryReport({ publicHost, rawAdapter, columns, componentId: installedModel.component.id, libraries: { directory: "cpp/lib", files: libraries } });
};
