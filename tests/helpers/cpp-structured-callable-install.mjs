/**
 * Check installed C++ structured types, allocation failures and source-free use.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { boostIdentity, boostSources } from "../../src/backends/cpp/boost.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";

/**
 * Require per-shape fault injection, not only a successful aggregate count.
 *
 * @param text - Complete JSON observation from the public C++ consumer.
 */
export const parseStructuredCppResult = text => {
	const result = JSON.parse(text);
	assert.ok(result.checks > 1000);
	assert.deepEqual(result.faults.map(item => item.shape), ["array", "list", "option", "result", "tuple", "record", "variant", "alias"]);
	for(const item of result.faults)
	{
		assert.equal(item.cases, 48);
		assert.ok(item.failures > 0);
	}
	assert.equal(result.allocationFailures, result.faults.reduce((count, item) => count + item.failures, 0));
	return result;
};

/**
 * Compile typed negative callers and sanitize the same installed public API.
 *
 * @param options - Source-free consumer, prepared packages and prior observation.
 * @param options.consumer - Owned consumer workspace.
 * @param options.handoff - Relocated archives to remove before final execution.
 * @param options.packages - Verified package receipt entries.
 * @param options.observed - Successful public-consumer observations to reproduce.
 * @param options.parseResult - Acceptance predicate for the exact selected shapes.
 */
export const checkStructuredCppInstallation = async ({ consumer, handoff, packages, observed, parseResult = parseStructuredCppResult }) => {
	const root = join(consumer, "cpp"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}-cpp`);
	const deployment = join(consumer, "runtime-only"), deployed = join(deployment, "consumer");
	for(const [path, bytes] of Object.entries(boostSources())) assert.equal(await readFile(join(installed, path), "utf8"), bytes);
	const env = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", pkg.name], root, env)).stdout.trim().split(/\s+/u);
	const negatives = [
		["argument", 'api::call_record(42, [](api::Payload value) { return value; });']
		, ["callback-argument", 'api::call_record({}, [](std::string value) { return value; });']
		, ["callback-result", 'api::call_record({}, [](api::Payload) { return std::string{}; });']
		, ["borrowed-result", 'api::Payload value{}; api::call_record(value, [&](api::Payload) -> const api::Payload& { return value; });']
		, ["option-null", 'api::call_option(nullptr, [](std::optional<std::optional<std::monostate>> value) { return value; });']
		, ["closure-argument", 'api::make_record({}).call(true, 42);']
		, ["closure-copy", 'auto original = api::make_record({}); auto copied = original; (void)copied;']
	];
	const rejected = [];
	for(const [name, statement] of negatives)
	{
		const source = `#include "structured.hpp"\nnamespace api = lean_bridge::structured;\nint main() { ${statement} }\n`;
		await saveLakeFile(root, `${name}.cpp`, source);
		const failure = await captureCorpusCompiler("/usr/bin/c++", [
			"-std=c++20"
			, "-Wall"
			, "-Wextra"
			, "-Werror"
			, "-fsyntax-only"
			, "-fdiagnostics-format=json"
			, ...flags.filter(flag => flag.startsWith("-I") || flag.startsWith("-D"))
			, `${name}.cpp`], root, env);
		assert.equal(failure.code, 1, failure.stderr);
		const diagnostics = JSON.parse(failure.stderr).filter(item => item.kind === "error");
		assert.ok(diagnostics.length > 0 && diagnostics.every(item => item.locations.some(location => location.caret.file === `${name}.cpp`)), failure.stderr);
		rejected.push({ name, sourceSha256: sha256(source), diagnostics: diagnostics.length });
	}
	const executable = join(root, "sanitized");
	await runCopied("/usr/bin/c++", [
		"-std=c++20"
		, "-Wall"
		, "-Wextra"
		, "-Werror"
		, "-UNDEBUG"
		, "-g"
		, "-fsanitize=address,undefined"
		, "-fno-sanitize-recover=all"
		, "-fno-omit-frame-pointer"
		, "-no-pie"
		, "consumer.cpp"
		, ...flags
		, "-Wl,-rpath,$ORIGIN/lib"
		, "-o"
		, executable], root, env);
	const sanitizedEnvironment = { ...env, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", LSAN_OPTIONS: "exitcode=0", UBSAN_OPTIONS: "halt_on_error=1" };
	const startup = await runCopied(executable, ["--startup-only"], root, sanitizedEnvironment);
	const executed = await runCopied(executable, [], root, sanitizedEnvironment);
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS")
		.replaceAll(`${installed}/lib/pkgconfig/../../lib/`, "<libraries>/")
		.replaceAll(`${installed}/lib/`, "<libraries>/")
		.replaceAll(`${deployment}/lib/`, "<libraries>/");
	assert.equal(normalize(executed.stderr), normalize(startup.stderr), "C++ structured conversions changed the startup leak report");
	assert.doesNotMatch(executed.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.deepEqual(parseResult(executed.stdout), observed);
	const leak = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked in (\d+) allocation\(s\)/u.exec(startup.stderr);
	if(startup.stderr)
	{
		assert.ok(leak, startup.stderr);
		assert.match(startup.stderr, /__gmp_default_allocate/u);
	}
	await cp(join(installed, "lib"), join(deployment, "lib"), { recursive: true });
	await cp(executable, deployed);
	await rm(root, { recursive: true, force: true });
	await rm(handoff, { recursive: true, force: true });
	const rerun = await runCopied(deployed, [], deployment, { ...sanitizedEnvironment, PATH: "/unavailable" });
	assert.deepEqual(parseResult(rerun.stdout), observed);
	assert.equal(normalize(rerun.stderr), normalize(startup.stderr));
	return {
		rejected
		, boost: boostIdentity
		, boostFiles: Object.keys(boostSources()).length
		, sanitizers: ["address", "leak", "undefined"]
		, executableSha256: sha256(await readFile(deployed))
		, sourceFreeExecution: true
		, compilerFreeExecution: true
		, archivesRemoved: true
		, startupLeakBaseline: {
			bytes: Number(leak?.[1] ?? 0)
			, allocations: Number(leak?.[2] ?? 0)
			, unchangedAfterConversions: true
			, report: normalize(startup.stderr).replaceAll(consumer, "<consumer>") } };
};
