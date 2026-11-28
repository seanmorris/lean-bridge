/**
 * Verify and exercise an isolated Tariff handoff through both native build systems.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const fixtures = resolve("tests/fixtures/structured-types");
const cases = ["copy and project", "repack and retain", "foreign session", "last lease", "wrong kind", "expired borrow and recovery"];
const exchanges = ["borrowed reply", "owned replacement", "explicit retain", "error with owned reply", "foreign reply", "nested failure recovered"];
const staged = ["flat scalar reply", "returned function invoked", "caller retains independent function", "missing function recovery", "host failure releases function reply", "foreign function reply"];
const hostFields = ["caller function in record","reentrant record callbacks","escaped host field no longer calls C","host failure and recovery","invalid descriptor does not invoke","leased field keeps its session"];
const parse = stdout => {
	const scenarios = stdout.trimEnd().split("\n");
	assert.deepEqual(scenarios, cases);
	return { checks: scenarios.length, scenarios };
};

/**
 * Install only the verified archives in the test's private handoff.
 *
 * @param options - Disposable consumer sandbox and expected provenance.
 * @param options.dir - Private test root containing handoff/.
 * @param options.route - Expected source route, ordinary or reviewed.
 * @param options.t - Receives diagnostics after both clients complete.
 */
export const checkCFieldHandoff = async ({ dir, route, t }) => {
	const handoff = join(dir, "handoff"), environment = nativeFixtureEnvironment(["c"]);
	const { receipt, result: verified } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const receiptBytes = canonicalJson(receipt);
	assert.equal(sha256(receiptBytes), verified.receiptSha256);
	assert.deepEqual(verified.packages, [{ target: "c", ecosystem: "c", name: "tariff-quotes", version: "1.0.0" }]);

	const consumer = join(dir, "consumer");
	const source = () => readFile(join(fixtures, "leased-closure-fields.c"), "utf8");
	const observed = await installCopiedConsumer({ profile: "c", consumer
		, handoff, environment, packages: receipt.packages
		, fixture: { source, parseResult: parse, expectedChecks: cases.length } });
	const root = join(consumer, "c"), relocated = join(dir, "relocated");
	await rm(handoff, { recursive: true });
	await rename(join(root, "tariff-quotes-1.0.0-c"), relocated);
	const json = async path => JSON.parse(await readFile(join(relocated, path)));
	const manifest = await json("lean-bridge-package.json"), model = await json("share/lean-bridge/component/model.json");
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), route === "reviewed");
	assert.deepEqual(model.bindingIr.aggregatePolicy.closureFields, ["Owned.Tariff.quote"]);
	assert.equal(model.bindingIr.declarations.find(fn => fn.name === "applyTariff").failure.mode, "declared");
	const exchange = model.bindingIr.declarations.find(fn => fn.name === "exchangeTariff");
	assert.equal(exchange.failure.mode, "declared");
	const transform = model.bindingIr.types.find(type => type.id === exchange.parameters[0].type.id).callable;
	assert.equal(transform.parameters[0].type.id, "lean:Owned.Tariff"); assert.equal(transform.parameters[0].ownership, "borrow");
	assert.equal(transform.result.type.id, "lean:Owned.Tariff"); assert.equal(transform.result.ownership, "lease");
	const callback = name => {
		const site = model.bindingIr.declarations.find(fn => fn.name === name).parameters[0];
		return model.bindingIr.types.find(type => type.id === site.type.id).callable;
	};
	const stage = callback("stagedQuote"), flat = callback("flatQuote");
	assert.equal(stage.parameters.length, 1); assert.equal(flat.parameters.length, 2);
	assert.equal(stage.result.ownership, "lease"); assert.equal(flat.result.type.name, "uint32");
	assert.deepEqual(stage.result.type, model.bindingIr.types.find(type => type.name === "Tariff").fields[0].type);
	await cp(join(fixtures, "leased-closure-field-leases.c"), join(root, "leases.c"));
	for(const file of ["tariff-exchange.c", "tariff-exchange-probe.c", "tariff-staged.c","tariff-host-fields.c"]) await cp(join(fixtures, file), join(root, file));
	await saveLakeFile(root, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(TariffConsumer C)
find_package(${manifest.cmakePackage} 1.0.0 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.c leases.c)
add_executable(exchange tariff-exchange.c tariff-exchange-probe.c)
add_executable(staged tariff-staged.c tariff-exchange-probe.c)
add_executable(host-fields tariff-host-fields.c tariff-exchange-probe.c)
target_compile_definitions(host-fields PRIVATE TARIFF_PROBE_CLIENT=tariff_host_fields_consumer)
target_compile_definitions(staged PRIVATE TARIFF_PROBE_CLIENT=tariff_staged_consumer)
foreach(client consumer exchange staged host-fields)
  target_link_libraries(\${client} PRIVATE ${manifest.cmakeTarget} \${CMAKE_DL_LIBS})
  target_compile_features(\${client} PRIVATE c_std_11)
  target_compile_definitions(\${client} PRIVATE TARIFF_LIFETIME_PROBE)
  target_compile_options(\${client} PRIVATE -Wall -Wextra -Werror -UNDEBUG)
endforeach()
`);
	const env = { ...copiedCleanEnvironment, PATH: join(root, "tools") };
	const pcEnv = { ...env, PKG_CONFIG_PATH: "", PKG_CONFIG_LIBDIR: join(relocated, "lib/pkgconfig") };
	const flags = await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", manifest.pkgConfig], root, pcEnv);
	const cmake = process.env.LEAN_BRIDGE_CMAKE ?? "/usr/bin/cmake";
	const configure = ["-S", root, "-B", "build", "-G", "Unix Makefiles"
		, "-DCMAKE_C_COMPILER=/usr/bin/cc", "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
		, `-DCMAKE_PREFIX_PATH=${relocated}`];
	await runCopied(cmake, configure, root, env);
	await runCopied(cmake, ["--build", "build"], root, env);
	const result = await runCopied(join(root, "build/consumer"), [], root);
	assert.equal(result.stderr, "");
	const lines = result.stdout.trimEnd().split("\n"), countsLine = lines.pop();
	assert.match(countsLine, /^identities:\d+(?:,\d+){4}$/);
	const identities = countsLine.slice("identities:".length).split(",").map(Number);
	assert.deepEqual(identities, [0, 1, 2, 1, 0]);
	const cmakeResult = parse(lines.join("\n")), evidence = resolve("build/leased-closure-fields-c");
	for(const [client, expected] of [["exchange", exchanges], ["staged", staged],["host-fields",hostFields]])
	{
		const filename = `tariff-${client}.c`, pcBinary = `${client}-pkg-config`;
		const compile = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
			, filename, ...flags.stdout.trim().split(/\s+/), "-o", pcBinary];
		await runCopied("/usr/bin/cc", compile, root, env);
		const pcRun = await runCopied(join(root, pcBinary), [], root);
		assert.equal(pcRun.stderr, "");
		const pkgConfig = pcRun.stdout.trimEnd().split("\n");
		assert.deepEqual(pkgConfig, expected);
		const run = await runCopied(join(root, "build", client), [], root);
		assert.equal(run.stderr, "");
		const relocatedCMake = run.stdout.trimEnd().split("\n"), baseline = relocatedCMake.pop();
		assert.match(baseline, /^identities:\d+(?:,\d+){6}$/);
		const live = baseline.slice("identities:".length).split(",").map(Number);
		assert.deepEqual(live, [1, 1, 1, 1, 1, 1, 0]);
		assert.deepEqual(relocatedCMake, expected);
		await saveLakeFile(evidence, `${route}.${client}.json`, canonicalJson({
			schemaVersion: 1, route, packageSetSha256: verified.receiptSha256
			, consumerSha256: sha256(await readFile(join(root, filename)))
			, probeSha256: sha256(await readFile(join(root, "tariff-exchange-probe.c")))
			, pkgConfig, relocatedCMake, identities: live
		}));
	}
	await saveLakeFile(evidence, `${route}.package-set.json`, receiptBytes);
	await saveLakeFile(evidence, `${route}.execution.json`, canonicalJson({
		schemaVersion: 1, route, packageSetSha256: verified.receiptSha256
		, consumerSha256: observed.consumerSha256
		, probeSha256: sha256(await readFile(join(root, "leases.c")))
		, pkgConfig: observed.result.scenarios
		, relocatedCMake: cmakeResult.scenarios, identities
	}));
	t.diagnostic(`${route} C11 pkg-config and relocated CMake: ${cases.length} field, ${exchanges.length} exchange, ${staged.length} staged cases each; package-set ${sha256(receiptBytes)}`);
};
