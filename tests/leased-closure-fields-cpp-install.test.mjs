/** @file Build and exercise both installed C++ routes for direct function replies. */
import assert from "node:assert/strict";
import {mkdtemp, readFile, rename, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../src/build/canonical-build.mjs";
import {generateOwnedCppPackage} from "../src/backends/cpp/owned-package.mjs";
import {canonicalJson, sha256} from "../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../src/release/package-set-receipt.mjs";
import {copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied} from "./helpers/copied-fixture-install.mjs";
import {saveLakeFile} from "./helpers/lake-workspace.mjs";
import {checkStagedQuoteIdentities, prepareStagedQuoteProject} from "./helpers/staged-quote-project.mjs";
import {leasedClosureFieldReviewedIr} from "./helpers/owned-aggregate-fixture.mjs";
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
const requireIncoming = process.env.LEAN_BRIDGE_CPP_TARIFF_REQUIRE_INCOMING === "1";

test("a C++ callback can take the direct Lean closure through the generated public header", async t => {
	const surface = generateOwnedCppPackage(leasedClosureFieldReviewedIr({staged: true, incoming: true}));
	const dir = await mkdtemp(join(tmpdir(), "cpp-incoming-api-"));
	t.after(() => rm(dir, {recursive: true, force: true}));
	await saveLakeFile(dir, "include/" + surface.c.prefix + ".h", surface.c.header);
	for(const [path, contents] of Object.entries(surface.files)) await saveLakeFile(dir, path, contents);
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror"
		, "-pthread", "-Iinclude", "-fsyntax-only"
		, join(fixture, "tariff-incoming.cpp")]
	, dir, {PATH: "/usr/bin:/bin"});
});

test("C++ selects only borrowed callback fields and accepts mixed input/leased records", async t => {
	const ir = leasedClosureFieldReviewedIr({exchange: true});
	const record = ir.types.find(t => t.name === "Tariff");
	const apply = ir.declarations.find(d => d.name === "applyTariff");
	record.fields.push({...record.fields[0], name: "base", type: {kind: "primitive", name: "uint32"}});
	apply.parameters[1] = {...apply.parameters[0], name: "other"};
	const surface = generateOwnedCppPackage(ir);
	assert.deepEqual(surface.contract.hostInputRecords, [{type: record.id, input: "TariffInput", fields: ["quote"], lifetime: "call"}]);
	assert.ok(surface.valuesHeader.includes("struct TariffInput {\n  F0 quote;\n  uint32_t base{};"));
	assert.match(surface.header, /!std::same_as<std::remove_cvref_t<F0>, Tariff> \|\| !std::same_as<std::remove_cvref_t<F1>, Tariff>/u);
	assert.match(surface.header, /OwnedRecordView\d+<std::remove_reference_t<F1>>::check\(a1, call\)/u);
	assert.equal(generateOwnedCppPackage(ir, {hostCallbacks: false}).contract.hostInputRecords, undefined);
	const dir = await mkdtemp(join(tmpdir(), "cpp-mixed-field-inputs-"));
	t.after(() => rm(dir, {recursive: true, force: true}));
	await saveLakeFile(dir, "include/" + surface.c.prefix + ".h", surface.c.header);
	for(const [path, contents] of Object.entries(surface.files)) await saveLakeFile(dir, path, contents);
	await saveLakeFile(dir, "mixed.cpp", `#include "tariff_quotes.hpp"
namespace api = lean_bridge::tariff_quotes;
void use(const api::Tariff& leased) {
  api::TariffInput row{[rate=uint32_t{40}](uint32_t n) mutable { return n + rate++; }, 1u};
  (void)api::apply_tariff(row, leased);
  (void)api::apply_tariff(leased, row);
  (void)api::apply_tariff(row, row);
  (void)api::apply_tariff(leased, leased);
}
`);
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror"
		, "-pthread", "-Iinclude", "-fsyntax-only", "mixed.cpp"]
	, dir, {PATH: "/usr/bin:/bin"});
});

const buildHandoff = async (dir, route, handoff, t) => {
	const project = join(dir, "source"), output = join(dir, "producer");
	await prepareStagedQuoteProject(project, route, "cpp", {incoming: requireIncoming});
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
	const ir = model.bindingIr, incoming = ir.declarations.some(d => d.source.declaration === "Owned.visitQuote");
	if(requireIncoming) assert.ok(incoming, "requested C++ release must actually export the callback with the incoming function");
	if(incoming)
	{
		checkStagedQuoteIdentities(model, ir, receipt.profiles[0], route, {incoming: true});
		const visit = ir.declarations.find(d => d.source.declaration === "Owned.visitQuote");
		const [fn] = ir.types.find(v => v.id === visit.parameters[1].type.id).callable.parameters;
		assert.equal(fn.ownership, "borrow"); assert.equal(fn.lifetime.scope, "call");
		await saveLakeFile(root, "incoming.cpp", await readFile(join(fixture, "tariff-incoming.cpp")));
	}
	const probe = await readFile(join(fixture, "tariff-cpp-probe.cpp"));
	await saveLakeFile(root, "observer.cpp", probe);
	const fieldSource = await readFile(join(fixture, "tariff-fields.cpp"));
	await saveLakeFile(root, "fields.cpp", fieldSource);
	const adapter = JSON.parse(await readFile(join(installed, "share/lean-bridge/native-c-adapter.json")));
	const hostFields = !replay || process.env.LEAN_BRIDGE_CPP_TARIFF_REQUIRE_HOST_FIELDS === "1" || Boolean(adapter.cppValues.hostInputRecords);
	const hostSource = await readFile(join(fixture, "tariff-host-fields.cpp"));
	if(hostFields)
	{
		assert.deepEqual(adapter.cppValues.hostInputRecords, [{type: "lean:Owned.Tariff", input: "TariffInput", fields: ["quote"], lifetime: "call"}]);
		await saveLakeFile(root, "host-fields.cpp", hostSource);
	}
	await saveLakeFile(root, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.16)
project(staged LANGUAGES CXX)
find_package(${manifest.cmakePackage} CONFIG REQUIRED)
add_executable(staged consumer.cpp observer.cpp)
target_link_libraries(staged PRIVATE ${manifest.cmakeTarget} \${CMAKE_DL_LIBS})
target_compile_features(staged PRIVATE cxx_std_20)
target_compile_options(staged PRIVATE -Wall -Wextra -Werror -UNDEBUG)
target_compile_definitions(staged PRIVATE TARIFF_TEST_OBSERVER=1)
add_executable(fields fields.cpp observer.cpp)
target_link_libraries(fields PRIVATE ${manifest.cmakeTarget} \${CMAKE_DL_LIBS})
target_compile_features(fields PRIVATE cxx_std_20)
target_compile_options(fields PRIVATE -Wall -Wextra -Werror -UNDEBUG)
${incoming ? `add_executable(incoming incoming.cpp observer.cpp)
target_link_libraries(incoming PRIVATE ${manifest.cmakeTarget} \${CMAKE_DL_LIBS})
target_compile_features(incoming PRIVATE cxx_std_20)
target_compile_options(incoming PRIVATE -Wall -Wextra -Werror -UNDEBUG)` : ""}
${hostFields ? `add_executable(host-fields host-fields.cpp observer.cpp)
target_link_libraries(host-fields PRIVATE ${manifest.cmakeTarget} \${CMAKE_DL_LIBS})
target_compile_features(host-fields PRIVATE cxx_std_20)
target_compile_options(host-fields PRIVATE -Wall -Wextra -Werror -UNDEBUG)
target_compile_definitions(host-fields PRIVATE TARIFF_TEST_OBSERVER=1)` : ""}
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
	const dest = resolve(requireIncoming ? process.env.LEAN_BRIDGE_CPP_INCOMING_OUTPUT ?? "build/cpp-incoming-function" : "build/staged-cpp-callback");
	if(incoming)
	{
		const {stdout,stderr} = await runCopied(join(root, "build/incoming"), [], root);
		assert.equal(stderr, "");
		const outcomes=stdout.trimEnd().split("\n");
		assert.deepEqual(outcomes, ["borrow expires after success"
			, "borrow expires after failure", "lease survives success"
			, "lease survives failure", "inner failure leaves outer borrow valid"
			, "fresh calls use their own captures"
			, "identities:1,1,1,1,1,1,0"]);
		const report = {route, outcomes
			, archive: receipt.packages[0].artifacts[0]
			, receiptSha256: result.receiptSha256
			, bindingIrSha256: model.bindingIrSha256
			, reviewedSourceSha256: model.sourceIdentity.reviewedBindingIr?.sourceSha256 ?? null
			, runtimeIdentity: receipt.profiles[0].runtimeIdentity
			, clientSha256: sha256(await readFile(join(root, "incoming.cpp")))
			, executableSha256: sha256(await readFile(join(root, "build/incoming")))
			, probeSha256: sha256(probe)};
		await saveLakeFile(dest, route + ".incoming.json", canonicalJson(report));
	}
	await saveLakeFile(dest, route + ".package-set.json", canonicalJson(receipt));
	const evidence = {schemaVersion: 1, route
		, packageSetSha256: result.receiptSha256
		, consumerSha256: observed.consumerSha256
		, probeSha256: sha256(probe)
		, pkgConfig: observed.result.scenarios
		, relocatedCMake: lines
		, identities: [1, 1, 1, 1, 1, 1, 0]};
	await saveLakeFile(dest, route + ".execution.json", canonicalJson(evidence));
	const checked = await runCopied(join(root, "build/fields"), [], root);
	assert.equal(checked.stderr, "");
	const fieldCases = checked.stdout.trimEnd().split("\n");
	assert.equal(fieldCases.pop(), "identities:1,1,1,1,1,1,0");
	assert.deepEqual(fieldCases, [
		"a record copy survives explicit field close"
		, "caller-built record returns a callable field"
		, "repacked function outlives the original wrappers"
		, "storing a host borrow cannot extend its call scope"
		, "closed input field rejected", "subsequent valid record accepted"
	]);
	await saveLakeFile(dest, route + ".fields.json", canonicalJson({route
		, packageSetSha256: result.receiptSha256, clientSha256: sha256(fieldSource)
		, probeSha256: sha256(probe), relocatedCMake: fieldCases
		, identities: [1, 1, 1, 1, 1, 1, 0]}));
	if(hostFields)
	{
		const run = await runCopied(join(root, "build/host-fields"), [], root);
		assert.equal(run.stderr, "");
		const scenarios = run.stdout.trimEnd().split("\n");
		assert.equal(scenarios.pop(), "identities:1,1,1,1,1,1,0");
		assert.deepEqual(scenarios, ["move-only caller function in record"
			, "nested record callbacks"
			, "escaped record and function reject without host entry"
			, "original exception and healthy retry", "closed leased field rejected"
			, "genuine Lean lease survives source destruction"]);
		await saveLakeFile(dest, route + ".host-fields.json", canonicalJson({route
			, packageSetSha256: result.receiptSha256, clientSha256: sha256(hostSource)
			, probeSha256: sha256(probe), relocatedCMake: scenarios
			, identities: [1, 1, 1, 1, 1, 1, 0]}));
	}
	t.diagnostic("pkg-config and relocated CMake passed: " + result.receiptSha256);
});
