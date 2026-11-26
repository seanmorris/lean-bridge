/** @file Build and exercise both installed C++ routes for direct function replies. */
import assert from "node:assert/strict";
import {mkdtemp, readFile, rename, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../src/build/canonical-build.mjs";
import {canonicalJson, sha256} from "../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../src/release/package-set-receipt.mjs";
import {copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied} from "./helpers/copied-fixture-install.mjs";
import {saveLakeFile} from "./helpers/lake-workspace.mjs";
import {prepareStagedQuoteProject} from "./helpers/staged-quote-project.mjs";
import {copyPackageSetHandoff, retainPackageSetEvidence} from "./helpers/package-set.mjs";

const fixture = resolve("tests/fixtures/structured-types");
const cases = ["flat scalar reply", "fresh Lean function reply"
	, "independent caller still owns reply"
	, "closed recovery refused before host entry"
	, "original host exception after allocation"
	, "closed reply refused and binding reusable"];
const source = () => readFile(join(fixture, "tariff-staged.cpp"), "utf8");
const parseResult = stdout => {
	const scenarios = stdout.trimEnd().split("\n");
	assert.deepEqual(scenarios, cases);
	return {checks: scenarios.length, scenarios};
};
const environment = nativeFixtureEnvironment(["cpp"]), replay = process.env.LEAN_BRIDGE_CPP_TARIFF_REPLAY;

const buildHandoff = async (dir, route, handoff, t) => {
	const project = join(dir, "source"), output = join(dir, "producer");
	await prepareStagedQuoteProject(project, route, "cpp");
	try
	{
		await buildCanonicalProject({projectRoot: project, outputRoot: output
			, targets: ["cpp"], environment
			, onProgress: event => t.diagnostic(route + ": " + event.message)});
	}
	catch(error)
	{
		if(error.details) t.diagnostic(JSON.stringify(error.details));
		throw error;
	}
	await copyPackageSetHandoff(output, handoff);
	await rm(project, {recursive: true}); await rm(output, {recursive: true});
	if(process.env.LEAN_BRIDGE_CPP_TARIFF_KEEP)
		await retainPackageSetEvidence(handoff, join(resolve(process.env.LEAN_BRIDGE_CPP_TARIFF_KEEP), route));
};

for(const route of ["ordinary", "reviewed"]) test("installed C++ direct function replies: " + route, {
	skip: !replay && process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const dir = await mkdtemp(join(tmpdir(), "cpp-tariff-")), handoff = join(dir, "handoff"), consumer = join(dir, "consumer");
	t.after(() => rm(dir, {recursive: true, force: true}));
	if(replay) await copyPackageSetHandoff(join(resolve(replay), route), handoff);
	else await buildHandoff(dir, route, handoff, t);
	const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff, "package-set-receipt.json")});
	assert.deepEqual(result.packages, [{target: "cpp", ecosystem: "cpp", name: "tariff-quotes", version: "1.0.0"}]);
	const observed = await installCopiedConsumer({profile: "cpp", consumer
		, handoff, packages: receipt.packages, environment
		, fixture: {source, parseResult, expectedChecks: cases.length}});
	const root = join(consumer, "cpp"), installed = join(dir, "relocated");
	await rename(join(root, "tariff-quotes-1.0.0-cpp"), installed);
	await rm(handoff, {recursive: true});
	const manifest = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const model = JSON.parse(await readFile(join(installed, "share/lean-bridge/component/model.json")));
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), route === "reviewed");
	const probe = await readFile(join(fixture, "tariff-cpp-probe.cpp"));
	await saveLakeFile(root, "observer.cpp", probe);
	await saveLakeFile(root, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.16)
project(staged LANGUAGES CXX)
find_package(${manifest.cmakePackage} CONFIG REQUIRED)
add_executable(staged consumer.cpp observer.cpp)
target_link_libraries(staged PRIVATE ${manifest.cmakeTarget} \${CMAKE_DL_LIBS})
target_compile_features(staged PRIVATE cxx_std_20)
target_compile_options(staged PRIVATE -Wall -Wextra -Werror -UNDEBUG)
target_compile_definitions(staged PRIVATE TARIFF_TEST_OBSERVER=1)
`);
	const env = {...copiedCleanEnvironment, PATH: join(root, "tools")};
	const cmake = process.env.LEAN_BRIDGE_CMAKE ?? "/usr/bin/cmake";
	await runCopied(cmake, ["-S", root, "-B", "build", "-G", "Unix Makefiles"
		, "-DCMAKE_CXX_COMPILER=/usr/bin/c++"
		, "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
		, "-DCMAKE_PREFIX_PATH=" + installed], root, env);
	await runCopied(cmake, ["--build", "build"], root, env);
	const run = await runCopied(join(root, "build/staged"), [], root);
	assert.equal(run.stderr, "");
	const lines = run.stdout.trimEnd().split("\n");
	assert.equal(lines.pop(), "identities:1,1,1,1,1,1,0");
	assert.deepEqual(lines, cases);
	const dest = resolve("build/staged-cpp-callback");
	await saveLakeFile(dest, route + ".package-set.json", canonicalJson(receipt));
	const evidence = {schemaVersion: 1, route
		, packageSetSha256: result.receiptSha256
		, consumerSha256: observed.consumerSha256
		, probeSha256: sha256(probe)
		, pkgConfig: observed.result.scenarios
		, relocatedCMake: lines
		, identities: [1, 1, 1, 1, 1, 1, 0]};
	await saveLakeFile(dest, route + ".execution.json", canonicalJson(evidence));
	t.diagnostic("pkg-config and relocated CMake passed: " + result.receiptSha256);
});
