/**
 * Source-free ordinary and reviewed PHP acceptance for optional parameters.
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
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment
	, runCopied
} from "./helpers/copied-fixture-install.mjs";
import {
	optionalParameterPhpProfiles
} from "./helpers/optional-parameter-php-report.mjs";
import {
	optionalParameterPhpProfilePatterns
} from "./helpers/optional-parameter-installed-contract.mjs";
import {
	assertOptionalParameterPhpComponents, optionalParameterPhpComponentFact
	, prepareOptionalParameterProject, retainOptionalParameterPhpComponents
} from "./helpers/optional-parameter-packages.mjs";
import { optionalParameterBinder }
	from "./helpers/optional-parameter-fixture.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	copyPackageSetHandoff, retainPackageSetEvidence
} from "./helpers/package-set.mjs";

const flag = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_PHP_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag)
	, "Invalid LEAN_BRIDGE_OPTIONAL_PARAMETER_PHP_TEST");
const enabled = flag === "1";
const routes = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_PHP_ROUTES?.split(",")
	?? ["ordinary", "reviewed"];
assert.ok(routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const outputFor = route => resolve((
	process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_PHP_OUTPUT
		?? "build/optional-parameter-php/{route}"
).replace("{route}", route));
const apiPath = (root, profile) => join(root, "vendor/example"
	, `${profile === "php-wasm"
		? "optionalparameters-php-wasm" : "optionalparameters"}/src/Api.php`);
const phpInvalid = route => `$rejected = false;
try { \\LeanDefaults\\word(${optionalParameterBinder(route)}: 7, extra: null); } catch (\\Error) { $rejected = true; }
if (!$rejected) throw new \\RuntimeException('Unknown named input was accepted');`;
const assertApi = (source, route, profile) => {
	for(const pattern of optionalParameterPhpProfilePatterns(route, profile))
		assert.match(source, pattern);
};

for(const route of routes) test(
	`installed optional-parameter PHP packages reproduce and relocate ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const records = outputFor(route);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const suite = await mkdtemp(join(tmpdir(), "lean-bridge-optional-php-"));
		t.after(() => rm(suite, { recursive: true, force: true }));
		const environment = {
			...nativeFixtureEnvironment(optionalParameterPhpProfiles)
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
			const prepared = await prepareOptionalParameterProject(t, {
				route, profiles: optionalParameterPhpProfiles
			});
			const before = await lakeInputState(prepared.projectRoot);
			const outputRoot = join(prepared.directory, "release");
			const built = await buildCanonicalProject({
				projectRoot: prepared.projectRoot, outputRoot
				, targets: optionalParameterPhpProfiles, environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			const components = await assertOptionalParameterPhpComponents(outputRoot);
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
				...optionalParameterPhpComponentFact(components)
				, bindingIrSha256: built.bindingIrSha256
				, packageSetReceiptSha256: sha256(receiptBytes), archives
			};
			await retainOptionalParameterPhpComponents(
				records, attempt, outputRoot);
			await saveLakeFile(records, `build-${attempt}/package-set-receipt.json`
				, receiptBytes);
			await saveLakeFile(records, `build-${attempt}/configuration.json`
				, canonicalJson(prepared.configuration));
			await saveLakeFile(records, `build-${attempt}/Defaults.lean`
				, await readFile(join(prepared.projectRoot, "Defaults.lean")));
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
		const source = await readFile(
			"tests/fixtures/optional-parameter-consumers/php.php", "utf8"
		);
		const consumer = join(suite, "consumers"), observations = [];

		const nativePackages = receipt.packages.filter(
			item => item.target === "php-native"
		);
		const native = await installCopiedConsumer({
			profile: "php-native", consumer, handoff, packages: nativePackages
			, environment
			, fixture: {
				source: () => source, success: "optional-parameter-php"
				, expectedChecks: 23
			}
		});
		const nativeRoot = join(consumer, "php-native");
		const nativeApi = await readFile(apiPath(nativeRoot, "php-native"));
		assertApi(nativeApi.toString(), route, "php-native");
		const relocatedNative = join(consumer, "php-native-relocated");
		await rename(nativeRoot, relocatedNative);
		await assert.rejects(access(nativeRoot), { code: "ENOENT" });
		const nativeExecutions = [
			{ checks: 23, mode: "strict", relocated: false }
			, { checks: 23, mode: "weak", relocated: false }
		];
		for(const [mode, file] of [["weak", "consumer.php"], ["strict", "strict.php"]])
		{
			const run = await runCopied(environment.LEAN_BRIDGE_PHP, [
				"-n", "-d", "extension=ffi", "-d", "ffi.enable=1", file
			], relocatedNative, copiedCleanEnvironment);
			assert.equal(run.stderr, "");
			assert.equal(run.stdout, "optional-parameter-php:23\n");
			nativeExecutions.push({ checks: 23, mode, relocated: true });
		}
		await saveLakeFile(records, "php-native/consumer.php", source);
		await saveLakeFile(records, "php-native/Api.php", nativeApi);
		observations.push({
			profile: "php-native", checks: native.checks
			, offlineInstall: native.offlineInstall
			, compilerFreePath: native.compilerFreePath
			, consumerSha256: sha256(source), apiSha256: sha256(nativeApi)
			, executions: nativeExecutions, invalidHostValuesPerExecution: 2
		});

		const wasmPackages = receipt.packages.filter(
			item => item.target === "php-wasm"
		);
		const wasm = await installCopiedConsumer({
			profile: "php-wasm", consumer, handoff, packages: wasmPackages
			, environment
			, fixture: {
				source: () => source, success: "optional-parameter-php"
				, expectedChecks: 23
				, phpInvalid: phpInvalid(route), removeHandoff: true
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
			, consumerSha256: sha256(wasmSource), apiSha256: sha256(wasmApi)
			, driverSha256: wasm.driverSha256
			, browserVersion: wasm.browserVersion, executions: wasm.executions
			, invalidHostValuesPerExecution: 2, preloadRejection: true
		});
		const report = {
			schemaVersion: 1, route, profiles: optionalParameterPhpProfiles
			, producerCommit, builds, receipt, observations
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
			, relocatedInstallation: true
		};
		await saveLakeFile(records, "report.json", canonicalJson(report));
	}
);
