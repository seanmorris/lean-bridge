/**
 * Source-free ordinary and reviewed WIT/WASI acceptance for optional
 * parameters.
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
import { verifyFinContainerEdgeArchiveClosure } from "./helpers/fin-container-edge-closure.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	assertOptionalParameterNativeComponent, prepareOptionalParameterProject
	, retainOptionalParameterNativeComponent
} from "./helpers/optional-parameter-packages.mjs";
import { retainPackageSetEvidence } from "./helpers/package-set.mjs";

const flag = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_WIT_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag)
	, "Invalid LEAN_BRIDGE_OPTIONAL_PARAMETER_WIT_TEST");
const enabled = flag === "1";
const routes = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_WIT_ROUTES
	?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const outputFor = route => resolve((
	process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_WIT_OUTPUT
		?? "build/optional-parameter-wit/{route}"
).replace("{route}", route));
const sourcePath = "tests/fixtures/optional-parameter-consumers/wit-wasi.c";
const witPatterns = Object.freeze([
	/word: func\(value0: u32\) -> u32;/u
	, /word-default: func\(\) -> u32;/u
	, /natural-default: func\(\) -> bridge-value-/u
	, /text-default: func\(\) -> string;/u
	, /character-default: func\(\) -> char;/u
	, /maybe-default: func\(\) -> bridge-value-/u
	, /present-default: func\(\) -> bridge-value-/u
	, /unit-value-default: func\(\) -> bridge-value-/u
]);

for(const route of routes) test(
	`installed optional-parameter WIT package reproduces and relocates ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const records = outputFor(route);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const suite = await mkdtemp(join(tmpdir(), "lean-bridge-optional-wit-"));
		t.after(() => rm(suite, { recursive: true, force: true }));
		const environment = {
			...nativeFixtureEnvironment(["wit-wasi"])
			, LEAN_BRIDGE_WASM_TOOLS: resolve(
				process.env.LEAN_BRIDGE_WASM_TOOLS
					?? ".toolchains/wasm-tools/bin/wasm-tools"
			)
		};
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim();
		const builds = [], handoff = join(records, "handoff");
		let receipt;
		for(const attempt of [0, 1])
		{
			const prepared = await prepareOptionalParameterProject(t, {
				route, profiles: ["wit-wasi"]
			});
			const before = await lakeInputState(prepared.projectRoot);
			const outputRoot = join(prepared.directory, "release");
			const built = await buildCanonicalProject({
				projectRoot: prepared.projectRoot, outputRoot
				, targets: ["wit-wasi"], environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			const component = await assertOptionalParameterNativeComponent(outputRoot);
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
				...component, bindingIrSha256: built.bindingIrSha256
				, packageSetReceiptSha256: sha256(receiptBytes), archives
			};
			await retainOptionalParameterNativeComponent(
				records, attempt, outputRoot);
			await saveLakeFile(records, `build-${attempt}/package-set-receipt.json`
				, receiptBytes);
			await saveLakeFile(records, `build-${attempt}/configuration.json`
				, canonicalJson(prepared.configuration));
			await saveLakeFile(records, `build-${attempt}/Defaults.lean`
				, await readFile(join(prepared.projectRoot, "Defaults.lean")));
			if(attempt === 0)
			{
				const retained = await retainPackageSetEvidence(outputRoot, handoff);
				receipt = retained.receipt;
			}
			builds.push(fact);
			await rm(prepared.directory, { recursive: true, force: true });
			await assert.rejects(lstat(prepared.directory), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]);
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		const packages = receipt.packages.filter(item => item.target === "wit-wasi");
		assert.equal(packages.length, 1);
		const pkg = packages[0];
		assert.equal(pkg.role, "component");
		const source = await readFile(sourcePath, "utf8");
		const consumerRoot = join(suite, "consumers");
		const installed = await installCopiedConsumer({
			profile: "wit-wasi", consumer: consumerRoot, handoff, packages, environment
			, fixture: {
				source: () => source, success: "optional-parameter-wit-wasi"
				, expectedChecks: 21, wit: witPatterns
				, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure
			}
		});
		const root = join(consumerRoot, "wit-wasi");
		const executableSha256 = sha256(await readFile(join(root, "consumer")));
		const relocated = join(consumerRoot, "wit-wasi-relocated");
		await rename(root, relocated);
		await assert.rejects(access(root), { code: "ENOENT" });
		const installedRoot = join(relocated
			, `${pkg.name}-${pkg.version}-wit-wasi`);
		const archive = join(handoff, pkg.artifacts[0].path);
		const closure = await verifyFinContainerEdgeArchiveClosure({
			profile: "wit-wasi", installed: installedRoot
			, receiptPath: "lean-bridge-package.json"
			, archive, archiveSha256: pkg.artifacts[0].sha256
		});
		const rerun = await runCopied(join(relocated, "consumer"), [], relocated
			, copiedCleanEnvironment);
		assert.equal(rerun.stderr, "");
		assert.equal(rerun.stdout, "optional-parameter-wit-wasi:21\n");
		assert.equal(sha256(await readFile(join(relocated, "consumer")))
			, executableSha256);
		assert.equal(await readFile(join(relocated, "consumer.c"), "utf8"), source);
		const header = await readFile(
			join(installedRoot, "include/defaults_wasmtime.h")
		);
		const wit = await readFile(join(installedRoot, "wit/defaults.wit"));
		for(const pattern of witPatterns)
			assert.match(wit.toString(), pattern);
		const componentWit = (await runCopied(environment.LEAN_BRIDGE_WASM_TOOLS, [
			"component", "wit", join(installedRoot, `component/${pkg.name}.wasm`)
		], relocated)).stdout;
		for(const pattern of witPatterns)
			assert.match(componentWit, pattern);
		await saveLakeFile(records, "wit-wasi/consumer.c", source);
		await saveLakeFile(records, "wit-wasi/defaults.wit", wit);
		await saveLakeFile(records, "wit-wasi/defaults_wasmtime.h", header);
		await saveLakeFile(records, "wit-wasi/component.wit", componentWit);
		await saveLakeFile(records, "report.json", canonicalJson({
			schemaVersion: 1, profile: "wit-wasi", route, producerCommit
			, builds, receipt
			, observation: {
				profile: "wit-wasi", checks: 23, runtimeChecks: installed.checks
				, invalidHostValues: 2, explicitHostNull: true
				, offlineInstall: installed.offlineInstall
				, compilerFreePath: installed.compilerFreePath
				, consumerSha256: sha256(source), headerSha256: sha256(header)
				, witSha256: sha256(wit), componentWitSha256: sha256(componentWit)
				, executableSha256, closure
				, executions: [
					{ checks: 21, relocated: false }
					, { checks: 21, relocated: true }
				]
				, refusals: [
					{
						kind: "explicit-host-null"
						, diagnostic: "Invalid WIT call arguments or unavailable session"
					}
					, {
						kind: "wrong-host-type"
						, diagnostic: "Unknown export, invalid WIT input or 16 MiB conversion limit"
					}
				]
			}
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
			, relocatedInstallation: true
		}));
	}
);
