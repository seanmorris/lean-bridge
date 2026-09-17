/**
 * Differential real-Lean corpus, exact installed archives and explicit gaps.
 *
 * @file
 */

import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { readTypeSurface } from "../src/adoption/type-surface.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { corpusBrowserSelection, corpusCaseSupported, corpusCatalog, corpusCoverage, corpusIdentity, corpusProfiles, corpusProfileSignatures, corpusSelection, validateCorpusDeclarations, validateCorpusObservation } from "./helpers/type-corpus.mjs";
import { runNativeCorpusLibrary } from "./helpers/type-corpus-native.mjs";
import { corpusTypeScript, runNpmCorpusLibrary } from "./helpers/type-corpus-node.mjs";
import { corpusRustRejection, corpusRustSignatures, corpusRustSource } from "./helpers/type-corpus-rust-source.mjs";
import { captureRustCompiler } from "./helpers/type-corpus-rust.mjs";
import { corpusCFamilyRejection, corpusCFamilySignatures, corpusCFamilySource, corpusCFamilyRuntimeCases } from "./helpers/type-corpus-c-source.mjs";
import { corpusDotnetRejection, corpusDotnetSignatures, corpusDotnetSource, dotnetRuntimeCases } from "./helpers/type-corpus-dotnet-source.mjs";
import { dotnetCompilerOptions, dotnetDiagnostics } from "./helpers/type-corpus-dotnet.mjs";
import { corpusJvmRejection, corpusJvmSignatures, corpusJvmSource, jvmRuntimeCases } from "./helpers/type-corpus-jvm-source.mjs";
import { javaCompilerOptions, kotlinCompilerOptions, jvmDiagnostics, mavenSettings } from "./helpers/type-corpus-jvm-tools.mjs";
import { corpusHostCase, corpusOracleKeys, corpusSignatures } from "./fixtures/type-corpus/cases.mjs";

const repository = resolve(import.meta.dirname, "..");
const inventory = await readTypeSurface();
const catalog = corpusCatalog(inventory.document);
const profiles = corpusSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_PROFILES);

// Synthetic observations exercise the report validator only. They never become
// installed evidence, and only the real compiler test writes the corpus report.
const validationFixture = (profile = "python", libraryId = "shop") => {
	const library = catalog.libraries.find(library => library.id === libraryId);
	const cases = catalog.cases.filter(entry => entry.library === library.id);
	const oracle = Object.fromEntries(corpusOracleKeys(cases).map(key => [key, { string: `validator-only:${key}` }]));
	const selectedCases = cases.map(entry => corpusHostCase(entry, profile));
	const abi = { ptrsize: "8", ivsize: "8", useithreads: "define" };
	const abiKey = sha256(JSON.stringify(JSON.parse(canonicalJson(abi))));
	const wasm = corpusProfiles[profile].transport === "wasm";
	const browser = corpusProfiles[profile].browser;
	const cFamily = ["c", "cpp"].includes(profile);
	const jvm = ["java", "kotlin"].includes(profile);
	const observation = { schemaVersion: 1, profile
		, module: library[corpusProfiles[profile].moduleKey]
		, hostVersion: jvm ? profile === "java" ? "22.0.2" : "2.2.0" : profile === "dotnet" ? "8.0.30" : cFamily ? "12.2.0" : wasm ? "22.23.2" : profile === "rust" ? "1.90.0" : profile === "perl" ? "5.38.2" : profile === "ruby" ? "3.3.12" : "3.11.2"
		, ...(profile === "perl" ? { abi, abiKey } : {})
		, ...(browser ? { realm: profile === "browser-worker" ? "dedicated-worker" : "window" } : {})
		, results: selectedCases.map(entry => !corpusCaseSupported(library, entry, profile)
			? { id: entry.id, status: "unsupported", export: `${library.module}.${entry.operation}` }
			: entry.expectation.kind === "lean-oracle"
				? { id: entry.id, status: "matched", observed: oracle[entry.oracleKey], independentCopy: entry.checkIndependentCopy }
				: entry.expectation.kind === "compile-rejection" ? { id: entry.id
					, status: "rejected-at-compile-time"
					, sourceSha256: sha256(jvm ? corpusJvmRejection(library, entry, profile) : profile === "dotnet" ? corpusDotnetRejection(library, entry) : cFamily ? corpusCFamilyRejection(library, entry, profile) : corpusRustRejection(library, entry))
					, diagnostics: [{ code: entry.expectation.diagnostic
						, file: jvm ? `src/reject-${entry.id.split("/")[1]}.${profile === "java" ? "java" : "kt"}` : profile === "dotnet" ? `src/reject-${entry.id.split("/")[1]}.cs` : cFamily ? `src/reject-${entry.id.split("/")[1]}.${profile === "cpp" ? "cpp" : "c"}` : `src/bin/reject-${entry.id.split("/")[1]}.rs`
						, line: 7, column: 1
						, ...(cFamily ? { message: entry.expectation.diagnostic === "narrowing" ? "conversion from value changes the value" : "incompatible types", option: entry.expectation.diagnostic === "narrowing" ? profile === "c" ? "-Werror=overflow" : "-Wnarrowing" : null } : {}) }] }
					: { id: entry.id, status: "rejected-as-expected"
						, exception: corpusProfiles[profile].errors[entry.expectation.category]
						, recovered: true
						, ...(profile === "dotnet" || jvm ? { recovery: oracle.dependency } : {})
						, ...(entry.rejectionMessage ? { message: profile === "dotnet" || jvm ? entry.rejectionMessage : `${entry.rejectionMessage} at consumer.pl line 1.` } : {}) })
		, ...(jvm ? { jvmVersion: "22.0.2"
			, apiLocation: "/validator/relocated/package.jar"
			, nativeRootCount: 1, nativeLibraries: jvmNativeLibraries(library)
			, errors: Object.entries(jvmRuntimeCases).flatMap(([id, exception]) => Array.from({ length: 3 }, (_, iteration) => ({ id, iteration, exception, recovery: oracle.dependency }))) } : {})
		, ...(profile === "rust" ? { limits: Array.from({ length: 3 }, () => ({ exception: "Limit", recovery: oracle.dependency })) } : {})
		, ...(cFamily ? { errors: corpusCFamilyRuntimeCases(profile).flatMap(id => Array.from({ length: 3 }, (_, iteration) => ({ id, iteration, exception: "INVALID_ARGUMENT", recovery: oracle.dependency }))) } : {})
		, ...(profile === "dotnet" ? { collectibleCopies: true
			, assembly: `/validator/relocated/${library.dotnetModule}.dll`
			, nativeLibraries: dotnetNativePaths(library).map(path => `/validator/relocated/${path}`).sort()
			, errors: Object.entries(dotnetRuntimeCases).flatMap(([id, exception]) => Array.from({ length: 3 }, (_, iteration) => ({ id, iteration, exception, recovery: oracle.dependency }))) } : {}) };
	return { library: library.id, profile, path: "ordinary-source"
		, archiveSha256: "a".repeat(64)
		, archive: { sha256: "a".repeat(64), target: corpusProfiles[profile].target }
		, runtimeIdentity: "b".repeat(64), bindingIrSha256: "c".repeat(64)
		, declarationEvidence: { modelSha256: "d".repeat(64), signatures: corpusProfileSignatures(library, profile) }
		, ...(profile === "perl" ? { perlAbi: { abi, abiKey }, runtimeArchive: { target: "cpan", sha256: "e".repeat(64) } } : {})
		, ...(wasm ? { runtimeArchive: { target: "npm", sha256: "e".repeat(64) }
			, rejection: { code: "component-adapter-hints-required"
				, exports: [...corpusSignatures(library).filter(signature => !corpusProfileSignatures(library, profile).some(item => item.name === signature.name)).map(signature => signature.name), library.pendingExport]
				, hints: [...library.operations.slice(4, 7).map(name => `hint:${library.module}.${name}:unsupported-parameter-type`), `hint:${library.pendingExport}:unsupported-result-type`].sort() }
		} : {})
		, ...(profile === "node-typescript" ? { typescript: { strict: true
			, skipLibCheck: false, version: "Version 5.9.3"
			, sourceSha256: "f".repeat(64), declarationsSha256: "f".repeat(64)
			, compilerSha256: "f".repeat(64) } } : {})
		, ...(browser ? { browser: browserValidationFixture(profile, library, observation) } : {})
		, ...(profile === "rust" ? { rust: rustValidationFixture(library) } : {})
		, ...(cFamily ? { cFamily: cFamilyValidationFixture(library, profile) } : {})
		, ...(profile === "dotnet" ? { dotnet: dotnetValidationFixture(library) } : {})
		, ...(jvm ? { jvm: jvmValidationFixture(library, profile), pomArchive: { target: "maven", sha256: "e".repeat(64) } } : {})
		, oracle, observation };
};

const rustValidationFixture = library => ({ rustcVersion: "rustc 1.90.0 (validator-only)"
	, cargoVersion: "cargo 1.90.0 (validator-only)"
	, ...Object.fromEntries(["compilerSha256", "cargoSha256", "declarationsSha256", "packageReceiptSha256", "compiledProjectionSha256", "lockSha256", "metadataSha256", "linkerSha256", "executableSha256"].map(key => [key, "e".repeat(64)]))
	, bindingIrSha256: "c".repeat(64)
	, consumerSourceSha256: sha256(corpusRustSource(library))
	, signaturesSha256: sha256(corpusRustSignatures(library))
	, dependencies: { archive: "rust-dependencies.tar.gz"
		, sha256: "f".repeat(64), lockSha256: "f".repeat(64)
		, packages: ["num-bigint-0.4.6", "sha2-0.10.9"].map(directory => ({ directory, checksum: "f".repeat(64), files: 1, manifestSha256: "f".repeat(64) })) }
	, installedSourcesRemoved: true, emptyCargoHome: true, offline: true
	, linkOnly: true, normalExitCleanup: true, repeatExecution: true });

const cFamilyValidationFixture = (library, profile) => ({
	compilerVersion: "12.2.0", standard: profile === "cpp" ? "c++20" : "c11"
	, ...Object.fromEntries(["compilerSha256", "compilerMacrosSha256", "declarationsSha256", "packageReceiptSha256"].map(key => [key, "e".repeat(64)]))
	, bindingIrSha256: "c".repeat(64)
	, consumerSourceSha256: sha256(corpusCFamilySource(library, profile))
	, signaturesSha256: sha256(corpusCFamilySignatures(library, profile))
	, negativeCompilerOptions: [`-std=${profile === "cpp" ? "c++20" : "c11"}`, "-Wall", "-Wextra", "-Werror", "-UNDEBUG", ...profile === "c" ? ["-Wconversion", "-Wsign-conversion"] : [], "-fsyntax-only", "-fdiagnostics-format=json"]
	, gccDiagnostics: true, installedSourcesRemoved: true, offline: true
	, runtimeOverridesDisabled: true, publicHeadersOnly: true
	, compilerFreeExecution: true, repeatExecution: true, localLibraries: true
	, pkgConfig: { version: "1.8.1", flags: ["-I/validator", "-L/validator", "-Wl,-rpath,/validator", `-l${library.cModule}`], manifestSha256: "f".repeat(64) }
	, cmake: { version: "cmake version 3.25.1", manifestSha256: "f".repeat(64), consumerSourceSha256: "f".repeat(64) }
	, executables: { "pkg-config": "f".repeat(64), cmake: "f".repeat(64) }
	, integrationExecutions: { "pkg-config": 2, cmake: 2 }
	, libraries: Object.fromEntries([`lib/lib${library.cModule}.so`, "lib/libleanshared.so", "lib/liblean_bridge_native.so"].map(path => [path, { sha256: "f".repeat(64), bytes: 100 }]))
});

const dotnetNativePaths = library => [`lib${library.cModule}.so`, "libleanshared.so", "liblean_bridge_native.so"].map(name => `runtimes/linux-x64/native/${name}`);
const dotnetValidationFixture = library => ({
	sdkVersion: "8.0.424", runtimeVersion: "8.0.30", compilerVersion: "4.11.0"
	, ...Object.fromEntries(["hostSha256", "compilerSha256", "declarationsSha256", "packageReceiptSha256", "compiledProjectionSha256", "assemblySha256", "projectSourceSha256", "nugetConfigSha256", "assetsSha256", "lockSha256"].map(key => [key, "e".repeat(64)]))
	, consumerSourceSha256: sha256(corpusDotnetSource(library))
	, signaturesSha256: sha256(corpusDotnetSignatures(library))
	, bindingIrSha256: "c".repeat(64)
	, packageContentHash: Buffer.alloc(64).toString("base64")
	, referenceVersion: "8.0.30"
	, references: { "System.Runtime.dll": "f".repeat(64), "System.Runtime.Numerics.dll": "f".repeat(64) }
	, compilerOptions: [...dotnetCompilerOptions]
	, ...Object.fromEntries(["exactPublicSignatures", "emptyPackageCache", "emptyCliHome", "offline", "lockedRestore", "runtimeOverridesDisabled", "publicApiOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "repeatExecution", "localLibraries"].map(key => [key, true]))
	, deployment: Object.fromEntries(["Consumer.dll", "Consumer.deps.json", "Consumer.runtimeconfig.json", `${library.dotnetModule}.dll`, ...dotnetNativePaths(library)].map(path => [path, { sha256: "e".repeat(64), bytes: 100 }]))
	, runtimeHost: { fxrVersion: "8.0.30"
		, files: Object.fromEntries(["dotnet", "host/fxr/8.0.30/libhostfxr.so", "shared/Microsoft.NETCore.App/8.0.30/libcoreclr.so"].map(path => [path, { sha256: "e".repeat(64), bytes: 100 }])) }
});

const jvmNativeLibraries = library => Object.fromEntries([`lib${library.cModule}.so`, "libleanshared.so", "liblean_bridge_native.so"].map(name => [name, "f".repeat(64)]));
const jvmValidationFixture = (library, profile) => {
	const files = paths => Object.fromEntries(paths.map(path => [path, { sha256: "e".repeat(64), bytes: 100 }]));
	return {
		javacVersion: "javac 22.0.2", javaVersion: 'openjdk version "22.0.2"'
		, mavenVersion: "Apache Maven 3.9.11"
		, ...Object.fromEntries(["compilerSha256", "javaSha256", "javaModulesSha256", "mavenBootSha256", "declarationsSha256", "packageReceiptSha256", "compiledProjectionSha256", "projectSourceSha256", "classpathSha256"].map(key => [key, "e".repeat(64)]))
		, consumerSourceSha256: sha256(corpusJvmSource(library, profile))
		, signaturesSha256: sha256(corpusJvmSignatures(library, profile))
		, settingsSha256: sha256(mavenSettings)
		, bindingIrSha256: "c".repeat(64), archiveSha256: "a".repeat(64)
		, pomSha256: "e".repeat(64)
		, mavenFiles: files(["maven-core-3.9.11.jar"])
		, dependencies: { archive: "maven-plugin-closure.tar.gz"
			, sha256: "f".repeat(64)
			, files: files(["org/apache/maven/plugins/maven-install-plugin/3.1.4/maven-install-plugin-3.1.4.jar", "org/apache/maven/plugins/maven-dependency-plugin/3.8.1/maven-dependency-plugin-3.8.1.jar"]) }
		, compilerOptions: [...profile === "java" ? javaCompilerOptions : kotlinCompilerOptions]
		, ...Object.fromEntries(["exactPublicSignatures", "emptyRepository", "emptyUserHome", "offline", "resolvedClasspathOnly", "publicApiOnly", "runtimeOverridesDisabled", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries"].map(key => [key, true]))
		, deployment: { ...files(["classes/Wire.class", `classes/Consumer${profile === "java" ? "" : "Kt"}.class`, ...profile === "kotlin" ? ["kotlin-stdlib.jar"] : []]), "package.jar": { sha256: "a".repeat(64), bytes: 100 } }
		, runtimeFiles: files(["bin/java", "lib/modules", "release"])
		, runtimeModules: ["java.base@22.0.2"]
		, nativeLibraries: jvmNativeLibraries(library)
		, ...(profile === "kotlin" ? { kotlin: { version: "info: kotlinc-jvm 2.2.0 (JRE 22.0.2)"
			, compilerFiles: Object.fromEntries(["kotlin-compiler.jar", "kotlin-stdlib.jar", "annotations-13.0.jar"].map(path => [path, "e".repeat(64)]))
			, stdlibSha256: "e".repeat(64) } } : {})
	};
};

const browserValidationFixture = (profile, library, observation) => {
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const installedAssets = [
		{ path: `node_modules/${library.npmModule}/internal/wasm/component.wasm`, bytes: 123, sha256: "1".repeat(64) }
		, { path: "node_modules/@lean-bridge/runtime/internal/main.wasm", bytes: 234, sha256: "2".repeat(64) }
	];
	const assets = installedAssets.map((asset, index) => ({ ...asset, path: `/corpus/nested/assets/${index}.wasm`, status: 200, mime: "application/wasm" }));
	const files = [{ path: "index.html", bytes: 345, sha256: "3".repeat(64) }
		, ...assets.map(({ path, bytes, sha256 }) => ({ path: path.slice("/corpus/nested/".length), bytes, sha256 }))];
	return { requestedEngines: ["chromium", "firefox", "webkit"], installedAssets
		, framework: profile === "browser-react" ? ["react", "react-dom", "scheduler"].map(name => ({ name, version: "1.0.0", archive: `framework/${name}-1.0.0.tgz`, sha256: "4".repeat(64) })) : []
		, deployments: variants.map(variant => ({ variant, viteVersion: "8.2.1"
			, modulePaths: [`node_modules/${library.npmModule}/index.mjs`, "node_modules/@lean-bridge/runtime/index.mjs"]
			, files, sha256: sha256(canonicalJson(files)) }))
		, executions: ["chromium", "firefox", "webkit"].flatMap(engine => variants.map(variant => ({ engine
			, variant
			, observation: structuredClone(observation), assets: structuredClone(assets)
			, failedAssetRecovery: true
			, ...(profile === "browser-react" ? { pendingUnmount: true } : {})
			, lifecycle: profile === "browser-react" ? variant === "strict"
				? { effects: 6, cleanups: 5, ignored: 3, commits: 3 }
				: { effects: 3, cleanups: 2, ignored: 0, commits: 3 }
				: profile === "browser-worker" ? { created: 2, terminated: 2, live: 0 } : { rerun: true }
		})))
		, installedSourcesRemoved: true, externalNetworkBlocked: true };
};

test("corpus cases cover two renamed nested libraries, valid positions and explicit host errors", () => {
	assert.equal(catalog.cases.length, 124);
	assert.equal(catalog.cases.filter(entry => entry.expectation.kind === "lean-oracle").length, 84);
	assert.equal(catalog.cases.filter(entry => entry.expectation.kind === "host-rejection").length, 40);
	assert.equal(new Set(catalog.libraries.flatMap(library => library.operations)).size, 38);
	assert.ok(catalog.libraries.every(library => library.module.includes(".")));
	assert.deepEqual(catalog.libraries.map(library => library.pendingShape), ["option", "result"]);
	assert.ok(catalog.cases.every(entry => entry.coverage.every(claim => !claim.positions.includes("signature"))));
	const changed = structuredClone(inventory.document);
	changed.shapes = changed.shapes.filter(shape => shape.id !== "nat");
	assert.throws(() => corpusCatalog(changed), /Unknown corpus shape: nat/);
});

test("corpus identity binds the cases, consumers, Lean sources, oracles and harness", async () => {
	const identity = await corpusIdentity(repository, catalog);
	assert.match(identity.sha256, /^[a-f0-9]{64}$/);
	assert.equal(identity.files.length, 39);
	assert.equal(new Set(identity.files.map(file => file.path)).size, 39);
	assert.ok(identity.files.every(file => file.bytes > 0 && /^[a-f0-9]{64}$/.test(file.sha256)));
	assert.ok(identity.files.some(file => file.path === "tests/helpers/lake-workspace.mjs"));
	assert.ok(identity.files.some(file => file.path.endsWith("consumers/python.py")));
	assert.ok(identity.files.some(file => file.path.endsWith("consumers/ruby.rb")));
	assert.ok(identity.files.some(file => file.path.endsWith("consumers/perl.pl")));
	assert.ok(identity.files.some(file => file.path.endsWith("consumers/node.mjs")));
	assert.deepEqual(identity.catalog, catalog);
	assert.deepEqual(await corpusIdentity(repository, catalog), identity);
	const changed = structuredClone(catalog);
	changed.cases[0].arguments[0].integer = "8";
	assert.notEqual((await corpusIdentity(repository, changed)).sha256, identity.sha256);
});

test("every inventoried profile and position remains a gap without executed cases", () => {
	const before = canonicalJson(inventory);
	const cells = corpusCoverage(inventory, catalog);
	assert.equal(cells.length, 6562);
	assert.equal(new Set(cells.map(cell => cell.profile)).size, 17);
	assert.equal(new Set(cells.map(cell => cell.shape)).size, 48);
	assert.ok(cells.every(cell => cell.status === "gap" && cell.cases.length === 0 && cell.owner > 0));
	assert.ok(cells.some(cell => cell.reason === "adapter-not-implemented"));
	assert.ok(cells.some(cell => cell.reason === "source-path-not-implemented"));
	assert.ok(cells.some(cell => cell.reason === "case-not-executed"));
	assert.equal(canonicalJson(inventory), before);
});

test("validator-only observations cannot cross source paths, profiles or uncovered positions", () => {
	const cells = corpusCoverage(inventory, catalog, [validationFixture()]);
	const observed = cells.filter(cell => cell.status === "observed");
	assert.equal(observed.length, 41);
	assert.ok(observed.every(cell => cell.profile === "python" && cell.path === "ordinary-source"));
	assert.ok(observed.every(cell => cell.reason === "scoped-cases-only" && cell.cases.every(id => id.startsWith("shop/"))));
	assert.ok(cells.filter(cell => cell.position.startsWith("callback") || cell.shape === "proof" || cell.shape === "option")
		.every(cell => cell.status === "gap"));
});

for(const [label, change] of [
	["missing case", run => run.observation.results.pop()]
	, ["duplicate case", run => { run.observation.results[0] = run.observation.results[1]; }]
	, ["extra case", run => run.observation.results.push({ id: "unknown" })]
	, ["wrong value", run => { run.observation.results[0].observed = { integer: "0" }; }]
	, ["wrong consumer profile", run => { run.observation.profile = "rust"; }]
	, ["wrong module", run => { run.observation.module = "lean_alpha"; }]
	, ["unverified copy", run => { run.observation.results.find(entry => entry.id === "shop/record").independentCopy = false; }]
	, ["wrong host error", run => { run.observation.results.at(-1).exception = "WrongError"; }]
	, ["failed recovery", run => { run.observation.results.at(-1).recovered = false; }]
	, ["missing oracle result", run => { delete run.oracle.dependency; }]
	, ["extra oracle result", run => { run.oracle.extra = {}; }]
	, ["unimplemented adapter", run => { run.profile = "php-native"; }]
	, ["unimplemented source path", run => { run.path = "reviewed-ir"; }]
	, ["unknown library", run => { run.library = "unknown"; }]
	, ["missing runtime identity", run => { delete run.runtimeIdentity; }]
	, ["invalid archive hash", run => { run.archiveSha256 = "not-a-hash"; }]
	, ["different archive hash", run => { run.archive.sha256 = "d".repeat(64); }]
	, ["wrong archive target", run => { run.archive.target = "rubygems"; }]
	, ["cross-profile observation", run => { run.observation = validationFixture("ruby").observation; }]
	, ["incorrect floating-point bits", run => { run.observation.results.find(entry => entry.id === "shop/float32-zero").observed = { float32: "2147483648" }; }]
	, ["missing declaration evidence", run => { delete run.declarationEvidence; }]
	, ["wrong declaration type", run => { run.declarationEvidence.signatures[0].result = "int32"; }]
]) test(`corpus report rejects ${label}`, () => {
	const run = validationFixture();
	change(run);
	assert.throws(() => corpusCoverage(inventory, catalog, [run]));
});

test("the corpus rejects duplicate runs and accepts only complete observations", () => {
	const run = validationFixture();
	validateCorpusObservation(catalog.libraries[0], catalog.cases.filter(entry => entry.library === "shop"), run.oracle, run.observation);
	assert.throws(() => corpusCoverage(inventory, catalog, [run, structuredClone(run)]), /Duplicate corpus run/);
});

test("explicit corpus selections reject absent, misspelled and duplicate adapters", () => {
	assert.deepEqual(corpusSelection(undefined), []);
	assert.deepEqual(corpusSelection("ruby, python"), ["python", "ruby"]);
	assert.deepEqual(corpusSelection("ruby,perl,python"), ["perl", "python", "ruby"]);
	for(const selection of ["", "python,", "PYTHON", "python,python", "php-native", null, []])
		assert.throws(() => corpusSelection(selection));
});

test("the shared inputs cover all sixteen primitive parameter/result positions", () => {
	const cells = corpusCoverage(inventory, catalog, [validationFixture(), validationFixture("ruby", "telemetry"), validationFixture("perl")]);
	assert.equal(cells.filter(cell => cell.status === "observed").length, 123);
	for(const profile of ["python", "ruby", "perl"])
	{
		for(const shape of inventory.document.irFacets.primitive)
		{
			for(const position of ["parameter", "result"])
				assert.equal(cells.find(cell => cell.profile === profile && cell.shape === shape && cell.path === "ordinary-source" && cell.position === position).status, "observed");
		}
	}
	assert.ok(cells.filter(cell => cell.profile === "rust").every(cell => cell.status === "gap"));
	for(const shape of ["float32", "float64"])
	{
		const floating = catalog.cases.filter(entry => entry.resultEncoding === shape);
		assert.equal(floating.length, 16);
		assert.ok(floating.every(entry => entry.coverage[0].shape === shape));
		assert.ok(floating.some(entry => entry.arguments[0][shape] === "nan"));
	}
});

test("Perl numeric acceptance uses fresh Lean results without weakening other profiles", () => {
	const cases = catalog.cases.filter(entry => entry.library === "shop");
	assert.equal(corpusOracleKeys(cases).length, 47);
	for(const id of ["bool-as-number", "float32-wrong-type", "float64-wrong-type"])
	{
		const entry = cases.find(entry => entry.id === `shop/${id}`);
		assert.equal(corpusHostCase(entry, "perl").expectation.kind, "lean-oracle");
		for(const profile of ["python", "ruby"]) assert.equal(corpusHostCase(entry, profile).expectation.kind, "host-rejection");
	}
	const perl = validationFixture("perl");
	assert.equal(perl.observation.results.filter(entry => entry.status === "matched").length, 45);
	const bad = perl.observation.results.find(entry => entry.id === "shop/negative-nat");
	bad.message = "unrelated loader failure at consumer.pl line 1.";
	assert.throws(() => corpusCoverage(inventory, catalog, [perl]));
});

test("Perl observations bind the separate runtime archive and compiled interpreter ABI", () => {
	for(const change of [
		run => { delete run.runtimeArchive; }
		, run => { run.runtimeArchive.sha256 = run.archiveSha256; }
		, run => { run.runtimeArchive.target = "pypi"; }
		, run => { run.observation.abi = { ...run.observation.abi, useithreads: "undef" }; }
		, run => { run.observation.abiKey = "0".repeat(64); }
		, run => { run.observation.hostVersion = "5.34.0"; }
	]) {
		const run = validationFixture("perl");
		change(run);
		assert.throws(() => corpusCoverage(inventory, catalog, [run]));
	}
});

test("declaration evidence checks names, nested fields and type positions separately", () => {
	const nativeType = type => typeof type === "string" ? { kind: "primitive", name: type }
		: type.array ? { kind: "array", element: nativeType(type.array) }
			: { kind: "record", name: type.record, fields: Object.entries(type.fields).map(([name, type]) => ({ name, type: nativeType(type) })) };
	const library = catalog.libraries[0], signatures = corpusSignatures(library);
	const model = { exports: signatures.map(entry => ({ name: entry.name, parameters: entry.parameters.map(type => ({ type: nativeType(type) })), result: nativeType(entry.result) })) };
	assert.deepEqual(validateCorpusDeclarations(library, model), signatures);
	for(const change of [
		model => { model.exports.pop(); }
		, model => { model.exports[0].name = "Shop.Wrong.quoteUnits"; }
		, model => { model.exports[1].parameters.reverse(); }
		, model => { model.exports[6].result.fields[1].type.name = "int"; }
	]) {
		const changed = structuredClone(model);
		change(changed);
		assert.throws(() => validateCorpusDeclarations(library, changed));
	}
});

test("profile-specific host errors cannot be borrowed from another adapter", () => {
	const ruby = validationFixture("ruby");
	const negative = ruby.observation.results.find(entry => entry.id === "shop/negative-nat");
	assert.equal(negative.exception, "RangeError");
	negative.exception = "ValueError";
	assert.throws(() => corpusCoverage(inventory, catalog, [ruby]));
	const unsupported = validationFixture("ruby");
	unsupported.observation.hostVersion = "3.4.0";
	assert.throws(() => corpusCoverage(inventory, catalog, [unsupported]));
});

test("Node profiles keep unsupported array and record cases as gaps", () => {
	for(const profile of ["node-javascript", "node-typescript"])
	{
		const run = validationFixture(profile);
		assert.equal(run.observation.results.filter(entry => entry.status === "unsupported").length, 6);
		assert.equal(run.observation.results.filter(entry => entry.status === "matched").length, 40);
		assert.equal(run.observation.results.filter(entry => entry.status === "rejected-as-expected").length, 16);
		const cells = corpusCoverage(inventory, catalog, [run]);
		assert.equal(cells.filter(cell => cell.status === "observed").length, 32);
		assert.ok(cells.filter(cell => cell.shape === "array" || cell.shape === "record" || cell.position === "field").every(cell => cell.status === "gap"));
		for(const change of [
			run => { run.observation.results[0] = { id: "shop/dependency", status: "unsupported", export: "Shop.Pricing.quoteUnits" }; }
			, run => { run.observation.results.find(entry => entry.id === "shop/array").status = "matched"; }
			, run => { run.rejection.hints.pop(); }
			, run => { run.rejection.code = "build-command-failed"; }
			, run => { delete run.runtimeArchive; }
			, run => { run.observation.hostVersion = "20.0.0"; }
		]) {
			const changed = structuredClone(run);
			change(changed);
			assert.throws(() => corpusCoverage(inventory, catalog, [changed]));
		}
	}
});

test("strict TypeScript uses the installed public API and independent exact signatures", () => {
	for(const library of catalog.libraries)
	{
		const source = corpusTypeScript(library);
		assert.match(source, /type Equal<A, B>/);
		assert.equal((source.match(/export type Signature/g) ?? []).length, 16);
		assert.equal((source.match(/@ts-expect-error/g) ?? []).length, 3);
		assert.doesNotMatch(source, /\bany\b|@ts-ignore|api\.undefined/);
		assert.match(source, /new Uint8Array/);
		assert.match(source, /floatFromBits/);
	}
	for(const change of [
		run => { delete run.typescript; }
		, run => { run.typescript.strict = false; }
		, run => { run.typescript.skipLibCheck = true; }
		, run => { run.typescript.compilerSha256 = "unknown"; }
	]) {
		const run = validationFixture("node-typescript");
		change(run);
		assert.throws(() => corpusCoverage(inventory, catalog, [run]));
	}
});

test("browser engine selections are explicit and never silently skipped", () => {
	assert.deepEqual(corpusBrowserSelection(undefined), ["chromium", "firefox", "webkit"]);
	assert.deepEqual(corpusBrowserSelection("webkit, chromium"), ["chromium", "webkit"]);
	for(const selection of ["", "chromium,", "CHROMIUM", "chromium,chromium", "safari", null, []])
		assert.throws(() => corpusBrowserSelection(selection));
});

test("browser profiles require every selected engine and retain unsupported projections as gaps", () => {
	const runs = ["browser-javascript", "browser-react", "browser-worker"].map(profile => validationFixture(profile));
	const cells = corpusCoverage(inventory, catalog, runs);
	assert.equal(cells.filter(cell => cell.status === "observed").length, 96);
	assert.ok(cells.filter(cell => ["array", "record"].includes(cell.shape)).every(cell => cell.status === "gap"));
	for(const run of runs)
	{
		assert.equal(run.observation.results.filter(entry => entry.status === "unsupported").length, 6);
		assert.equal(run.observation.results.filter(entry => entry.status === "matched").length, 40);
		assert.equal(run.observation.results.filter(entry => entry.status === "rejected-as-expected").length, 16);
	}
});

for(const [label, profile, change] of [
	["missing evidence", "browser-javascript", run => { delete run.browser; }]
	, ["duplicate engine", "browser-javascript", run => { run.browser.requestedEngines.push("chromium"); }]
	, ["missing engine", "browser-javascript", run => { run.browser.executions.pop(); }]
	, ["missing StrictMode", "browser-react", run => { run.browser.executions.splice(1, 1); }]
	, ["duplicate execution", "browser-react", run => { run.browser.executions[1] = run.browser.executions[0]; }]
	, ["wrong browser result", "browser-javascript", run => { run.browser.executions[1].observation.results[0].observed = { integer: "0" }; }]
	, ["wrong profile", "browser-worker", run => { run.browser.executions[1].observation.profile = "browser-javascript"; }]
	, ["window standing in for worker", "browser-worker", run => { run.browser.executions[1].observation.realm = "window"; }]
	, ["mismatched primary result", "browser-javascript", run => { run.observation.hostVersion = "99.0.1"; }]
	, ["wrong WASM digest", "browser-worker", run => { run.browser.executions[0].assets[0].sha256 = "f".repeat(64); }]
	, ["wrong WASM MIME", "browser-javascript", run => { run.browser.executions[0].assets[0].mime = "text/html"; }]
	, ["wrong deployment prefix", "browser-javascript", run => { run.browser.executions[0].assets[0].path = "/assets/0.wasm"; }]
	, ["missing runtime fetch", "browser-react", run => { run.browser.executions[0].assets.pop(); }]
	, ["unbound deployment", "browser-javascript", run => { run.browser.deployments[0].files[0].bytes++; }]
	, ["source tree present", "browser-javascript", run => { run.browser.installedSourcesRemoved = false; }]
	, ["network access", "browser-worker", run => { run.browser.externalNetworkBlocked = false; }]
	, ["missing React framework", "browser-react", run => { run.browser.framework.pop(); }]
	, ["missing public API import", "browser-javascript", run => { run.browser.deployments[0].modulePaths.pop(); }]
	, ["missing asset recovery", "browser-worker", run => { run.browser.executions[0].failedAssetRecovery = false; }]
	, ["stale React effect", "browser-react", run => { run.browser.executions[1].lifecycle.ignored = 0; }]
	, ["pending React unmount", "browser-react", run => { run.browser.executions[0].pendingUnmount = false; }]
	, ["leaked worker", "browser-worker", run => { run.browser.executions[0].lifecycle.live = 1; }]
]) test(`browser corpus rejects ${label}`, () => {
	const run = validationFixture(profile);
	change(run);
	assert.throws(() => corpusCoverage(inventory, catalog, [run]));
});

test("Rust records compiler rejection separately from executed public calls", () => {
	const runs = catalog.libraries.map(library => validationFixture("rust", library.id));
	const observed = corpusCoverage(inventory, catalog, runs).filter(cell => cell.status === "observed");
	assert.equal(observed.length, 41);
	assert.equal(runs.flatMap(run => run.observation.results).filter(entry => entry.status === "matched").length, 84);
	assert.equal(runs.flatMap(run => run.observation.results).filter(entry => entry.status === "rejected-at-compile-time").length, 40);
	assert.ok(observed.every(cell => cell.cases.every(id => corpusHostCase(catalog.cases.find(entry => entry.id === id), "rust").expectation.kind === "lean-oracle")));
	assert.deepEqual(corpusSelection("rust,python"), ["python", "rust"]);
});

test("Rust compile-rejection evidence retains JSON beyond the display-tail limit", async () => {
	const lines = Array.from({ length: 100 }, (_, index) => JSON.stringify({ index, message: "validator-only".repeat(20) }));
	const source = `process.stdout.write(${JSON.stringify(`${lines.join("\n")}\n`)}, () => { process.exitCode = 101; });`;
	const result = await captureRustCompiler(process.execPath, ["-e", source], repository, { PATH: "/unavailable" });
	assert.equal(result.code, 101);
	assert.ok(result.stdout.length > 8_000);
	assert.deepEqual(result.stdout.trim().split("\n").map(JSON.parse), lines.map(JSON.parse));
	await assert.rejects(() => captureRustCompiler("/unavailable/compiler", [], repository, {}), { code: "ENOENT" });
});

test("Rust callers use independent typed signatures, borrowed inputs and owned results", () => {
	for(const library of catalog.libraries)
	{
		const source = corpusRustSource(library), signatures = corpusRustSignatures(library);
		assert.equal((signatures.match(/let _: fn\(/g) ?? []).length, 19);
		assert.match(signatures, /fn\(&api::BigUint, u32\) -> Result<api::BigUint, api::Error>/);
		assert.match(signatures, /fn\(&\[Vec<u32>\]\) -> Result<Vec<Vec<u32>>, api::Error>/);
		assert.match(source, /Err\(api::Error::Limit\)/);
		assert.match(source, /for row in &mut arg0\./);
		assert.match(source, /for row in &mut result\./);
		assert.equal((source.match(/replace_range\(0\.\.1, "X"\)/g) ?? []).length, 2);
		assert.match(source, /#!\[forbid\(unsafe_code\)\]/);
		assert.doesNotMatch(source, /extern "C"|__runtime|validator-only|include_bytes!/);
		const cases = catalog.cases.filter(entry => entry.library === library.id);
		const wrongFloat = cases.find(entry => entry.id.endsWith("/float32-wrong-type"));
		assert.match(corpusRustRejection(library, wrongFloat), /let mut arg0 = 1i32;/);
		assert.throws(() => corpusRustRejection(library, cases[0]));
	}
});

for(const [label, change] of [
	["missing compiler evidence", run => { delete run.rust; }]
	, ["wrong compiler version", run => { run.observation.hostVersion = "1.89.0"; }]
	, ["unbound consumer source", run => { run.rust.consumerSourceSha256 = "0".repeat(64); }]
	, ["unchecked signatures", run => { run.rust.signaturesSha256 = "0".repeat(64); }]
	, ["wrong binding IR", run => { run.rust.bindingIrSha256 = "0".repeat(64); }]
	, ["warm global cache", run => { run.rust.emptyCargoHome = false; }]
	, ["online installation", run => { run.rust.offline = false; }]
	, ["remaining source tree", run => { run.rust.installedSourcesRemoved = false; }]
	, ["missing exact integers", run => { run.rust.dependencies.packages.shift(); }]
	, ["duplicate dependency", run => { run.rust.dependencies.packages.push(run.rust.dependencies.packages[0]); }]
	, ["unhashed executable", run => { delete run.rust.executableSha256; }]
	, ["missing cleanup", run => { run.rust.normalExitCleanup = false; }]
	, ["unverified copies", run => { run.observation.results.find(entry => entry.id.endsWith("/record")).independentCopy = false; }]
	, ["compiler failure counted as runtime", run => { run.observation.results.at(-1).status = "rejected-as-expected"; }]
	, ["unrelated compiler failure", run => { run.observation.results.at(-1).diagnostics[0].code = "E0432"; }]
	, ["dependency compiler failure", run => { run.observation.results.at(-1).diagnostics[0].file = "vendor/broken.rs"; }]
	, ["missing compiler diagnostic", run => { run.observation.results.at(-1).diagnostics = []; }]
	, ["changed rejected source", run => { run.observation.results.at(-1).sourceSha256 = "0".repeat(64); }]
	, ["wrong runtime error", run => { run.observation.limits[0].exception = "Load"; }]
	, ["missing limit rejection", run => { run.observation.limits.pop(); }]
	, ["failed limit recovery", run => { run.observation.limits[0].recovery = { integer: "0" }; }]
]) test(`Rust corpus rejects ${label}`, () => {
	const run = validationFixture("rust");
	change(run);
	assert.throws(() => corpusCoverage(inventory, catalog, [run]));
});

for(const profile of ["c", "cpp"]) test(`${profile} corpus separates native numeric acceptance from compiler rejection`, () => {
	const runs = catalog.libraries.map(library => validationFixture(profile, library.id));
	const observed = corpusCoverage(inventory, catalog, runs).filter(cell => cell.status === "observed");
	assert.equal(observed.length, 41);
	const results = runs.flatMap(run => run.observation.results);
	assert.equal(results.filter(entry => entry.status === "matched").length, profile === "c" ? 94 : 92);
	assert.equal(results.filter(entry => entry.status === "rejected-at-compile-time").length, profile === "c" ? 30 : 32);
	assert.equal(runs.flatMap(run => run.observation.errors).length, profile === "c" ? 42 : 18);
	assert.ok(observed.every(cell => cell.cases.every(id => corpusHostCase(catalog.cases.find(entry => entry.id === id), profile).expectation.kind === "lean-oracle")));
	for(const library of catalog.libraries)
	{
		const source = corpusCFamilySource(library, profile), signatures = corpusCFamilySignatures(library, profile);
		assert.equal((signatures.match(profile === "c" ? /_Static_assert/g : /static_assert/g) ?? []).length, 19);
		assert.match(source, /open_memstream/);
		assert.match(source, /snapshot_(?:basket|frame)/);
		assert.match(source, /INVALID_ARGUMENT/);
		assert.doesNotMatch(source, /__runtime|api::detail|runtime_install|Alpha|validator-only/);
		if(profile === "c") assert.match(source, /WIRE_WATCH\(result/);
		else assert.match(source, /result\.(?:units|counter)\.limbs\[0\] \^= 17/);
		for(const id of ["bool-as-number", "wrong-boolean", "float32-wrong-type", "float64-wrong-type"])
			assert.equal(corpusHostCase(catalog.cases.find(entry => entry.id === `${library.id}/${id}`), profile).oracleKey, id);
		assert.equal(corpusHostCase(catalog.cases.find(entry => entry.id === `${library.id}/bad-nested`), profile).expectation.kind, profile === "c" ? "lean-oracle" : "compile-rejection");
	}
});

for(const profile of ["c", "cpp"]) for(const [label, change] of [
	["missing compiler evidence", run => { delete run.cFamily; }]
	, ["old compiler", run => { run.observation.hostVersion = "11.1.0"; }]
	, ["wrong standard", run => { run.cFamily.standard = "c99"; }]
	, ["unbound source", run => { run.cFamily.consumerSourceSha256 = "0".repeat(64); }]
	, ["unchecked signatures", run => { run.cFamily.signaturesSha256 = "0".repeat(64); }]
	, ["wrong binding IR", run => { run.cFamily.bindingIrSha256 = "0".repeat(64); }]
	, ["remaining sources", run => { run.cFamily.installedSourcesRemoved = false; }]
	, ["compiler during execution", run => { run.cFamily.compilerFreeExecution = false; }]
	, ["runtime override", run => { run.cFamily.runtimeOverridesDisabled = false; }]
	, ["private headers", run => { run.cFamily.publicHeadersOnly = false; }]
	, ["unchecked narrowing", run => { run.cFamily.negativeCompilerOptions = []; }]
	, ["missing CMake", run => { delete run.cFamily.executables.cmake; }]
	, ["unexecuted integration", run => { run.cFamily.integrationExecutions.cmake = 0; }]
	, ["nonlocal runtime", run => { run.cFamily.localLibraries = false; }]
	, ["missing runtime library", run => { delete run.cFamily.libraries["lib/libleanshared.so"]; }]
	, ["wrong runtime rejection", run => { run.observation.errors[0].exception = "LOAD_ERROR"; }]
	, ["failed recovery", run => { run.observation.errors[0].recovery = { integer: "0" }; }]
	, ["missing error check", run => { run.observation.errors.pop(); }]
	, ["aliased record", run => { run.observation.results.find(entry => entry.id.endsWith("/record")).independentCopy = false; }]
	, ["unrelated compiler failure", run => { run.observation.results.find(entry => entry.status === "rejected-at-compile-time").diagnostics[0].message = "unknown function"; }]
	, ["header compiler failure", run => { run.observation.results.find(entry => entry.status === "rejected-at-compile-time").diagnostics[0].file = "package/include/broken.h"; }]
	, ["changed rejected input", run => { run.observation.results.find(entry => entry.status === "rejected-at-compile-time").sourceSha256 = "0".repeat(64); }]
]) test(`${profile} corpus rejects ${label}`, () => {
	const run = validationFixture(profile);
	change(run);
	assert.throws(() => corpusCoverage(inventory, catalog, [run]));
});

test(".NET separates C# type errors from executed public calls and recovery", () => {
	const runs = catalog.libraries.map(library => validationFixture("dotnet", library.id));
	const cells = corpusCoverage(inventory, catalog, runs);
	assert.equal(cells.filter(cell => cell.status === "observed").length, 41);
	assert.equal(cells.filter(cell => cell.status === "gap").length, 6521);
	const results = runs.flatMap(run => run.observation.results);
	assert.equal(results.filter(entry => entry.status === "matched").length, 88);
	assert.equal(results.filter(entry => entry.status === "rejected-as-expected").length, 4);
	assert.equal(results.filter(entry => entry.status === "rejected-at-compile-time").length, 32);
	assert.equal(runs.flatMap(run => run.observation.errors).length, 60);
	for(const library of catalog.libraries)
	{
		const source = corpusDotnetSource(library), signatures = corpusDotnetSignatures(library);
		assert.equal((signatures.match(/Wire.Method\(/g) ?? []).length, 19);
		assert.match(signatures, /typeof\(BigInteger\), typeof\(BigInteger\), typeof\(uint\)/);
		assert.match(signatures, /typeof\(uint\[\]\[\]\), typeof\(uint\[\]\[\]\)/);
		assert.match(signatures, /Wire.Record/);
		assert.match(source, /foreach \(var row in result\./);
		assert.match(source, /if \(row.Length > 0\) row\[0\] \^= 31/);
		assert.match(source, /GC.Collect\(\)/);
		assert.match(source, /!copies.input.IsAlive && !copies.output.IsAlive/);
		assert.match(source, /@(?:active|valid) = Wire.Boolean\(result\.(?:Active|Valid)\) } };/);
		assert.doesNotMatch(source, /Interop|DllImport|unsafe|__runtime|validator-only/);
		for(const id of ["float32-wrong-type", "float64-wrong-type"])
			assert.equal(corpusHostCase(catalog.cases.find(entry => entry.id === `${library.id}/${id}`), "dotnet").oracleKey, id);
		const overflow = catalog.cases.find(entry => entry.id === `${library.id}/overflow-u64`);
		assert.match(corpusDotnetRejection(library, overflow), /checked\(ulong.MaxValue \+ 1UL\)/);
		assert.throws(() => corpusDotnetRejection(library, catalog.cases.find(entry => entry.library === library.id)));
	}
});

test(".NET requires source-located Roslyn diagnostics for the exact rejected input", () => {
	const entry = corpusHostCase(catalog.cases.find(entry => entry.id === "shop/overflow-u64"), "dotnet");
	const file = "src/reject-overflow-u64.cs", project = "/validator/project";
	const diagnostic = { ruleId: "CS0220", level: "error"
		, message: { text: "The operation overflows at compile time in checked mode" }
		, locations: [{ physicalLocation: { artifactLocation: { uri: `${project}/${file}` }, region: { startLine: 10, startColumn: 12 } } }] };
	const report = { version: "2.1.0", runs: [{ results: [diagnostic] }] };
	assert.deepEqual(dotnetDiagnostics(report, entry, project, file), [{ code: "CS0220", file, line: 10, column: 12, message: diagnostic.message.text }]);
	for(const change of [
		report => { report.runs[0].results[0].ruleId = "CS0246"; }
		, report => { report.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri = "/package/Api.cs"; }
		, report => { report.runs[0].results[0].locations[0].physicalLocation.region.startLine = 0; }
		, report => { report.runs[0].results[0].locations = []; }
		, report => { report.runs[0].results = []; }
		, report => { report.runs.push(report.runs[0]); }
	]) {
		const invalid = structuredClone(report); change(invalid);
		assert.throws(() => dotnetDiagnostics(invalid, entry, project, file));
	}
});

for(const [label, change] of [
	["missing compiler evidence", run => { delete run.dotnet; }]
	, ["wrong SDK", run => { run.dotnet.sdkVersion = "9.0.100"; }]
	, ["wrong runtime", run => { run.dotnet.runtimeVersion = "8.0.29"; }]
	, ["wrong compiler", run => { run.dotnet.compilerVersion = "unknown"; }]
	, ["unchecked compiler flags", run => { run.dotnet.compilerOptions = []; }]
	, ["unbound source", run => { run.dotnet.consumerSourceSha256 = "0".repeat(64); }]
	, ["unchecked signatures", run => { run.dotnet.signaturesSha256 = "0".repeat(64); }]
	, ["wrong binding IR", run => { run.dotnet.bindingIrSha256 = "0".repeat(64); }]
	, ["unhashed declarations", run => { delete run.dotnet.declarationsSha256; }]
	, ["unhashed package", run => { run.dotnet.packageContentHash = "unknown"; }]
	, ["missing reference assembly", run => { delete run.dotnet.references["System.Runtime.Numerics.dll"]; }]
	, ["private API", run => { run.dotnet.publicApiOnly = false; }]
	, ["remaining sources", run => { run.dotnet.installedSourcesRemoved = false; }]
	, ["warm package cache", run => { run.dotnet.emptyPackageCache = false; }]
	, ["warm CLI home", run => { run.dotnet.emptyCliHome = false; }]
	, ["online restore", run => { run.dotnet.offline = false; }]
	, ["unlocked restore", run => { run.dotnet.lockedRestore = false; }]
	, ["compiler during execution", run => { run.dotnet.compilerFreeExecution = false; }]
	, ["SDK at runtime", run => { run.dotnet.runtimeHost.files["sdk/8.0.424/Roslyn/bincore/csc.dll"] = { sha256: "f".repeat(64), bytes: 100 }; }]
	, ["missing native runtime", run => { delete run.dotnet.deployment["runtimes/linux-x64/native/libleanshared.so"]; }]
	, ["changed assembly", run => { run.dotnet.deployment["LeanBridge.Shop.dll"].sha256 = "0".repeat(64); }]
	, ["wrong host binary", run => { run.dotnet.runtimeHost.files.dotnet.sha256 = "0".repeat(64); }]
	, ["wrong loaded library", run => { run.observation.nativeLibraries[0] = "/global/libleanshared.so"; }]
	, ["wrong assembly path", run => { run.observation.assembly = "/global/LeanBridge.Shop.dll"; }]
	, ["retained copied records", run => { run.observation.collectibleCopies = false; }]
	, ["missing runtime error", run => { run.observation.errors.pop(); }]
	, ["wrong runtime error", run => { run.observation.errors[0].exception = "LoadException"; }]
	, ["failed error recovery", run => { run.observation.errors[0].recovery = { integer: "0" }; }]
	, ["failed Nat recovery", run => { run.observation.results.find(entry => entry.status === "rejected-as-expected").recovery = { integer: "0" }; }]
	, ["unrelated compiler failure", run => { run.observation.results.find(entry => entry.status === "rejected-at-compile-time").diagnostics[0].code = "CS0246"; }]
	, ["dependency compiler failure", run => { run.observation.results.find(entry => entry.status === "rejected-at-compile-time").diagnostics[0].file = "package/Api.cs"; }]
	, ["missing diagnostic", run => { run.observation.results.find(entry => entry.status === "rejected-at-compile-time").diagnostics = []; }]
	, ["changed invalid source", run => { run.observation.results.find(entry => entry.status === "rejected-at-compile-time").sourceSha256 = "0".repeat(64); }]
]) test(`.NET corpus rejects ${label}`, () => {
	const run = validationFixture("dotnet"); change(run);
	assert.throws(() => corpusCoverage(inventory, catalog, [run]));
});

for(const profile of ["java", "kotlin"])
{
	test(`${profile} corpus separates compiler errors, unsigned range checks and Lean results`, () => {
		assert.deepEqual(corpusSelection(`${profile},python`), [profile, "python"]);
		const runs = catalog.libraries.map(library => validationFixture(profile, library.id));
		assert.equal(corpusCoverage(inventory, catalog, runs).filter(cell => cell.status === "observed").length, 41);
		assert.equal(runs.flatMap(run => run.observation.results).filter(entry => entry.status === "rejected-at-compile-time").length, profile === "java" ? 20 : 24);
		assert.equal(runs.flatMap(run => run.observation.results).filter(entry => entry.status !== "rejected-at-compile-time").length, profile === "java" ? 104 : 100);
		assert.equal(runs.flatMap(run => run.observation.errors).length, 72);
		for(const library of catalog.libraries)
		{
			const source = corpusJvmSource(library, profile), signatures = corpusJvmSignatures(library, profile);
			assert.ok(source.includes(`import ${library.jvmModule}.*`));
			assert.equal(signatures.match(/Wire\.method\(/g).length, 19);
			assert.match(signatures, /Wire\.record\(/);
			if(profile === "kotlin") assert.equal(signatures.match(/= Api::/g).length, 19);
			assert.doesNotMatch(source, /oracle|java\.lang\.foreign|System\.load|Runtime\./);
			assert.match(source, /\[1\] = (?:new long\[\] \{|longArrayOf\()29L/);
			assert.match(source, /Wire\.check\(saved\.equals/);
			assert.match(source, /Wire\.check\(changed\.equals/);
		}
	});
	test(`${profile} diagnostics bind rejection to the exact invalid call`, () => {
		const entry = catalog.cases.map(entry => corpusHostCase(entry, profile)).find(entry => entry.expectation.kind === "compile-rejection");
		const root = "/validator", file = `src/reject-${entry.id.split("/")[1]}.${profile === "java" ? "java" : "kt"}`;
		const line = profile === "java" ? `${file.split("/").at(-1)}:7:5: ${entry.expectation.diagnostic}: incompatible types`
			: `${root}/${file}:7:5: error: [${entry.expectation.diagnostic}] Argument type mismatch.`;
		const result = { code: 1, stdout: "", stderr: line };
		const [diagnostic] = jvmDiagnostics(result, entry, profile, root, file);
		assert.deepEqual({ ...diagnostic, message: "" }, { code: entry.expectation.diagnostic, file, line: 7, column: 5, message: "" });
		for(const invalid of [
			{ ...result, code: 0 }, { ...result, code: 2 }
			, { ...result, stderr: "" }
			, { ...result, stderr: line.replace(entry.expectation.diagnostic, profile === "java" ? "compiler.err.cant.resolve" : "UNRESOLVED_REFERENCE") }
			, { ...result, stderr: line.replace("reject-", "dependency-") }
			, { ...result, stderr: line.replace(":7:5:", ":0:5:") }
			, { ...result, stderr: `${line}\nerror: missing classpath` }
		]) assert.throws(() => jvmDiagnostics(invalid, entry, profile, root, file));
	});
	for(const [label, change] of [
		["missing evidence", run => { delete run.jvm; }]
		, ["wrong JVM", run => { run.observation.jvmVersion = "21.0.2"; }]
		, ["wrong compiler", run => { run.jvm.javacVersion = "javac 21.0.2"; }]
		, ["wrong Maven", run => { run.jvm.mavenVersion = "Apache Maven 4.0.0"; }]
		, ["missing compiler hash", run => { delete run.jvm.compilerSha256; }]
		, ["wrong consumer source", run => { run.jvm.consumerSourceSha256 = "0".repeat(64); }]
		, ["wrong public signatures", run => { run.jvm.signaturesSha256 = "0".repeat(64); }]
		, ["wrong binding IR", run => { run.jvm.bindingIrSha256 = "0".repeat(64); }]
		, ["wrong POM", run => { run.pomArchive.sha256 = "0".repeat(64); }]
		, ["wrong JAR", run => { run.jvm.deployment["package.jar"].sha256 = "0".repeat(64); }]
		, ["ambient settings", run => { run.jvm.settingsSha256 = "0".repeat(64); }]
		, ["weakened compiler", run => { run.jvm.compilerOptions = []; }]
		, ["ambient cache", run => { run.jvm.emptyRepository = false; }]
		, ["ambient home", run => { run.jvm.emptyUserHome = false; }]
		, ["online resolution", run => { run.jvm.offline = false; }]
		, ["extra classpath", run => { run.jvm.resolvedClasspathOnly = false; }]
		, ["runtime override", run => { run.jvm.runtimeOverridesDisabled = false; }]
		, ["source tree present", run => { run.jvm.installedSourcesRemoved = false; }]
		, ["compiler during execution", run => { run.jvm.compilerFreeExecution = false; }]
		, ["uncleared native extraction", run => { run.jvm.normalExitCleanup = false; }]
		, ["single execution", run => { run.jvm.repeatExecution = false; }]
		, ["missing plugin", run => { run.jvm.dependencies.files = {}; }]
		, ["mutable plugin", run => { run.jvm.dependencies.files["SNAPSHOT.jar"] = { sha256: "f".repeat(64), bytes: 1 }; }]
		, ["unbound plugin", run => { delete run.jvm.dependencies.sha256; }]
		, ["unsafe plugin path", run => { run.jvm.dependencies.files["../bad.jar"] = { sha256: "f".repeat(64), bytes: 1 }; }]
		, ["compiler at runtime", run => { run.jvm.runtimeFiles["bin/javac"] = { sha256: "f".repeat(64), bytes: 1 }; }]
		, ["extra runtime module", run => { run.jvm.runtimeModules.push("jdk.compiler@22.0.2"); }]
		, ["author source at runtime", run => { run.jvm.deployment["Consumer.java"] = { sha256: "f".repeat(64), bytes: 1 }; }]
		, ["wrong native binary", run => { run.observation.nativeLibraries["libleanshared.so"] = "0".repeat(64); }]
		, ["missing native runtime", run => { delete run.jvm.nativeLibraries["libleanshared.so"]; }]
		, ["multiple native roots", run => { run.observation.nativeRootCount = 2; }]
		, ["wrong public API path", run => { run.observation.apiLocation = "/global/package.jar"; }]
		, ["missing runtime error", run => { run.observation.errors.pop(); }]
		, ["wrong runtime error", run => { run.observation.errors[0].exception = "LoadException"; }]
		, ["failed recovery", run => { run.observation.errors[0].recovery = { integer: "0" }; }]
		, ["failed Nat recovery", run => { run.observation.results.find(entry => entry.status === "rejected-as-expected").recovery = { integer: "0" }; }]
		, ["unrelated compiler error", run => { run.observation.results.find(entry => entry.status === "rejected-at-compile-time").diagnostics[0].code = "UNRESOLVED_REFERENCE"; }]
		, ["wrong diagnostic source", run => { run.observation.results.find(entry => entry.status === "rejected-at-compile-time").diagnostics[0].file = "Api.java"; }]
		, ["missing diagnostic", run => { run.observation.results.find(entry => entry.status === "rejected-at-compile-time").diagnostics = []; }]
		, ["wrong invalid source", run => { run.observation.results.find(entry => entry.status === "rejected-at-compile-time").sourceSha256 = "0".repeat(64); }]
	]) test(`${profile} corpus rejects ${label}`, () => {
		const run = validationFixture(profile); change(run);
		assert.throws(() => corpusCoverage(inventory, catalog, [run]));
	});
}

for(const [label, change] of [
	["wrong Kotlin compiler", run => { run.jvm.kotlin.version = "kotlinc-jvm 1.9.0"; }]
	, ["missing Kotlin compiler", run => { delete run.jvm.kotlin.compilerFiles["kotlin-compiler.jar"]; }]
	, ["changed standard library", run => { run.jvm.deployment["kotlin-stdlib.jar"].sha256 = "0".repeat(64); }]
	, ["wrong Kotlin version", run => { run.observation.hostVersion = "1.9.0"; }]
]) test(`Kotlin corpus rejects ${label}`, () => {
	const run = validationFixture("kotlin"); change(run);
	assert.throws(() => corpusCoverage(inventory, catalog, [run]));
});

test("real Lean corpus matches independently rebuilt archives in source-free consumers", {
	skip: profiles.length === 0
	, timeout: Math.max(900_000, profiles.length * 90_000)
}, async t => {
	const reportName = `${profiles.join("-")}.json`;
	const reportPath = resolve(repository, "build/type-corpus", reportName);
	await rm(reportPath, { force: true });
	const identity = await corpusIdentity(repository, catalog);
	const runs = [];
	try
	{
		for(const library of catalog.libraries)
		{
			const native = profiles.filter(profile => corpusProfiles[profile].transport === "native");
			const wasm = profiles.filter(profile => corpusProfiles[profile].transport === "wasm");
			if(native.length) runs.push(...await runNativeCorpusLibrary(t, library, native));
			if(wasm.length) runs.push(...await runNpmCorpusLibrary(t, library, wasm));
		}
	}
	catch(error)
	{
		if(error.details) t.diagnostic(JSON.stringify(error.details));
		throw error;
	}
	assert.notDeepEqual(runs.find(run => run.library === "shop").oracle.dependency, runs.find(run => run.library === "telemetry").oracle.dependency);
	for(const library of catalog.libraries)
	{
		const selected = runs.filter(run => run.library === library.id);
		assert.deepEqual(selected.map(run => run.profile).sort(), profiles);
		for(const run of selected)
		{
			assert.deepEqual(run.oracle, selected[0].oracle);
			const sameTransport = selected.find(other => corpusProfiles[other.profile].transport === corpusProfiles[run.profile].transport);
			assert.equal(run.bindingIrSha256, sameTransport.bindingIrSha256);
			assert.equal(run.runtimeIdentity, sameTransport.runtimeIdentity);
		}
	}
	assert.deepEqual(await corpusIdentity(repository, catalog), identity, "Corpus inputs changed during execution");
	const cells = corpusCoverage(inventory, catalog, runs);
	const observed = cells.filter(cell => cell.status === "observed").length;
	const browserExecutions = runs.flatMap(run => run.browser?.executions ?? []);
	const report = { schemaVersion: 1, kind: "real-lean-type-corpus"
		, scope: "scoped-cases-not-full-type-support"
		, host: { platform: process.platform, architecture: process.arch
			, node: process.version
			, nativeGlibcFloor: process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
			, ...(profiles.includes("perl") ? { perlGlibcFloor: process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38" } : {}) }
		, corpus: identity
		, inventorySha256: sha256(canonicalJson(inventory.document))
		, selectedProfiles: profiles
		, summary: { libraries: catalog.libraries.length, profileRuns: runs.length
			, profiles: inventory.document.profiles.length
			, cases: runs.reduce((count, run) => count + run.observation.results.length, 0)
			, executedCases: runs.reduce((count, run) => count + run.observation.results.filter(entry => ["matched", "rejected-as-expected"].includes(entry.status)).length, 0)
			, compileRejectedCases: runs.reduce((count, run) => count + run.observation.results.filter(entry => entry.status === "rejected-at-compile-time").length, 0)
			, rustRuntimeRejections: runs.reduce((count, run) => count + (run.observation.limits?.length ?? 0), 0)
			, cFamilyRuntimeRejections: runs.filter(run => ["c", "cpp"].includes(run.profile)).reduce((count, run) => count + run.observation.errors.length, 0)
			, dotnetRuntimeRejections: runs.filter(run => run.profile === "dotnet").reduce((count, run) => count + run.observation.errors.length, 0)
			, jvmRuntimeRejections: runs.filter(run => ["java", "kotlin"].includes(run.profile)).reduce((count, run) => count + run.observation.errors.length, 0)
			, unsupportedCases: runs.reduce((count, run) => count + run.observation.results.filter(entry => entry.status === "unsupported").length, 0)
			, browserExecutions: browserExecutions.length
			, browserExecutedCases: browserExecutions.reduce((count, execution) => count + execution.observation.results.filter(entry => entry.status !== "unsupported").length, 0)
			, browserUnsupportedCases: browserExecutions.reduce((count, execution) => count + execution.observation.results.filter(entry => entry.status === "unsupported").length, 0)
			, observedCells: observed, gapCells: cells.length - observed
			, rejectedBuilds: new Set(runs.map(run => `${run.library}/${corpusProfiles[run.profile].transport}`)).size }
		, runs, cells };
	await mkdir(resolve(reportPath, ".."), { recursive: true });
	await writeFile(reportPath, canonicalJson(report));
	t.diagnostic(`Corpus report: build/type-corpus/${reportName} (${report.summary.cases} cases, ${observed} scoped cells, ${report.summary.gapCells} gaps)`);
});
