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
	await cp(join(fixtures, "leased-closure-field-leases.c"), join(root, "leases.c"));
	await saveLakeFile(root, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(TariffConsumer C)
find_package(${manifest.cmakePackage} 1.0.0 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.c leases.c)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget} \${CMAKE_DL_LIBS})
target_compile_features(consumer PRIVATE c_std_11)
target_compile_definitions(consumer PRIVATE TARIFF_LIFETIME_PROBE)
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
	const env = { ...copiedCleanEnvironment, PATH: join(root, "tools") };
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
	await saveLakeFile(evidence, `${route}.package-set.json`, receiptBytes);
	await saveLakeFile(evidence, `${route}.execution.json`, canonicalJson({
		schemaVersion: 1, route, packageSetSha256: verified.receiptSha256
		, consumerSha256: observed.consumerSha256
		, probeSha256: sha256(await readFile(join(root, "leases.c")))
		, pkgConfig: observed.result.scenarios
		, relocatedCMake: cmakeResult.scenarios, identities
	}));
	t.diagnostic(`${route} C11 pkg-config and relocated CMake: ${cases.length} cases each; package-set ${sha256(receiptBytes)}; client ${observed.consumerSha256}`);
};
