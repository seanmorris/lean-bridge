/**
 * Public recursive C/C++ archives, verified and installed without producer files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedGraphPackageModel, generateCopiedGraphPackage } from "../src/backends/c/graph-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { packageNativeCFamily } from "../src/release/native-c-family.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { gmpIdentity } from "../src/backends/c/gmp.mjs";
import { boostIdentity, boostSources } from "../src/backends/cpp/boost.mjs";
import { generateNativeCopiedGraphAdapters } from "../src/backends/c/native-graph-adapters.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./helpers/native-recursive-transport.mjs";
import { recursiveCarrierAbi } from "./helpers/recursive-carriers.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment, installCopiedConsumer, copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { captureCorpusCompiler } from "./helpers/type-corpus-compiler.mjs";

test("recursive public C/C++ packages preserve named values and ordinary error semantics", () => {
	const ir = nativeRecursiveReviewedIr(), before = structuredClone(ir), output = generateCopiedGraphPackage(ir, ["c", "cpp"]);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedGraphPackage(before, ["c", "cpp"]), output);
	assert.match(output.files["gmp/include/recursive.h"], /recursive_envelope_outcome_ok_t/);
	assert.match(output.files["gmp/include/recursive.h"], /recursive_tree_t_select/);
	assert.match(output.files["include/recursive.hpp"], /throw Error\(status, error\)/);
	assert.match(output.files["include/recursive.hpp"], /if \(failure.status == 4\) recursive_graph_retire/);
	assert.match(output.files["include/detail/recursive-status.h"], /STATUS_INVALID_ARGUMENT = 1/);
	assert.match(output.files["include/detail/recursive-status.h"], /STATUS_UNEXPECTED_ERROR = 5/);
	for(const targets of [[], ["c", "pypi"], ["cpp", "cpp"], ["cpan"]])
		assert.throws(() => compileCopiedGraphPackageModel(ir, targets), { code: "native-graph-projection-unavailable" });
	for(const name of ["graphReady", "graphRetire", "graphInitialize", "graphFinish", "gmpInitialize", "gmpTree"])
	{
		const invalid = structuredClone(ir); invalid.declarations.at(-1).name = name;
		assert.throws(() => compileCopiedGraphPackageModel(invalid, ["c", "cpp"]), /collision|collides/);
	}
});

test("public graph headers compile and C++ maps bridge failures without losing retirement", { timeout: 120_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-graph-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const ir = nativeRecursiveReviewedIr(), template = ir.declarations[0];
	for(const [name, primitive] of [["finish", "unit"], ["natural", "nat"]])
	{
		const type = { kind: "primitive", name: primitive };
		ir.declarations.push({ ...structuredClone(template)
			, id: `lean:Recursive.${name}`, name, overloadKey: name
			, parameters: [{ ...template.parameters[0], type }]
			, result: { ...template.result, type } });
	}
	const output = generateCopiedGraphPackage(ir, ["c", "cpp"]);
	const native = generateNativeCopiedGraphAdapters(ir, recursiveCarrierAbi(ir));
	const files = { ...output.files, ...boostSources()
		, "include/detail/recursive-graph-types.h": native.typesHeader
		, "include/detail/recursive-graph.h": `${native.header}\nextern "C" { int recursive_graph_ready(void); void recursive_graph_retire(void); }\n` };
	for(const [path, content] of Object.entries(files)) await saveLakeFile(directory, path, content);
	await saveLakeFile(directory, "consumer.c", await readFile("tests/fixtures/structured-types/recursive-installed.c", "utf8"));
	const compile = (command, args) => processBuildRunner.capture({ command, args, cwd: directory }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	await compile("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-Igmp/include", "-fsyntax-only", "consumer.c"]);
	await saveLakeFile(directory, "check.cpp", `#include "recursive.hpp"
#include <cassert>
static uint32_t mode;
static int ready = 1, retired;
extern "C" int recursive_graph_ready(void) { return ready; }
extern "C" void recursive_graph_retire(void) { ready = 0; ++retired; }
extern "C" uint32_t recursive_empty_graph(recursive_tree_t *out) {
  out->kind = mode == 6 ? UINT32_MAX : static_cast<uint32_t>(RECURSIVE_TREE_T_KIND_BRANCH);
  return mode < 6 ? mode : 0;
}
int main() {
  namespace api = lean_bridge::recursive;
  assert(api::empty() == api::Tree(api::TreeBranch{}));
  for (mode = 1; mode <= 6; ++mode) {
    ready = 1; retired = 0;
    try { (void)api::empty(); assert(false); }
    catch (const api::Error& error) {
      assert(error.status == (mode <= 2 ? RECURSIVE_STATUS_INVALID_ARGUMENT : RECURSIVE_STATUS_UNEXPECTED_ERROR));
      assert(error.code == (mode <= 2 ? RECURSIVE_ERROR_INVALID_ARGUMENT : RECURSIVE_ERROR_UNEXPECTED));
      assert(*error.what());
    }
    assert(retired == (mode == 4 || mode == 6));
  }
  mode = 0; ready = 0;
  try { (void)api::empty(); assert(false); }
  catch (const api::Error& error) { assert(error.status == RECURSIVE_STATUS_UNEXPECTED_ERROR); }
}
`);
	await compile("c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-Iinclude", "check.cpp", "-o", "check"]);
	await runCopied(join(directory, "check"), [], directory);
});

const inspectInstallation = async ({ consumer, profile, packages, command }) => {
	const root = join(consumer, profile), pkg = packages[0], installed = join(root, `${pkg.name}-${pkg.version}-${profile}`);
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const adapter = JSON.parse(await readFile(join(installed, "share/lean-bridge/native-c-adapter.json")));
	assert.deepEqual(receipt.copiedGraph, adapter.copiedGraph);
	assert.match(receipt.copiedGraph.layoutSha256, /^[a-f0-9]{64}$/);
	const guide = await readFile(join(installed, "README.md"), "utf8");
	assert.match(guide, /128 levels and 262,144 visited nodes/);
	assert.doesNotMatch(guide, /Recursive, callable|32 types deep/);
	let dependency;
	if(profile === "c")
	{
		dependency = JSON.parse(await readFile(join(installed, "share/lean-bridge/gmp.json")));
		for(const [key, value] of Object.entries(gmpIdentity)) assert.equal(dependency[key], value);
		assert.equal(dependency.checked, true); await verifyNativeFiles(installed, dependency.files);
		assert.equal(sha256(await readFile(join(installed, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"))), gmpIdentity.sha256);
	}
	else
	{
		dependency = JSON.parse(await readFile(join(installed, "share/lean-bridge/boost.json")));
		for(const [key, value] of Object.entries(boostIdentity)) assert.equal(dependency[key], value);
		await verifyNativeFiles(installed, dependency.files);
	}
	const env = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", pkg.name], root, env)).stdout.trim().split(/\s+/);
	const cpp = profile === "cpp", compiler = cpp ? "/usr/bin/c++" : "/usr/bin/cc", extension = cpp ? "cpp" : "c", standard = cpp ? "-std=c++20" : "-std=c11";
	const source = cpp ? '#include "recursive.hpp"\nint main() { lean_bridge::recursive::tree(7); }\n'
		: '#include "recursive.h"\nint main(void) { recursive_tree(7, NULL, NULL); }\n';
	await saveLakeFile(root, `invalid.${extension}`, source);
	const invalid = await captureCorpusCompiler(compiler, [standard, "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-fdiagnostics-format=json", ...flags.filter(flag => flag.startsWith("-I")), `invalid.${extension}`], root, env);
	assert.equal(invalid.code, 1, invalid.stderr);
	const diagnostics = JSON.parse(invalid.stderr).filter(item => item.kind === "error");
	assert.ok(diagnostics.length && diagnostics.every(item => item.locations.some(location => location.caret.file === `invalid.${extension}`)), invalid.stderr);
	const cmake = join(root, "cmake");
	await saveLakeFile(cmake, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)\nproject(installed LANGUAGES ${cpp ? "CXX" : "C"})\nfind_package(${receipt.cmakePackage} ${pkg.version} EXACT CONFIG REQUIRED)\nadd_executable(consumer "${join(root, `consumer.${extension}`)}")\ntarget_link_libraries(consumer PRIVATE ${receipt.cmakeTarget})\n`);
	const cmakeEnv = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", CC: compiler, CXX: compiler };
	await runCopied("/usr/bin/cmake", ["-S", cmake, "-B", join(cmake, "build"), `-DCMAKE_PREFIX_PATH=${installed}`], root, cmakeEnv);
	await runCopied("/usr/bin/cmake", ["--build", join(cmake, "build")], root, cmakeEnv);
	const cmakeRun = await runCopied(join(cmake, "build/consumer"), [], root);
	assert.equal(cmakeRun.stderr, ""); assert.match(cmakeRun.stdout, /^recursive-installed-ok:\d+\n$/);
	await runCopied(compiler, [standard, "-Wall", "-Wextra", "-Werror", "-UNDEBUG", `consumer.${extension}`, ...flags.filter(flag => !flag.startsWith("-Wl,-rpath,")), "-Wl,-rpath,$ORIGIN/lib", "-o", command], root, env);
	const deployment = join(consumer, `relocated-${profile}`), executable = join(deployment, "consumer");
	await cp(join(installed, "lib"), join(deployment, "lib"), { recursive: true }); await cp(command, executable);
	await rm(root, { recursive: true, force: true });
	const installedLibraries = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => /^lib\/.*\.so(?:\.|$)/.test(path)));
	await verifyNativeFiles(deployment, installedLibraries);
	const links = (await runCopied("/usr/bin/ldd", [executable], deployment, { PATH: "/usr/bin:/bin" })).stdout;
	assert.ok(links.includes(join(deployment, "lib/liblean_bridge_native.so")), links);
	if(!cpp) assert.ok(links.includes(join(deployment, "lib/libgmp.so.10")), links);
	return { dependency, installedLibraries
		, layoutSha256: receipt.copiedGraph.layoutSha256
		, rejected: { sourceSha256: sha256(source), diagnostics: diagnostics.length }
		, executable, deployment
		, executableSha256: sha256(await readFile(executable))
		, receiptSha256: sha256(canonicalJson(receipt)) };
};

test("prepared recursive C and C++ packages run after removing source, headers and handoff", { skip: process.env.LEAN_BRIDGE_NATIVE_GRAPH_PACKAGE_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-graph-author-")), consumer = await mkdtemp(join(tmpdir(), "lean-bridge-graph-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff"), ir = nativeRecursiveReviewedIr();
		await saveLakeFile(projectRoot, "Recursive.lean", await nativeRecursiveSource());
		await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(projectRoot, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: ["Recursive"]
			, ...path === "ordinary-source" ? { exports: ir.declarations.map(item => item.source.declaration) } : {}
			, targets: { c: { name: "recursive", version: "1.0.0" }, cpp: { name: "recursive", version: "1.0.0" } } }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "recursive.binding-ir.json", canonicalJson(ir));
		const environment = nativeFixtureEnvironment(["c", "cpp"]);
		t.diagnostic(`${path}: building prepared C/C++ graph archives`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "cpp"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const component = JSON.parse(await readFile(join(outputRoot, "native/component/native-component.json")));
		assert.equal(model.schemaVersion, path === "reviewed-ir" ? 5 : 4); assert.equal(model.exports.length, 18);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const adapterRoot = join(outputRoot, "native/c-binding"), adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json")));
		adapter.copiedGraph.layoutSha256 = "0".repeat(64);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
		await assert.rejects(() => packageNativeCFamily({ working: join(author, "tampered"), adapterRoot, nativeRoot: join(outputRoot, "native/component"), runtimeRoot: join(outputRoot, "native/runtime"), leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX, target: "c", glibcMinimumVersion: "2.36" }), /C adapter differs/);
		await rm(author, { recursive: true, force: true });
		const installed = [];
		for(const profile of ["c", "cpp"])
		{
			const packages = receipt.packages.filter(pkg => pkg.target === profile);
			t.diagnostic(`${path}/${profile}: compiling against relocated public headers`);
			const observation = await installCopiedConsumer({
				profile, consumer, handoff, packages, environment
				, fixture: { source: () => readFile(`tests/fixtures/structured-types/recursive-installed.${profile === "c" ? "c" : "cpp"}`, "utf8"), success: "recursive-installed-ok" } });
			const { command, ...observed } = observation;
			const deployment = await inspectInstallation({ consumer, profile, packages, command });
			installed.push({ profile, path, packages
				, ...observed
				, ...deployment
				, sourceRemovedBeforeInstallation: true
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, binarySha256: component.nativeLibrary.sha256
				, modelSha256: sha256(canonicalJson(model)) });
		}
		await rm(handoff, { recursive: true, force: true });
		for(const { executable, deployment, ...report } of installed)
		{
			const executed = await runCopied(executable, [], deployment);
			assert.equal(executed.stderr, ""); assert.equal(executed.stdout, `recursive-installed-ok:${report.checks}\n`);
			reports.push({ ...report, sourceFreeChecks: report.checks
				, handoffRemovedBeforeExecution: true
				, headersRemovedBeforeExecution: true });
			t.diagnostic(`${path}/${report.profile}: ${report.checks} installed and source-free checks`);
		}
		await rm(consumer, { recursive: true, force: true });
	}
	const report = resolve(process.env.LEAN_BRIDGE_NATIVE_GRAPH_PACKAGE_REPORT ?? "build/recursive/c-family.json");
	await saveLakeFile(dirname(report), report.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});

test("recursive C/C++ evidence records exact installed archives without promoting callable payloads", async () => {
	const record = JSON.parse(await readFile("docs/evidence/native-recursive-packages-20260923.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.wordBits, 64); assert.equal(record.packageGlibcFloor, "2.36");
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(nativeRecursiveReviewedIr())));
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports: record.reports })));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.reports.map(run => `${run.path}/${run.profile}`), ["ordinary-source/c", "ordinary-source/cpp", "reviewed-ir/c", "reviewed-ir/cpp"]);
	for(const run of record.reports)
	{
		assert.equal(run.checks, run.profile === "c" ? 1425 : 270); assert.equal(run.sourceFreeChecks, run.checks);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution", "headersRemovedBeforeExecution"])
			assert.equal(run[key], true, key);
		for(const key of ["consumerSha256", "receiptSha256", "sourceTreeSha256", "modelSha256", "bindingIrSha256", "binarySha256", "executableSha256", "layoutSha256"])
			assert.match(run[key], /^[a-f0-9]{64}$/, key);
		assert.equal(run.consumerSha256, record.sourceHashes[`tests/fixtures/structured-types/recursive-installed.${run.profile === "c" ? "c" : "cpp"}`]);
		assert.ok(run.rejected.diagnostics > 0); assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, run.profile); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.artifacts.length, 1); assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		assert.ok(Object.keys(run.installedLibraries).length >= 4);
		for(const [key, value] of Object.entries(run.profile === "c" ? gmpIdentity : boostIdentity)) assert.equal(run.dependency[key], value);
		const previous = record.reproduction.find(item => item.path === run.path && item.profile === run.profile);
		assert.equal(previous.packagesSha256, sha256(canonicalJson(run.packages)));
		assert.equal(previous.checks, run.checks); assert.equal(previous.consumerSha256, run.consumerSha256);
	}
	assert.equal(new Set(record.reports.map(run => run.binarySha256)).size, 1);
	const { document, ...contracts } = await readTypeSurface();
	for(const cell of typeSurfaceCells(document, contracts).filter(cell => ["c", "cpp"].includes(cell.profile) && cell.shape === "recursive"))
	{
		const copied = ["parameter", "result", "field"].includes(cell.position);
		assert.equal(cell.stages.installedExecution.state, copied ? "passed" : "unreviewed", cell.id);
		if(copied) assert.deepEqual(cell.stages.installedExecution.evidence, ["native-recursive-installed"]);
	}
});
