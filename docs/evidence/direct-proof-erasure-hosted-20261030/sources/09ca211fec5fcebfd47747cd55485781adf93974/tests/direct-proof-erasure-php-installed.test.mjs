/**
 * Source-free ordinary and reviewed PHP acceptance for direct proof erasure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, lstat, mkdir, mkdtemp, readFile, rename, rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment
	, runCopied
} from "./helpers/copied-fixture-install.mjs";
import {
	assertDirectProofErasurePhpComponents
	, directProofErasurePhpComponentFact
	, prepareDirectProofErasureProject
	, retainDirectProofErasurePhpComponents
} from "./helpers/direct-proof-erasure-packages.mjs";
import {
	directProofErasurePhpConsumerSource, directProofErasurePhpParameter
	, directProofErasurePhpProfiles, directProofErasurePhpReturnType
} from "./helpers/direct-proof-erasure-php-report.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	copyPackageSetHandoff, retainPackageSetEvidence
} from "./helpers/package-set.mjs";

const flag = process.env.LEAN_BRIDGE_DIRECT_PROOF_PHP_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag)
	, "Invalid LEAN_BRIDGE_DIRECT_PROOF_PHP_TEST");
const enabled = flag === "1";
const routes = process.env.LEAN_BRIDGE_DIRECT_PROOF_PHP_ROUTES?.split(",")
	?? ["ordinary", "reviewed"];
assert.ok(routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const outputFor = route => resolve((
	process.env.LEAN_BRIDGE_DIRECT_PROOF_PHP_OUTPUT
		?? "build/direct-proof-erasure-php/{route}"
).replace("{route}", route));
const apiPath = (root, profile) => join(root, "vendor/example"
	, `${profile === "php-wasm" ? "directprooferasure-php-wasm" : "directprooferasure"}/src/Api.php`);
const phpInvalid = (route, profile) => `try {
    \\LeanDirectprooferasure\\keep(_before: true, ${directProofErasurePhpParameter(route)}: ${profile === "php-native" ? "0" : "\\Brick\\Math\\BigInteger::of(0)"}, _after: true);
    throw new \\RuntimeException('Proof arguments were accepted');
} catch (\\Error $error) {
    if (!str_contains($error->getMessage(), 'Unknown named parameter $_before')) throw $error;
}`;
const assertApi = (source, route, profile) => {
	assert.ok(source.includes(
		`function keep(mixed $${directProofErasurePhpParameter(route)}): ${directProofErasurePhpReturnType(profile)}`
	));
	assert.doesNotMatch(source, /(?:\bTrue\b|\bproof\b|_before|_after)/iu);
};

for(const route of routes) test(
	`installed direct proof-erasure PHP packages reproduce and relocate ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const records = outputFor(route);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const suite = await mkdtemp(join(tmpdir(), "lean-bridge-direct-proof-php-"));
		t.after(() => rm(suite, { recursive: true, force: true }));
		const environment = {
			...nativeFixtureEnvironment(directProofErasurePhpProfiles)
			, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
			, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER
				?? "/usr/bin/composer"
			, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
		};
		if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME)
			environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME
				= environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim();
		const builds = [], retained = join(records, "handoff");
		let receipt;
		for(const attempt of [0, 1])
		{
			const prepared = await prepareDirectProofErasureProject(t, {
				route, profiles: directProofErasurePhpProfiles
			});
			const before = await lakeInputState(prepared.projectRoot);
			const outputRoot = join(prepared.directory, "release");
			await buildCanonicalProject({
				projectRoot: prepared.projectRoot, outputRoot
				, targets: directProofErasurePhpProfiles, environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			const components = await assertDirectProofErasurePhpComponents(
				outputRoot);
			await verifyPackageSetReceipt({
				receiptPath: join(outputRoot, "package-set-receipt.json")
			});
			assert.deepEqual(await lakeInputState(prepared.projectRoot), before);
			const receiptBytes = await readFile(
				join(outputRoot, "package-set-receipt.json")
			);
			const value = JSON.parse(receiptBytes);
			const archives = Object.fromEntries(value.packages
				.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))
				.sort(([left], [right]) => left.localeCompare(right)));
			const fact = {
				...directProofErasurePhpComponentFact(components)
				, packageSetReceiptSha256: sha256(receiptBytes), archives
			};
			await retainDirectProofErasurePhpComponents(records, attempt
				, outputRoot);
			await saveLakeFile(records, `build-${attempt}/package-set-receipt.json`
				, receiptBytes);
			await saveLakeFile(records, `build-${attempt}/configuration.json`
				, canonicalJson(prepared.configuration));
			await saveLakeFile(records, `build-${attempt}/DirectProofErasure.lean`
				, await readFile(join(prepared.projectRoot, "DirectProofErasure.lean")));
			if(attempt === 0)
			{
				const evidence = await retainPackageSetEvidence(outputRoot, retained);
				receipt = evidence.receipt;
			}
			builds.push(fact);
			await rm(prepared.directory, { recursive: true, force: true });
			await assert.rejects(lstat(prepared.directory), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]);
		await verifyPackageSetReceipt({
			receiptPath: join(retained, "package-set-receipt.json")
		});
		const handoff = join(suite, "handoff");
		await copyPackageSetHandoff(retained, handoff);
		const fixtureSource = await readFile(
			"tests/fixtures/direct-proof-erasure-consumers/php.php", "utf8"
		);
		const nativeSource = directProofErasurePhpConsumerSource(fixtureSource, {
			route, profile: "php-native"
		});
		const wasmFixtureSource = directProofErasurePhpConsumerSource(fixtureSource, {
			route, profile: "php-wasm"
		});
		const consumer = join(suite, "consumers"), observations = [];

		const nativePackages = receipt.packages.filter(
			item => item.target === "php-native"
		);
		const native = await installCopiedConsumer({
			profile: "php-native", consumer, handoff
			, packages: nativePackages
			, environment
			, fixture: {
				source: () => nativeSource, success: "direct-proof-php"
				, expectedChecks: 1005
			}
		});
		const nativeRoot = join(consumer, "php-native");
		const nativeApi = await readFile(apiPath(nativeRoot, "php-native"));
		assertApi(nativeApi.toString(), route, "php-native");
		const relocatedNative = join(consumer, "php-native-relocated");
		await rename(nativeRoot, relocatedNative);
		await assert.rejects(access(nativeRoot), { code: "ENOENT" });
		const nativeExecutions = [
			{ checks: 1005, mode: "strict", relocated: false }
			, { checks: 1005, mode: "weak", relocated: false }
		];
		for(const [mode, file] of [["weak", "consumer.php"], ["strict", "strict.php"]])
		{
			const run = await runCopied(environment.LEAN_BRIDGE_PHP, [
				"-n", "-d", "extension=ffi", "-d", "ffi.enable=1", file
			], relocatedNative, copiedCleanEnvironment);
			assert.equal(run.stderr, "");
			assert.equal(run.stdout, "direct-proof-php:1005\n");
			nativeExecutions.push({ checks: 1005, mode, relocated: true });
		}
		await saveLakeFile(records, "php-native/consumer.php", nativeSource);
		await saveLakeFile(records, "php-native/Api.php", nativeApi);
		observations.push({
			profile: "php-native", checks: native.checks
			, offlineInstall: native.offlineInstall
			, compilerFreePath: native.compilerFreePath
			, runtimeParameters: 1, proofSlots: 0
			, consumerSha256: sha256(nativeSource), apiSha256: sha256(nativeApi)
			, executions: nativeExecutions
			, negativeProofArgument: {
				rejected: true
				, namedArguments: `_before,${directProofErasurePhpParameter(route)},_after`
				, attempts: 4
			}
		});

		const wasmPackages = receipt.packages.filter(
			item => item.target === "php-wasm"
		);
		const wasm = await installCopiedConsumer({
			profile: "php-wasm", consumer, handoff
			, packages: wasmPackages
			, environment
			, fixture: {
				source: () => wasmFixtureSource, success: "direct-proof-php"
				, phpInvalid: phpInvalid(route, "php-wasm"), removeHandoff: true
			}
		});
		await assert.rejects(access(handoff), { code: "ENOENT" });
		const wasmRoot = join(consumer, "php-wasm");
		const wasmSource = await readFile(join(wasmRoot, "weak.php"));
		const wasmApi = await readFile(apiPath(wasmRoot, "php-wasm"));
		assertApi(wasmApi.toString(), route, "php-wasm");
		const driver = await readFile(join(wasmRoot, "driver.mjs"));
		await saveLakeFile(records, "php-wasm/consumer.php", wasmSource);
		await saveLakeFile(records, "php-wasm/Api.php", wasmApi);
		await saveLakeFile(records, "php-wasm/driver.mjs", driver);
		observations.push({
			profile: "php-wasm", checks: wasm.checks
			, offlineInstall: wasm.offlineInstall
			, compilerFreePath: wasm.compilerFreePath
			, runtimeParameters: 1, proofSlots: 0
			, consumerSha256: sha256(wasmSource), apiSha256: sha256(wasmApi)
			, driverSha256: wasm.driverSha256
			, browserVersion: wasm.browserVersion, executions: wasm.executions
			, negativeProofArgument: {
				rejected: true
				, namedArguments: `_before,${directProofErasurePhpParameter(route)},_after`
				, attempts: 24
			}
		});
		const report = {
			schemaVersion: 1, route, profiles: directProofErasurePhpProfiles
			, producerCommit, builds, receipt, observations
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
			, relocatedInstallation: true
		};
		await saveLakeFile(records, "report.json", canonicalJson(report));
	}
);
