/**
 * Public C/GMP recursive callable packages, with no Lean consumer dependency.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCallableCGraphPackage } from "../src/backends/c/callable-graph-package.mjs";
import { createNativeCallableGraphDescriptor } from "../src/build/native-callable-graph.mjs";
import { generateNativeCallableGraphCalls } from "../src/backends/c/native-callable-graph-calls.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeRecursiveCallableArities, nativeRecursiveCallableExports, nativeRecursiveCallableReviewedIr, nativeRecursiveCallableSource } from "./helpers/native-recursive-callable-fixture.mjs";
import { parseRecursiveCallableCResult, recursiveCallableCConsumer, recursiveCallableCFaultConsumer } from "./helpers/c-recursive-callable-fixture.mjs";
import { checkRecursiveCallableCFaults } from "./helpers/c-recursive-callable-faults.mjs";

const checkRuntimeOnly = async ({ consumer, handoff, packages, observed }) => {
	const root = join(consumer, "c"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}-c`), deployment = join(consumer, "runtime-only");
	const env = { ...copiedCleanEnvironment, PATH: join(root, "tools")
		, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", pkg.name], root, env)).stdout.trim().split(/\s+/u);
	const executable = join(root, "sanitized"), deployed = join(deployment, "consumer");
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "-UNDEBUG"
		, "-g", "-fsanitize=address,undefined", "-fno-sanitize-recover=all"
		, "-fno-omit-frame-pointer", "-no-pie", "consumer.c", ...flags
		, "-Wl,-rpath,$ORIGIN/lib", "-o", executable], root, env);
	const environment = { ...env, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
		, LSAN_OPTIONS: "exitcode=0", UBSAN_OPTIONS: "halt_on_error=1" };
	const startup = await runCopied(executable, ["--startup-only"], root, environment);
	const executed = await runCopied(executable, [], root, environment);
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS")
		.replaceAll(`${installed}/lib/pkgconfig/../../lib/`, "<libraries>/")
		.replaceAll(`${installed}/lib/`, "<libraries>/").replaceAll(`${deployment}/lib/`, "<libraries>/");
	assert.equal(normalize(executed.stderr), normalize(startup.stderr), "C/GMP callbacks changed the startup leak report");
	assert.doesNotMatch(executed.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.deepEqual(parseRecursiveCallableCResult(executed.stdout), observed);
	const leak = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked in (\d+) allocation\(s\)/u.exec(startup.stderr);
	if(startup.stderr)
	{ assert.ok(leak, startup.stderr); assert.match(startup.stderr, /__gmp_default_allocate/u); }
	await cp(join(installed, "lib"), join(deployment, "lib"), { recursive: true });
	await cp(executable, deployed);
	await rm(root, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	const rerun = await runCopied(deployed, [], deployment, { ...environment, PATH: "/unavailable" });
	assert.deepEqual(parseRecursiveCallableCResult(rerun.stdout), observed);
	assert.equal(normalize(rerun.stderr), normalize(startup.stderr));
	return { sanitizers: ["address", "leak", "undefined"]
		, sourceFreeExecution: true, compilerFreeExecution: true
		, archivesRemoved: true
		, executableSha256: sha256(await readFile(deployed))
		, startupLeakBaseline: { bytes: Number(leak?.[1] ?? 0)
			, allocations: Number(leak?.[2] ?? 0)
			, unchangedAfterConversions: true, report: normalize(startup.stderr) } };
};

test("C/GMP recursive callback headers and implementation compile without Lean headers", { timeout: 180_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-c-recursive-callable-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const ir = nativeRecursiveCallableReviewedIr();
	const generated = generateCallableCGraphPackage(ir);
	const native = generateNativeCallableGraphCalls(ir, createNativeCallableGraphDescriptor(ir), { initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	const files = { ...generated.files
		, "include/detail/structured-graph-types.h": native.typesHeader
		, "include/detail/structured-callable-borrows.h": native.borrowsHeader
		, "include/detail/structured-graph.h": native.header + "\nint structured_graph_ready(void); void structured_graph_retire(void); uint32_t structured_graph_initialize(void);\n"
		, "include/lean_bridge_native_runtime.h": brokerHeader
		, "consumer.c": recursiveCallableCConsumer()
		, "fault-consumer.c": recursiveCallableCFaultConsumer() };
	for(const [path, text] of Object.entries(files)) await saveLakeFile(directory, path, text);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "-fsyntax-only"
		, "-Igmp/include", "consumer.c", "fault-consumer.c"], directory);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "-Iinclude", "-Iinclude/detail", "-Igmp/include", "-Igmp/internal"
		, "-Igmp/include/detail", "-c", "gmp/src/structured_gmp.c"
		, "-o", "gmp.o"], directory
		, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
});

test("prepared recursive C/GMP callbacks run from relocated archives and runtime-only deployments", {
	skip: process.env.LEAN_BRIDGE_C_RECURSIVE_CALLABLE_TEST !== "1"
	, timeout: 900_000
}, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-c-recursive-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-c-recursive-callable-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Structured.lean", await nativeRecursiveCallableSource());
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { c: { name: "structured", version: "1.0.0" } }
			, ...path === "ordinary-source" ? { exports: nativeRecursiveCallableExports, arities: nativeRecursiveCallableArities } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(nativeRecursiveCallableReviewedIr()));
		const environment = nativeFixtureEnvironment(["c"]);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.equal(model.schemaVersion, path === "ordinary-source" ? 4 : 5);
		assert.equal(model.exports.length, 33);
		const faults = await checkRecursiveCallableCFaults(outputRoot, join(author, "faults"), environment);
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await rm(author, { recursive: true, force: true }); await rename(incoming, handoff);
		const { command, ...observation } = await installCopiedConsumer({
			profile: "c", consumer, handoff
			, packages: receipt.packages, environment
			, fixture: { source: recursiveCallableCConsumer, parseResult: parseRecursiveCallableCResult } });
		assert.ok(command.startsWith(consumer));
		const safety = await checkRuntimeOnly({ consumer, handoff, packages: receipt.packages, observed: observation.result });
		reports.push({ path, profile: "c", ...observation, safety, faults
			, packages: receipt.packages, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, relocatedBeforeInstallation: true });
		t.diagnostic(JSON.stringify(observation.result));
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile(resolve("build/recursive-callables"), "c.json", canonicalJson({ schemaVersion: 1, reports }));
});
