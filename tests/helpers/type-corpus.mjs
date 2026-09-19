/**
 * Validate corpus observations without promoting them to type-support claims.
 *
 * @file
 */

import assert from "node:assert/strict";
import { validateReviewedCorpusBuild } from "./type-corpus-reviewed-native.mjs";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { corpusCases, corpusHostCase, corpusLibraries, corpusOracleKeys, corpusSignatures } from "../fixtures/type-corpus/cases.mjs";
import { corpusRustRejection, corpusRustSignatures, corpusRustSource } from "./type-corpus-rust-source.mjs";
import { corpusCFamilyRejection, corpusCFamilySignatures, corpusCFamilySource, corpusCFamilyRuntimeCases, validateCFamilyDiagnostic } from "./type-corpus-c-source.mjs";
import { corpusDotnetRejection, corpusDotnetSignatures, corpusDotnetSource, dotnetRuntimeCases } from "./type-corpus-dotnet-source.mjs";
import { dotnetCompilerOptions } from "./type-corpus-dotnet.mjs";
import { corpusJvmSource, corpusJvmSignatures, corpusJvmRejection, jvmRuntimeCases } from "./type-corpus-jvm-source.mjs";
import { javaCompilerOptions, kotlinCompilerOptions, mavenSettings } from "./type-corpus-jvm-tools.mjs";
import { validatePhpEvidence } from "./type-corpus-php.mjs";
import { validatePhpWasmEvidence } from "./type-corpus-php-wasm-evidence.mjs";
import { validateWitEvidence } from "./type-corpus-wit-evidence.mjs";
import { corpusWitRejection } from "./type-corpus-wit-source.mjs";

export const corpusProfiles = Object.freeze({
	"wit-wasi": Object.freeze({ adapter: "prepared-wit-wasmtime-v1"
		, target: "wit-wasi", transport: "native", moduleKey: "cModule"
		, errors: Object.freeze({ type: "WasmtimeError", range: "WasmtimeError" }) })
	, "php-native": Object.freeze({ adapter: "prepared-composer-v1"
		, target: "php-native"
		, transport: "native", moduleKey: "phpModule"
		, errors: Object.freeze({ type: "TypeError", range: "ValueError" }) })
	, "php-wasm": Object.freeze({ adapter: "prepared-php-wasm-v1"
		, target: "php-wasm", transport: "php-wasm", moduleKey: "phpModule"
		, errors: Object.freeze({ type: "TypeError", range: "ValueError" }) })
	, python: Object.freeze({ adapter: "prepared-wheel-v1", target: "pypi"
		, transport: "native", moduleKey: "pythonModule"
		, errors: Object.freeze({ type: "TypeError", range: "ValueError" }) })
	, ruby: Object.freeze({ adapter: "prepared-gem-v1", target: "rubygems"
		, transport: "native", moduleKey: "rubyModule"
		, errors: Object.freeze({ type: "TypeError", range: "RangeError" }) })
	, perl: Object.freeze({ adapter: "prepared-cpan-prebuilt-v1", target: "cpan"
		, transport: "native", moduleKey: "perlModule"
		, errors: Object.freeze({ type: "croak", range: "croak" }) })
	, rust: Object.freeze({ adapter: "prepared-cargo-v1", target: "cargo"
		, transport: "native", moduleKey: "rustModule", errors: Object.freeze({}) })
	, dotnet: Object.freeze({ adapter: "prepared-nuget-v1", target: "nuget"
		, transport: "native", moduleKey: "dotnetModule"
		, errors: Object.freeze({ type: "ArgumentException", range: "ArgumentOutOfRangeException" }) })
	, ...Object.fromEntries(["c", "cpp"].map(profile => [profile
		, Object.freeze({
			adapter: "prepared-c-family-v1", target: profile
			, transport: "native"
			, moduleKey: "cModule"
			, errors: Object.freeze({ range: profile === "cpp" ? "Error" : "INVALID_ARGUMENT" })
		})
	]))
	, ...Object.fromEntries(["java", "kotlin"].map(profile => [profile
		, Object.freeze({ adapter: "prepared-maven-v1", target: "maven"
			, transport: "native", moduleKey: "jvmModule"
			, errors: Object.freeze({ type: "IllegalArgumentException", range: "IllegalArgumentException" }) })
	]))
	, "node-javascript": Object.freeze({ adapter: "prepared-npm-v1", target: "npm"
		, transport: "wasm", moduleKey: "npmModule"
		, errors: Object.freeze({ type: "TypeError", range: "TypeError" }) })
	, "node-typescript": Object.freeze({ adapter: "prepared-npm-ts-v1"
		, target: "npm", transport: "wasm", moduleKey: "npmModule"
		, errors: Object.freeze({ type: "TypeError", range: "TypeError" }) })
	, ...Object.fromEntries(["browser-javascript", "browser-react", "browser-worker"].map(profile => [profile
		, Object.freeze({
			adapter: "prepared-npm-browser-v1", target: "npm", transport: "wasm"
			, moduleKey: "npmModule", browser: true
			, errors: Object.freeze({ type: "TypeError", range: "TypeError" })
		})
	]))
});

/**
 * Require an explicit, unique list of actual browser engines; never skip one.
 *
 * @param value - Optional comma-separated selection, defaulting to all engines.
 */
export const corpusBrowserSelection = (value = "chromium,firefox,webkit") => {
	assert.equal(typeof value, "string");
	const engines = value.split(",").map(engine => engine.trim()).sort();
	assert.ok(engines.every(engine => ["chromium", "firefox", "webkit"].includes(engine)), "Unknown or empty browser engine");
	assert.equal(new Set(engines).size, engines.length, "Duplicate browser engine");
	return engines;
};

/**
 * Select the independently specified corpus API supported by a transport.
 *
 * @param library - Catalog library.
 * @param profile - Host profile, or undefined for the complete native API.
 */
export const corpusProfileSignatures = (library, profile) => corpusSignatures(library).filter(signature =>
	corpusProfiles[profile]?.transport !== "wasm" || [...signature.parameters, signature.result].every(type => typeof type === "string"));

/**
 * A missing source projection is a gap, not a passed host rejection.
 *
 * @param library - Catalog library.
 * @param entry - Shared input case.
 * @param profile - Selected consumer.
 */
export const corpusCaseSupported = (library, entry, profile) => corpusProfileSignatures(library, profile).some(signature => signature.name === `${library.module}.${entry.operation}`);

const declaredType = type => {
	if(type.kind === "primitive") return type.name;
	if(type.kind === "array") return { array: declaredType(type.element) };
	assert.equal(type.kind, "record");
	return { record: type.name, fields: Object.fromEntries(type.fields.map(field => [field.name, declaredType(field.type)])) };
};

/**
 * Check named types and positions independently of installed transport results.
 *
 * @param library - Expected catalog API.
 * @param model - Fresh compiler-owned native model, not consumer observations.
 * @param profile - Optional transport-specific API selection.
 */
export const validateCorpusDeclarations = (library, model, profile) => {
	const declarations = model.exports.map(entry => ({ name: entry.name
		, parameters: entry.parameters.map(parameter => declaredType(parameter.type))
		, result: declaredType(entry.result) }));
	const sorted = items => [...items].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sorted(declarations), sorted(corpusProfileSignatures(library, profile)), "Compiler declarations differ from the independent corpus signatures");
	return declarations;
};

/**
 * Reject misspelled, empty or duplicate requested adapters instead of skipping them.
 *
 * @param value - Explicit comma-separated profiles; undefined selects fast checks.
 */
export const corpusSelection = value => {
	if(value === undefined) return [];
	assert.equal(typeof value, "string");
	const profiles = value.split(",").map(profile => profile.trim()).sort();
	assert.ok(profiles.every(profile => Object.hasOwn(corpusProfiles, profile)), "Unknown or empty corpus adapter");
	assert.equal(new Set(profiles).size, profiles.length, "Duplicate corpus adapter");
	return profiles;
};

/**
 * Validate case ids and positions against the independently maintained inventory.
 *
 * @param inventory - Parsed type-surface inventory.
 */
export const corpusCatalog = inventory => {
	const cases = corpusLibraries.flatMap(corpusCases);
	assert.equal(new Set(cases.map(entry => entry.id)).size, cases.length);
	assert.deepEqual(corpusLibraries.map(library => library.id), ["shop", "telemetry"]);
	for(const library of corpusLibraries)
	{
		assert.equal(library.snakeOperations.length, library.operations.length);
		assert.equal(new Set(library.snakeOperations).size, library.operations.length);
		assert.ok(library.snakeOperations.every(name => /^[a-z][a-z0-9_]*$/.test(name)));
		for(const profile of Object.values(corpusProfiles)) assert.equal(typeof library[profile.moduleKey], "string");
		assert.equal(corpusSignatures(library).length, library.operations.length);
		for(const entry of cases.filter(entry => entry.library === library.id))
		{
			assert.ok(library.operations.includes(entry.operation));
			assert.equal(entry.arguments.length, corpusSignatures(library).find(signature => signature.name === `${library.module}.${entry.operation}`).parameters.length);
			for(const argument of entry.arguments.filter(value => value.record))
				assert.deepEqual(Object.keys(argument.fields).sort(), [...library.recordFields[argument.record]].sort());
		}
	}
	for(const entry of cases)
	{
		assert.ok(entry.coverage.length);
		assert.ok(/^[A-Za-z][A-Za-z0-9_]*$/.test(entry.operation));
		assert.ok(["value", "float32", "float64"].includes(entry.resultEncoding));
		assert.ok(entry.expectation.kind === "lean-oracle"
			|| entry.expectation.kind === "host-rejection" && ["type", "range"].includes(entry.expectation.category));
		for(const [profile, policy] of Object.entries(entry.hostExpectations))
		{
			assert.ok(Object.hasOwn(corpusProfiles, profile));
			assert.ok(Object.keys(policy).every(key => ["expectation", "oracleKey", "resultEncoding", "rejectionMessage"].includes(key)));
			const selected = corpusHostCase(entry, profile);
			if(selected.expectation.kind === "lean-oracle") assert.equal(typeof selected.oracleKey, "string");
			else if(selected.expectation.kind === "compile-rejection")
			{
				assert.ok(["rust", "c", "cpp", "dotnet", "java", "kotlin", "wit-wasi"].includes(profile));
				assert.ok((profile === "java" ? ["compiler.err.cant.apply.symbol", "compiler.err.prob.found.req"] : profile === "kotlin" ? ["ARGUMENT_TYPE_MISMATCH"] : profile === "dotnet" ? ["CS0029", "CS0220", "CS0221", "CS1503"] : profile === "rust" ? ["E0308", "E0600", "overflowing_literals"] : ["narrowing", "incompatible-type"]).includes(selected.expectation.diagnostic));
			}
			else assert.ok(typeof selected.rejectionMessage === "string" && selected.rejectionMessage.length > 0);
		}
		for(const claim of entry.coverage)
		{
			const shape = inventory.shapes.find(shape => shape.id === claim.shape);
			assert.ok(shape, `Unknown corpus shape: ${claim.shape}`);
			assert.ok(claim.positions.length);
			for(const position of claim.positions)
				assert.ok(inventory.families[shape.family].positions.includes(position), `${entry.id}: invalid ${position}`);
		}
	}
	return { schemaVersion: 1, libraries: corpusLibraries, cases };
};

/**
 * Reject missing, duplicated, extra or mismatched installed observations.
 *
 * @param library - Library being consumed.
 * @param cases - Exact host-neutral inputs handed to the consumer.
 * @param oracle - Results produced by a fresh Lean interpreter run.
 * @param actual - JSON emitted by the installed consumer program.
 */
export const validateCorpusObservation = (library, cases, oracle, actual) => {
	assert.equal(actual.schemaVersion, 1);
	assert.ok(Object.hasOwn(corpusProfiles, actual.profile), "Unknown consumer adapter");
	const wasm = corpusProfiles[actual.profile].transport === "wasm";
	const browser = corpusProfiles[actual.profile].browser;
	assert.equal(actual.module, library[corpusProfiles[actual.profile].moduleKey]);
	const cFamily = ["c", "cpp"].includes(actual.profile);
	const wit = actual.profile === "wit-wasi";
	if(wit) assert.equal(actual.hostVersion, "42.0.1");
	else if(actual.profile === "php-wasm") assert.match(actual.hostVersion, /^8\.4\.\d+$/);
	else if(actual.profile === "php-native") assert.match(actual.hostVersion, /^8\.(?:[2-9]|[1-9]\d+)\.\d+$/);
	else
	assert.match(actual.hostVersion, actual.profile === "java" ? /^22\.\d+\.\d+$/ : actual.profile === "kotlin" ? /^2\.2\.0$/ : actual.profile === "dotnet" ? /^8\.0\.\d+$/ : cFamily ? /^\d+\.\d+(?:\.\d+)?$/ : browser ? /^[0-9]+(?:\.[0-9]+)+$/ : wasm ? /^[0-9]+\.[0-9]+\.[0-9]+$/ : actual.profile === "rust" ? /^1\.(?:9\d|[1-9]\d{2,})\.\d+$/ : actual.profile === "perl" ? /^5\.[0-9]+\.[0-9]+$/ : actual.profile === "ruby" ? /^3\.3\.[0-9]+$/ : /^3\.[0-9]+\.[0-9]+$/);
	if(cFamily) assert.ok(Number(actual.hostVersion.split(".")[0]) >= 12);
	if(wasm && !browser) assert.ok(Number(actual.hostVersion.split(".")[0]) >= 22);
	if(browser) assert.equal(actual.realm, actual.profile === "browser-worker" ? "dedicated-worker" : "window");
	if(actual.profile === "perl")
	{
		assert.ok(Number(actual.hostVersion.split(".")[1]) >= 36);
		assert.equal(actual.abi.ptrsize, "8");
		assert.equal(actual.abi.ivsize, "8");
		assert.equal(actual.abiKey, sha256(JSON.stringify(JSON.parse(canonicalJson(actual.abi)))));
	}
	assert.deepEqual(Object.keys(oracle).sort(), corpusOracleKeys(cases));
	assert.equal(actual.results.length, cases.length);
	assert.deepEqual(actual.results.map(entry => entry.id).sort(), cases.map(entry => entry.id).sort());
	for(const entry of cases.map(entry => corpusHostCase(entry, actual.profile)))
	{
		const observed = actual.results.find(result => result.id === entry.id);
		if(!corpusCaseSupported(library, entry, actual.profile))
		{
			assert.deepEqual(observed, { id: entry.id, status: "unsupported", export: `${library.module}.${entry.operation}` });
			continue;
		}
		if(entry.expectation.kind === "lean-oracle")
		{
			assert.equal(observed.status, "matched", entry.id);
			assert.deepEqual(observed.observed, oracle[entry.oracleKey], entry.id);
			assert.equal(observed.independentCopy, entry.checkIndependentCopy, entry.id);
		}
		else if(entry.expectation.kind === "compile-rejection")
		{
			assert.ok(["rust", "dotnet", "java", "kotlin"].includes(actual.profile) || cFamily || wit);
			assert.equal(observed.status, "rejected-at-compile-time");
			assert.equal(observed.sourceSha256, sha256(wit ? corpusWitRejection(library, entry) : ["java", "kotlin"].includes(actual.profile) ? corpusJvmRejection(library, entry, actual.profile) : actual.profile === "dotnet" ? corpusDotnetRejection(library, entry) : cFamily ? corpusCFamilyRejection(library, entry, actual.profile) : corpusRustRejection(library, entry)));
			assert.ok(observed.diagnostics.length > 0);
			for(const diagnostic of observed.diagnostics)
			{
				assert.equal(diagnostic.code, entry.expectation.diagnostic);
				assert.equal(diagnostic.file, ["java", "kotlin"].includes(actual.profile) ? `src/reject-${entry.id.split("/")[1]}.${actual.profile === "java" ? "java" : "kt"}` : actual.profile === "dotnet" ? `src/reject-${entry.id.split("/")[1]}.cs` : cFamily || wit ? `src/reject-${entry.id.split("/")[1]}.${actual.profile === "cpp" ? "cpp" : "c"}` : `src/bin/reject-${entry.id.split("/")[1]}.rs`);
				if(cFamily || wit) validateCFamilyDiagnostic(diagnostic, wit ? "c" : actual.profile, entry.expectation.diagnostic);
				assert.ok(Number.isSafeInteger(diagnostic.line) && diagnostic.line > 0);
				assert.ok(Number.isSafeInteger(diagnostic.column) && diagnostic.column > 0);
			}
		}
		else
		{
			assert.equal(observed.status, "rejected-as-expected", entry.id);
			assert.equal(observed.exception, corpusProfiles[actual.profile].errors[entry.expectation.category], entry.id);
			if(entry.rejectionMessage) assert.ok(observed.message.startsWith(["php-native", "php-wasm", "dotnet", "java", "kotlin", "wit-wasi", "c", "cpp"].includes(actual.profile) ? entry.rejectionMessage : `${entry.rejectionMessage} at `), entry.id);
			assert.equal(observed.recovered, true, entry.id);
			if(["php-native", "php-wasm", "dotnet", "java", "kotlin", "wit-wasi"].includes(actual.profile)) assert.deepEqual(observed.recovery, oracle.dependency, entry.id);
			if(wit)
			{ assert.equal(observed.message, entry.rejectionMessage); assert.equal(observed.stage, "public-call"); assert.equal(observed.outputUnchanged, true); }
			if(["php-native", "php-wasm"].includes(actual.profile)) assert.equal(observed.stage, entry.id.endsWith("/bad-record") ? "public-constructor" : "public-call", entry.id);
		}
	}
};

const validateRustEvidence = (run, library) => {
	const evidence = run.rust;
	assert.ok(evidence.rustcVersion.startsWith(`rustc ${run.observation.hostVersion} (`));
	assert.match(evidence.cargoVersion, /^cargo 1\.(?:9\d|[1-9]\d{2,})\.\d+ /);
	for(const key of ["compilerSha256", "cargoSha256", "consumerSourceSha256", "signaturesSha256", "declarationsSha256", "packageReceiptSha256", "compiledProjectionSha256", "bindingIrSha256", "lockSha256", "metadataSha256", "linkerSha256", "executableSha256"])
		assert.match(evidence[key], /^[a-f0-9]{64}$/);
	assert.equal(evidence.bindingIrSha256, run.bindingIrSha256);
	assert.equal(evidence.consumerSourceSha256, sha256(corpusRustSource(library)));
	assert.equal(evidence.signaturesSha256, sha256(corpusRustSignatures(library)));
	for(const key of ["installedSourcesRemoved", "emptyCargoHome", "offline", "linkOnly", "normalExitCleanup", "repeatExecution"]) assert.equal(evidence[key], true);
	assert.equal(evidence.dependencies.archive, "rust-dependencies.tar.gz");
	assert.match(evidence.dependencies.sha256, /^[a-f0-9]{64}$/);
	assert.match(evidence.dependencies.lockSha256, /^[a-f0-9]{64}$/);
	const packages = evidence.dependencies.packages;
	assert.equal(new Set(packages.map(pkg => pkg.directory)).size, packages.length);
	for(const name of ["num-bigint-0.4.6", "sha2-0.10.9"]) assert.ok(packages.some(pkg => pkg.directory === name));
	for(const pkg of packages)
	{
		assert.match(pkg.directory, /^[A-Za-z0-9_-]+-[0-9]+\.[0-9]+\.[0-9]+$/);
		assert.match(pkg.checksum, /^[a-f0-9]{64}$/);
		assert.match(pkg.manifestSha256, /^[a-f0-9]{64}$/);
		assert.ok(Number.isSafeInteger(pkg.files) && pkg.files > 0);
	}
	assert.equal(run.observation.limits.length, 3);
	for(const limit of run.observation.limits)
	{
		assert.equal(limit.exception, "Limit");
		assert.deepEqual(limit.recovery, run.oracle.dependency);
	}
};

const validateCFamilyEvidence = (run, library) => {
	const evidence = run.cFamily, profile = run.profile;
	assert.equal(evidence.compilerVersion, run.observation.hostVersion);
	assert.equal(evidence.standard, profile === "cpp" ? "c++20" : "c11");
	for(const name of ["compilerSha256", "compilerMacrosSha256", "consumerSourceSha256", "signaturesSha256", "declarationsSha256", "packageReceiptSha256", "bindingIrSha256"])
		assert.match(evidence[name], /^[a-f0-9]{64}$/);
	assert.equal(evidence.bindingIrSha256, run.bindingIrSha256);
	assert.equal(evidence.consumerSourceSha256, sha256(corpusCFamilySource(library, profile)));
	assert.equal(evidence.signaturesSha256, sha256(corpusCFamilySignatures(library, profile)));
	for(const flag of ["gccDiagnostics", "installedSourcesRemoved", "offline", "runtimeOverridesDisabled", "publicHeadersOnly", "compilerFreeExecution", "repeatExecution", "localLibraries"]) assert.equal(evidence[flag], true);
	assert.deepEqual(evidence.negativeCompilerOptions, [`-std=${evidence.standard}`, "-Wall", "-Wextra", "-Werror", "-UNDEBUG", ...profile === "c" ? ["-Wconversion", "-Wsign-conversion"] : [], "-fsyntax-only", "-fdiagnostics-format=json"]);
	assert.match(evidence.pkgConfig.version, /^\d+\.\d+(?:\.\d+)?$/);
	assert.equal(evidence.pkgConfig.flags.length, 5);
	if(profile === "cpp") assert.ok(evidence.pkgConfig.flags.includes("-DBOOST_MP_STANDALONE"));
	else assert.ok(evidence.pkgConfig.flags.includes("-l:libgmp.so.10"));
	assert.match(evidence.pkgConfig.manifestSha256, /^[a-f0-9]{64}$/);
	assert.match(evidence.cmake.version, /^cmake version \d+\.\d+\.\d+/);
	for(const key of ["manifestSha256", "consumerSourceSha256"]) assert.match(evidence.cmake[key], /^[a-f0-9]{64}$/);
	assert.deepEqual(Object.keys(evidence.executables).sort(), ["cmake", "pkg-config"]);
	for(const hash of Object.values(evidence.executables)) assert.match(hash, /^[a-f0-9]{64}$/);
	assert.deepEqual(evidence.integrationExecutions, { "pkg-config": 2, cmake: 2 });
	for(const path of [`lib/lib${library.cModule}.so`, "lib/libleanshared.so", "lib/liblean_bridge_native.so"]) assert.ok(Object.hasOwn(evidence.libraries, path));
	for(const [path, file] of Object.entries(evidence.libraries))
	{
		assert.match(path, /^lib\/[^/]+\.so(?:\.[0-9]+)*$/);
		assert.match(file.sha256, /^[a-f0-9]{64}$/);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
	}
	assert.deepEqual(run.observation.errors, corpusCFamilyRuntimeCases(profile).flatMap(id => Array.from({ length: 3 }, (_, iteration) => ({ id, iteration, exception: "INVALID_ARGUMENT", recovery: run.oracle.dependency }))));
};

const validateDotnetEvidence = (run, library) => {
	const evidence = run.dotnet;
	assert.match(evidence.sdkVersion, /^8\.0\.\d+$/);
	assert.equal(evidence.runtimeVersion, run.observation.hostVersion);
	assert.match(evidence.compilerVersion, /^4\.\d+\.\d+/);
	for(const name of ["hostSha256", "compilerSha256", "consumerSourceSha256", "signaturesSha256", "declarationsSha256", "packageReceiptSha256", "compiledProjectionSha256", "bindingIrSha256", "assemblySha256", "projectSourceSha256", "nugetConfigSha256", "assetsSha256", "lockSha256"])
		assert.match(evidence[name], /^[a-f0-9]{64}$/);
	assert.equal(evidence.consumerSourceSha256, sha256(corpusDotnetSource(library)));
	assert.equal(evidence.signaturesSha256, sha256(corpusDotnetSignatures(library)));
	assert.equal(evidence.bindingIrSha256, run.bindingIrSha256);
	assert.match(evidence.packageContentHash, /^[A-Za-z0-9+/]{86}==$/);
	assert.match(evidence.referenceVersion, /^8\.0\.\d+$/);
	for(const name of ["System.Runtime.dll", "System.Runtime.Numerics.dll"]) assert.ok(Object.hasOwn(evidence.references, name));
	for(const [path, hash] of Object.entries(evidence.references))
	{ assert.match(path, /^[A-Za-z0-9.]+\.dll$/); assert.match(hash, /^[a-f0-9]{64}$/); }
	assert.deepEqual(evidence.compilerOptions, [...dotnetCompilerOptions]);
	for(const name of ["exactPublicSignatures", "emptyPackageCache", "emptyCliHome", "offline", "lockedRestore", "runtimeOverridesDisabled", "publicApiOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "repeatExecution", "localLibraries"]) assert.equal(evidence[name], true);
	assert.equal(evidence.deployment[`${library.dotnetModule}.dll`].sha256, evidence.assemblySha256);
	for(const path of ["Consumer.dll", "Consumer.deps.json", "Consumer.runtimeconfig.json", `runtimes/linux-x64/native/lib${library.cModule}.so`, "runtimes/linux-x64/native/libleanshared.so", "runtimes/linux-x64/native/liblean_bridge_native.so"]) assert.ok(Object.hasOwn(evidence.deployment, path));
	for(const [path, file] of Object.entries(evidence.deployment))
	{
		assert.match(path, /^(?:[A-Za-z0-9_.-]+\.(?:dll|pdb|json|xml)|runtimes\/linux-x64\/native\/[A-Za-z0-9_.-]+\.so)$/);
		assert.match(file.sha256, /^[a-f0-9]{64}$/); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
	}
	assert.match(evidence.runtimeHost.fxrVersion, /^8\.0\.\d+$/);
	const runtimeFiles = evidence.runtimeHost.files;
	for(const path of ["dotnet", `host/fxr/${evidence.runtimeHost.fxrVersion}/libhostfxr.so`, `shared/Microsoft.NETCore.App/${evidence.runtimeVersion}/libcoreclr.so`]) assert.ok(Object.hasOwn(runtimeFiles, path));
	for(const [path, file] of Object.entries(runtimeFiles))
	{
		assert.match(path, /^(?:dotnet|host\/fxr\/8\.0\.\d+\/[A-Za-z0-9_.-]+|shared\/Microsoft.NETCore.App\/8\.0\.\d+\/[A-Za-z0-9_.-]+)$/);
		assert.match(file.sha256, /^[a-f0-9]{64}$/); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
	}
	assert.equal(runtimeFiles.dotnet.sha256, evidence.hostSha256);
	assert.equal(run.observation.collectibleCopies, true);
	assert.ok(run.observation.assembly.endsWith(`/relocated/${library.dotnetModule}.dll`));
	const root = run.observation.assembly.slice(0, -`${library.dotnetModule}.dll`.length);
	assert.deepEqual(run.observation.nativeLibraries, Object.keys(evidence.deployment).filter(path => path.endsWith(".so")).map(path => `${root}${path}`).sort());
	assert.deepEqual(run.observation.errors, Object.entries(dotnetRuntimeCases).flatMap(([id, exception]) => Array.from({ length: 3 }, (_, iteration) => ({ id, exception, iteration, recovery: run.oracle.dependency }))));
};

const validateJvmEvidence = (run, library) => {
	const evidence = run.jvm, java = run.profile === "java";
	assert.match(run.observation.jvmVersion, /^22\.\d+\.\d+$/);
	assert.equal(evidence.javacVersion, `javac ${run.observation.jvmVersion}`);
	assert.ok(evidence.javaVersion.includes(`version "${run.observation.jvmVersion}"`));
	assert.match(evidence.mavenVersion, /Apache Maven 3\.(?:8|9)\.\d+/);
	for(const name of ["compilerSha256", "javaSha256", "javaModulesSha256", "mavenBootSha256", "consumerSourceSha256", "signaturesSha256", "declarationsSha256", "packageReceiptSha256", "compiledProjectionSha256", "bindingIrSha256", "archiveSha256", "pomSha256", "projectSourceSha256", "settingsSha256", "classpathSha256"])
		assert.match(evidence[name], /^[a-f0-9]{64}$/);
	assert.equal(evidence.consumerSourceSha256, sha256(corpusJvmSource(library, run.profile)));
	assert.equal(evidence.signaturesSha256, sha256(corpusJvmSignatures(library, run.profile)));
	assert.equal(evidence.bindingIrSha256, run.bindingIrSha256);
	assert.equal(evidence.archiveSha256, run.archiveSha256);
	assert.equal(run.pomArchive.target, "maven");
	assert.equal(evidence.pomSha256, run.pomArchive.sha256);
	assert.notEqual(evidence.pomSha256, run.archiveSha256);
	assert.equal(evidence.settingsSha256, sha256(mavenSettings));
	assert.deepEqual(evidence.compilerOptions, [...java ? javaCompilerOptions : kotlinCompilerOptions]);
	for(const name of ["exactPublicSignatures", "emptyRepository", "emptyUserHome", "offline", "resolvedClasspathOnly", "publicApiOnly", "runtimeOverridesDisabled", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries"]) assert.equal(evidence[name], true);
	const files = entries => {
		assert.ok(entries && Object.keys(entries).length > 0);
		for(const [path, file] of Object.entries(entries))
		{
			assert.ok(/^[A-Za-z0-9_.$+/-]+$/.test(path) && path.split("/").every(part => part && part !== "." && part !== ".."));
			assert.match(file.sha256, /^[a-f0-9]{64}$/); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		}
	};
	files(evidence.mavenFiles); files(evidence.dependencies.files);
	assert.equal(evidence.dependencies.archive, "maven-plugin-closure.tar.gz");
	assert.match(evidence.dependencies.sha256, /^[a-f0-9]{64}$/);
	for(const path of ["org/apache/maven/plugins/maven-install-plugin/3.1.4/maven-install-plugin-3.1.4.jar", "org/apache/maven/plugins/maven-dependency-plugin/3.8.1/maven-dependency-plugin-3.8.1.jar"]) assert.ok(evidence.dependencies.files[path]);
	assert.ok(Object.keys(evidence.dependencies.files).every(path => !path.startsWith("org/leanbridge/corpus/") && !path.includes("SNAPSHOT")));
	files(evidence.deployment); files(evidence.runtimeFiles);
	assert.equal(evidence.deployment["package.jar"].sha256, run.archiveSha256);
	for(const path of ["classes/Wire.class", `classes/Consumer${java ? "" : "Kt"}.class`]) assert.ok(evidence.deployment[path]);
	assert.ok(Object.keys(evidence.deployment).every(path => /^classes\/[A-Za-z0-9_.$/-]+\.(?:class|kotlin_module)$/.test(path) || path === "package.jar" || !java && path === "kotlin-stdlib.jar"));
	for(const path of ["bin/java", "lib/modules", "release"]) assert.ok(evidence.runtimeFiles[path]);
	assert.ok(Object.keys(evidence.runtimeFiles).every(path => !/^(?:jmods|include|src)\//.test(path) && (!path.startsWith("bin/") || path === "bin/java" || path === "bin/keytool")));
	assert.deepEqual(evidence.runtimeModules, [`java.base@${run.observation.jvmVersion}`]);
	assert.ok(run.observation.apiLocation.endsWith("/relocated/package.jar"));
	assert.equal(run.observation.nativeRootCount, 1);
	for(const name of [`lib${library.cModule}.so`, "libleanshared.so", "liblean_bridge_native.so"]) assert.ok(evidence.nativeLibraries[name]);
	for(const [name, hash] of Object.entries(evidence.nativeLibraries))
	{ assert.match(name, /^[A-Za-z0-9_.-]+\.so$/); assert.match(hash, /^[a-f0-9]{64}$/); }
	assert.deepEqual(run.observation.nativeLibraries, evidence.nativeLibraries);
	assert.deepEqual(run.observation.errors, Object.entries(jvmRuntimeCases).flatMap(([id, exception]) => Array.from({ length: 3 }, (_, iteration) => ({ id, exception, iteration, recovery: run.oracle.dependency }))));
	if(java) assert.equal(evidence.kotlin, undefined);
	else
	{
		assert.ok(evidence.kotlin.version.includes(`kotlinc-jvm ${run.observation.hostVersion} `));
		for(const path of ["kotlin-compiler.jar", "kotlin-stdlib.jar", "annotations-13.0.jar"]) assert.ok(evidence.kotlin.compilerFiles[path]);
		for(const [path, hash] of Object.entries(evidence.kotlin.compilerFiles))
		{ assert.match(path, /^[A-Za-z0-9_.-]+\.jar$/); assert.match(hash, /^[a-f0-9]{64}$/); }
		assert.equal(evidence.kotlin.stdlibSha256, evidence.kotlin.compilerFiles["kotlin-stdlib.jar"]);
		assert.equal(evidence.kotlin.stdlibSha256, evidence.deployment["kotlin-stdlib.jar"].sha256);
	}
};

const validateBrowserEvidence = (run, library, cases) => {
	const evidence = run.browser;
	const variants = run.profile === "browser-react" ? ["production", "strict"] : ["production"];
	assert.deepEqual(evidence.requestedEngines, corpusBrowserSelection(evidence.requestedEngines.join(",")));
	assert.equal(evidence.installedSourcesRemoved, true);
	assert.equal(evidence.externalNetworkBlocked, true);
	assert.equal(evidence.installedAssets.length, 2);
	assert.equal(new Set(evidence.installedAssets.map(asset => asset.path)).size, 2);
	const hashes = evidence.installedAssets.map(asset => asset.sha256).sort();
	assert.equal(new Set(hashes).size, 2);
	for(const asset of evidence.installedAssets)
	{
		assert.match(asset.sha256, /^[a-f0-9]{64}$/);
		assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0);
	}
	assert.ok(evidence.installedAssets.some(asset => asset.path === "node_modules/@lean-bridge/runtime/internal/main.wasm"));
	assert.ok(evidence.installedAssets.some(asset => asset.path.startsWith(`node_modules/${library.npmModule}/internal/wasm/`) && asset.path.endsWith(".wasm")));
	assert.deepEqual(evidence.framework.map(item => item.name), run.profile === "browser-react" ? ["react", "react-dom", "scheduler"] : []);
	for(const framework of evidence.framework)
	{
		assert.match(framework.version, /^[0-9]+\.[0-9]+\.[0-9]+$/);
		assert.match(framework.sha256, /^[a-f0-9]{64}$/);
		assert.equal(framework.archive, `framework/${framework.name}-${framework.version}.tgz`);
	}
	assert.deepEqual(evidence.deployments.map(deployment => deployment.variant).sort(), variants);
	for(const deployment of evidence.deployments)
	{
		assert.match(deployment.viteVersion, /^[0-9]+\.[0-9]+\.[0-9]+$/);
		assert.equal(deployment.sha256, sha256(canonicalJson(deployment.files)));
		assert.equal(new Set(deployment.files.map(file => file.path)).size, deployment.files.length);
		assert.ok(deployment.files.some(file => file.path === "index.html"));
		for(const file of deployment.files)
		{
			assert.ok(/^[A-Za-z0-9_./-]+$/.test(file.path) && !file.path.startsWith("/") && !file.path.split("/").includes(".."));
			assert.match(file.sha256, /^[a-f0-9]{64}$/);
			assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		}
		assert.deepEqual(deployment.files.filter(file => file.path.endsWith(".wasm")).map(file => file.sha256).sort(), hashes);
		assert.ok(deployment.modulePaths.every(path => path.startsWith("node_modules/") && !path.split("/").includes("..")));
		for(const name of [library.npmModule, "@lean-bridge/runtime"])
			assert.ok(deployment.modulePaths.includes(`node_modules/${name}/index.mjs`));
	}
	assert.deepEqual(evidence.executions.map(execution => `${execution.engine}/${execution.variant}`).sort()
		, evidence.requestedEngines.flatMap(engine => variants.map(variant => `${engine}/${variant}`)).sort());
	assert.deepEqual(run.observation, evidence.executions[0].observation);
	for(const execution of evidence.executions)
	{
		assert.equal(execution.observation.profile, run.profile);
		validateCorpusObservation(library, cases, run.oracle, execution.observation);
		assert.equal(execution.failedAssetRecovery, true);
		assert.deepEqual([...new Set(execution.assets.map(asset => asset.sha256))].sort(), hashes);
		const deployment = evidence.deployments.find(deployment => deployment.variant === execution.variant);
		for(const asset of execution.assets)
		{
			assert.equal(asset.status, 200);
			assert.match(asset.mime, /^application\/wasm(?:;|$)/);
			assert.ok(deployment.files.some(file => asset.path === `/corpus/nested/${file.path}` && asset.sha256 === file.sha256 && asset.bytes === file.bytes));
			assert.ok(evidence.installedAssets.some(file => asset.sha256 === file.sha256 && asset.bytes === file.bytes));
		}
		if(run.profile === "browser-react")
		{
			assert.equal(execution.pendingUnmount, true);
			assert.deepEqual(execution.lifecycle, execution.variant === "strict"
				? { effects: 6, cleanups: 5, ignored: 3, commits: 3 }
				: { effects: 3, cleanups: 2, ignored: 0, commits: 3 });
		}
		else assert.deepEqual(execution.lifecycle, run.profile === "browser-worker"
			? { created: 2, terminated: 2, live: 0 } : { rerun: true });
	}
};

/**
 * Hash every checked-in corpus input, including consumer and Lean oracle sources.
 *
 * @param repository - Repository root; consumers never receive this path.
 * @param catalog - Validated catalog whose exact inputs must be identified.
 */
export const corpusIdentity = async (repository, catalog) => {
	const paths = ["cases.mjs", "Corpus/Wire.lean", "consumers/python.py"
		, "consumers/ruby.rb", "consumers/perl.pl", "consumers/node.mjs"
		, "consumers/javascript.mjs", "consumers/rust.rs"
		, ...["plain", "react", "worker", "worker-main"].map(name => `consumers/browser/${name}.mjs`)
		, ...catalog.libraries.flatMap(library => [library.oracle, `${library.module.replaceAll(".", "/")}.lean`, `${library.pendingModule.replaceAll(".", "/")}.lean`])]
		.map(path => `tests/fixtures/type-corpus/${path}`);
	paths.push("tests/helpers/type-corpus.mjs", "tests/helpers/type-corpus-native.mjs", "tests/helpers/type-corpus-source.mjs", "tests/helpers/type-corpus-node.mjs", "tests/helpers/lake-workspace.mjs", "tests/type-corpus.test.mjs");
	paths.push("tests/helpers/type-corpus-browser.mjs", "tests/helpers/type-corpus-browser-build.mjs");
	paths.push("tests/helpers/type-corpus-rust.mjs", "tests/helpers/type-corpus-rust-source.mjs");
	paths.push("tests/helpers/type-corpus-c-source.mjs", "tests/helpers/type-corpus-c-family.mjs", "tests/helpers/type-corpus-compiler.mjs", "tests/fixtures/type-corpus/consumers/c-family.h");
	paths.push("tests/helpers/type-corpus-dotnet-source.mjs", "tests/helpers/type-corpus-dotnet.mjs", "tests/fixtures/type-corpus/consumers/dotnet.cs");
	paths.push("tests/helpers/type-corpus-jvm-source.mjs", "tests/helpers/type-corpus-jvm.mjs", "tests/helpers/type-corpus-jvm-tools.mjs", "tests/fixtures/type-corpus/consumers/Wire.java");
	paths.push("tests/helpers/type-corpus-php-source.mjs", "tests/helpers/type-corpus-php.mjs", "tests/fixtures/type-corpus/consumers/php.php");
	paths.push("tests/helpers/brick-math.mjs", "src/backends/php/brick-math.mjs", "src/backends/php/brick-math.source.json");
	paths.push(...["php-wasm", "php-wasm-node", "php-wasm-browser"].map(name => "tests/fixtures/type-corpus/consumers/" + name + ".mjs"));
	paths.push(...["php-wasm", "php-wasm-install", "php-wasm-browser", "php-wasm-evidence", "php-wasm-fixture"].map(name => "tests/helpers/type-corpus-" + name + ".mjs"));
	paths.push("tests/fixtures/type-corpus/consumers/wit.h", "tests/fixtures/type-corpus/wasmtime-c-api-files.json", ...["wit", "wit-source", "wit-evidence", "wit-fixture"].map(name => "tests/helpers/type-corpus-" + name + ".mjs"));
	const files = [];
	for(const path of paths)
	{
		const bytes = await readFile(`${repository}/${path}`);
		files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
	}
	return { sha256: sha256(canonicalJson({ catalog, files })), catalog, files };
};

/**
 * List every inventory cell, preserving absent adapters and missing cases as gaps.
 * An observed case is scoped evidence, not completion of the cell's semantic rules.
 *
 * @param inventory - Type-surface inventory and contracts returned by readTypeSurface.
 * @param catalog - Validated corpus cases.
 * @param runs - Fully validated library observations from installed public APIs.
 */
export const corpusCoverage = (inventory, catalog, runs = []) => {
	const observations = new Map();
	const identities = new Set();
	for(const run of runs)
	{
		const identity = `${run.profile}/${run.path}/${run.library}`;
		assert.ok(!identities.has(identity), `Duplicate corpus run: ${identity}`);
		identities.add(identity);
		assert.ok(["ordinary-source", "reviewed-ir"].includes(run.path));
		assert.ok(Object.hasOwn(corpusProfiles, run.profile));
		const library = catalog.libraries.find(library => library.id === run.library);
		assert.ok(library, "Unknown corpus library");
		if(run.path === "reviewed-ir")
		{
			validateReviewedCorpusBuild(run, library);
		}
		else assert.equal(run.reviewed, undefined, "Ordinary evidence cannot be relabeled reviewed execution");
		assert.match(run.archiveSha256, /^[a-f0-9]{64}$/);
		assert.match(run.runtimeIdentity, /^[a-f0-9]{64}$/);
		assert.match(run.bindingIrSha256, /^[a-f0-9]{64}$/);
		assert.equal(run.archive.sha256, run.archiveSha256);
		assert.equal(run.archive.target, corpusProfiles[run.profile].target);
		assert.equal(run.observation.profile, run.profile);
		assert.match(run.declarationEvidence.modelSha256, /^[a-f0-9]{64}$/);
		const sorted = items => [...items].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sorted(run.declarationEvidence.signatures), sorted(corpusProfileSignatures(library, run.profile)));
		if(corpusProfiles[run.profile].transport === "wasm")
		{
			assert.equal(run.runtimeArchive.target, "npm");
			assert.match(run.runtimeArchive.sha256, /^[a-f0-9]{64}$/);
			assert.notEqual(run.runtimeArchive.sha256, run.archiveSha256);
			const unsupported = corpusSignatures(library).filter(signature => !corpusProfileSignatures(library, run.profile).some(item => item.name === signature.name)).map(signature => signature.name);
			assert.deepEqual(run.rejection.exports, [...unsupported, library.pendingExport]);
			assert.equal(run.rejection.code, "component-adapter-hints-required");
			assert.deepEqual(run.rejection.hints, run.rejection.exports.map(name => `hint:${name}:unsupported-${name === library.pendingExport ? "result" : "parameter"}-type`).sort());
			if(run.profile === "node-typescript")
			{
				assert.equal(run.typescript.strict, true);
				assert.equal(run.typescript.skipLibCheck, false);
				assert.match(run.typescript.version, /^Version [0-9]+\.[0-9]+\.[0-9]+$/);
				for(const key of ["sourceSha256", "declarationsSha256", "compilerSha256"]) assert.match(run.typescript[key], /^[a-f0-9]{64}$/);
			}
		}
		if(run.profile === "perl")
		{
			assert.equal(run.runtimeArchive.target, "cpan");
			assert.match(run.runtimeArchive.sha256, /^[a-f0-9]{64}$/);
			assert.notEqual(run.runtimeArchive.sha256, run.archiveSha256);
			assert.deepEqual(run.observation.abi, run.perlAbi.abi);
			assert.equal(run.observation.abiKey, run.perlAbi.abiKey);
		}
		const cases = catalog.cases.filter(entry => entry.library === run.library);
		validateCorpusObservation(library, cases, run.oracle, run.observation);
		if(corpusProfiles[run.profile].browser) validateBrowserEvidence(run, library, cases);
		if(run.profile === "rust") validateRustEvidence(run, library);
		if(["c", "cpp"].includes(run.profile)) validateCFamilyEvidence(run, library);
		if(run.profile === "dotnet") validateDotnetEvidence(run, library);
		if(run.profile === "php-native") validatePhpEvidence(run, library, observation => validateCorpusObservation(library, cases, run.oracle, observation));
		if(run.profile === "php-wasm") validatePhpWasmEvidence(run, library, observation => validateCorpusObservation(library, cases, run.oracle, observation));
		if(run.profile === "wit-wasi") validateWitEvidence(run, library);
		if(["java", "kotlin"].includes(run.profile)) validateJvmEvidence(run, library);
		for(const entry of cases)
		{
			if(!corpusCaseSupported(library, entry, run.profile)) continue;
			if(corpusHostCase(entry, run.profile).expectation.kind === "compile-rejection") continue;
			for(const claim of entry.coverage)
			{
				for(const position of claim.positions)
				{
					const key = `${run.profile}/${run.path}/${claim.shape}/${position}`;
					if(!observations.has(key)) observations.set(key, new Set());
					observations.get(key).add(entry.id);
				}
			}
		}
	}
	return typeSurfaceCells(inventory.document, inventory).map(cell => {
		const caseIds = [...observations.get(`${cell.profile}/${cell.path}/${cell.shape}/${cell.position}`) ?? []].sort();
		return { profile: cell.profile, path: cell.path, shape: cell.shape
			, position: cell.position
			, status: caseIds.length ? "observed" : "gap", cases: caseIds
			, reason: caseIds.length ? "scoped-cases-only" : !Object.hasOwn(corpusProfiles, cell.profile) ? "adapter-not-implemented"
				: "case-not-executed"
			, owner: cell.owner };
	});
};
