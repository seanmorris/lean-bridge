/**
 * Prepared C++ recursive callbacks, tested after deleting author sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { generateCallableCppGraphPackage } from "../src/backends/cpp/callable-graph-package.mjs";
import { generateCallableCGraphPackage } from "../src/backends/c/callable-graph-package.mjs";
import { createNativeCallableGraphDescriptor } from "../src/build/native-callable-graph.mjs";
import { generateNativeCallableGraphCalls } from "../src/backends/c/native-callable-graph-calls.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeRecursiveCallableArities, nativeRecursiveCallableExports, nativeRecursiveCallableReviewedIr, nativeRecursiveCallableSource } from "./helpers/native-recursive-callable-fixture.mjs";
import { nativeFixtureEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { checkStructuredCppInstallation } from "./helpers/cpp-structured-callable-install.mjs";
import { recursiveCallableCppConsumer, parseRecursiveCallableCppResult } from "./helpers/cpp-recursive-callable-fixture.mjs";
import { recursiveCallableCConsumer, parseRecursiveCallableCResult } from "./helpers/c-recursive-callable-fixture.mjs";
import { prepareRecursiveCFamilyInstallation } from "./helpers/c-family-recursive-callable-install.mjs";

test("C++ recursive callback headers instantiate all nine shapes without Lean headers", { timeout: 180_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-cpp-recursive-callable-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const ir = nativeRecursiveCallableReviewedIr();
	const generated = generateCallableCppGraphPackage(ir);
	const native = generateNativeCallableGraphCalls(ir, createNativeCallableGraphDescriptor(ir), { initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	const files = { ...generated.files, ...boostSources()
		, "include/detail/structured-graph-types.h": native.typesHeader
		, "include/detail/structured-callable-borrows.h": native.borrowsHeader
		, "include/detail/structured-graph.h": native.header + '\nextern "C" { int structured_graph_ready(void); void structured_graph_retire(void); }\n' };
	for(const [path, text] of Object.entries(files)) await saveLakeFile(directory, path, text);
	await saveLakeFile(directory, "consumer.cpp", await recursiveCallableCppConsumer());
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude", "consumer.cpp"], directory);
});

test("C++ callable graph admission rejects empty callback signatures", () => {
	const ir = nativeRecursiveCallableReviewedIr();
	ir.types.find(type => type.kind === "callback").callable.parameters = [];
	assert.throws(() => generateCallableCppGraphPackage(ir), /callback arity must be 1 through 16/);
});

test("recursive C and C++ public headers coexist in either include order", { timeout: 180_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-c-family-recursive-callable-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const ir = nativeRecursiveCallableReviewedIr();
	const native = generateNativeCallableGraphCalls(ir, createNativeCallableGraphDescriptor(ir), { initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	const files = { ...generateCallableCGraphPackage(ir).files, ...generateCallableCppGraphPackage(ir).files, ...boostSources()
		, "include/detail/structured-graph-types.h": native.typesHeader
		, "include/detail/structured-callable-borrows.h": native.borrowsHeader
		, "include/detail/structured-graph.h": native.header + '\nextern "C" { int structured_graph_ready(void); void structured_graph_retire(void); }\n' };
	for(const [path, text] of Object.entries(files)) await saveLakeFile(directory, path, text);
	for(const order of [["structured.h", "structured.hpp"], ["structured.hpp", "structured.h"]])
	{
		await saveLakeFile(directory, "both.cpp", order.map(file => `#include "${file}"`).join("\n")
			+ "\nvoid consumer() { structured_tree_t tree; structured_tree_t_init(&tree); structured_tree_t_clear(&tree); lean_bridge::structured::Tree other = lean_bridge::structured::TreeLeaf{17}; (void)other; }\n");
		await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fmax-errors=3", "-fsyntax-only", "-Iinclude", "-Igmp/include", "both.cpp"], directory);
	}
});

test("prepared recursive C/C++ callbacks share one runtime after relocation and source removal", {
	skip: process.env.LEAN_BRIDGE_CPP_RECURSIVE_CALLABLE_TEST !== "1"
	, timeout: 900_000
}, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-cpp-recursive-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-cpp-recursive-callable-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Structured.lean", await nativeRecursiveCallableSource());
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { c: { name: "structured", version: "1.0.0" }, cpp: { name: "structured", version: "1.0.0" } }
			, ...path === "ordinary-source" ? { exports: nativeRecursiveCallableExports, arities: nativeRecursiveCallableArities } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(nativeRecursiveCallableReviewedIr()));
		const environment = nativeFixtureEnvironment(["c", "cpp"]);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "cpp"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.equal(model.schemaVersion, path === "ordinary-source" ? 4 : 5);
		assert.equal(model.exports.length, 33);
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await rm(author, { recursive: true, force: true }); await rename(incoming, handoff);
		const cppPackages = receipt.packages.filter(item => item.target === "cpp");
		const { command, ...observation } = await installCopiedConsumer({
			profile: "cpp", consumer, handoff
			, packages: cppPackages, environment
			, fixture: { source: recursiveCallableCppConsumer, parseResult: parseRecursiveCallableCppResult } });
		assert.ok(command.startsWith(consumer));
		const { command: cCommand, ...companionC } = await installCopiedConsumer({
			profile: "c", consumer, handoff
			, packages: receipt.packages.filter(item => item.target === "c"), environment
			, fixture: { source: recursiveCallableCConsumer, parseResult: parseRecursiveCallableCResult } });
		assert.ok(cCommand.startsWith(consumer));
		const verifyCombined = await prepareRecursiveCFamilyInstallation({ consumer, handoff, packages: receipt.packages });
		const safety = await checkStructuredCppInstallation({
			consumer, handoff, packages: cppPackages
			, observed: observation.result
			, parseResult: parseRecursiveCallableCppResult });
		await rm(join(consumer, "c"), { recursive: true, force: true });
		const combined = await verifyCombined();
		reports.push({ path, profile: "cpp"
			, ...observation
			, safety, companionC, combined
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, relocatedBeforeInstallation: true });
		t.diagnostic(JSON.stringify(observation.result));
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile(resolve("build/recursive-callables"), "cpp.json", canonicalJson({ schemaVersion: 1, reports }));
});
