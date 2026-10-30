/**
 * Source-free ordinary and reviewed WIT/WASI acceptance for direct proof erasure.
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
import { verifyFinContainerEdgeArchiveClosure } from "./helpers/fin-container-edge-closure.mjs";
import {
	assertDirectProofErasureNativeComponent, prepareDirectProofErasureProject
	, retainDirectProofErasureNativeComponent
} from "./helpers/direct-proof-erasure-packages.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { retainPackageSetEvidence } from "./helpers/package-set.mjs";

const flag = process.env.LEAN_BRIDGE_DIRECT_PROOF_WIT_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag)
	, "Invalid LEAN_BRIDGE_DIRECT_PROOF_WIT_TEST");
const enabled = flag === "1";
const routes = process.env.LEAN_BRIDGE_DIRECT_PROOF_WIT_ROUTES?.split(",")
	?? ["ordinary", "reviewed"];
assert.ok(routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const outputFor = route => resolve((
	process.env.LEAN_BRIDGE_DIRECT_PROOF_WIT_OUTPUT
		?? "build/direct-proof-erasure-wit/{route}"
).replace("{route}", route));
const sourcePath = "tests/fixtures/direct-proof-erasure-consumers/wit-wasi.c";
const negativeSource = `#include "directprooferasure_wasmtime.h"
#include <stdint.h>
#include <stdio.h>
int main(void) {
  directprooferasure_wasmtime *session = NULL;
  if (directprooferasure_wasmtime_open(&session)) return 1;
  wasmtime_component_val_t args[3] = {
    {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 1},
    {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 0},
    {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 1}
  };
  wasmtime_component_val_t output = {
    .kind = WASMTIME_COMPONENT_U32, .of.u32 = UINT32_C(991)
  };
  wasmtime_error_t *error = directprooferasure_wasmtime_call(
      session, "keep", args, 3, &output);
  if (!error || output.kind != WASMTIME_COMPONENT_U32 || output.of.u32 != 991)
    return 2;
  wasm_name_t message = {0};
  wasmtime_error_message(error, &message);
  printf("direct-proof-wit-rejected:%.*s\\n", (int)message.size, message.data);
  wasm_name_delete(&message);
  wasmtime_error_delete(error);
  directprooferasure_wasmtime_close(session);
  return 0;
}
`;

for(const route of routes) test(
	`installed direct proof-erasure WIT package reproduces and relocates ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const records = outputFor(route);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const suite = await mkdtemp(join(tmpdir(), "lean-bridge-direct-proof-wit-"));
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
			const prepared = await prepareDirectProofErasureProject(t, {
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
			const component = await assertDirectProofErasureNativeComponent(outputRoot);
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
			await retainDirectProofErasureNativeComponent(records, attempt, outputRoot);
			await saveLakeFile(records, `build-${attempt}/package-set-receipt.json`
				, receiptBytes);
			await saveLakeFile(records, `build-${attempt}/configuration.json`
				, canonicalJson(prepared.configuration));
			await saveLakeFile(records, `build-${attempt}/DirectProofErasure.lean`
				, await readFile(join(prepared.projectRoot, "DirectProofErasure.lean")));
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
		const parameter = route === "ordinary" ? "arg0" : "value";
		const witSignature = new RegExp(
			`keep: func\\(${parameter}: u32\\) -> u32;`, "gu"
		);
		const source = await readFile(sourcePath, "utf8");
		const consumerRoot = join(suite, "consumers");
		const installed = await installCopiedConsumer({
			profile: "wit-wasi", consumer: consumerRoot, handoff, packages, environment
			, fixture: {
				source: () => source, success: "direct-proof-wit-wasi"
				, expectedChecks: 1005
				, wit: [new RegExp(witSignature.source, "u")]
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
		assert.equal(rerun.stdout, "direct-proof-wit-wasi:1005\n");
		assert.equal(sha256(await readFile(join(relocated, "consumer")))
			, executableSha256);
		assert.equal(await readFile(join(relocated, "consumer.c"), "utf8"), source);
		const header = await readFile(
			join(installedRoot, "include/directprooferasure_wasmtime.h")
		);
		const wit = await readFile(
			join(installedRoot, "wit/directprooferasure.wit")
		);
		for(const bytes of [header, wit])
			assert.doesNotMatch(bytes.toString()
				, /(?:\bTrue\b|\bproof\b|_before|_after)/iu);
		assert.equal((wit.toString().match(witSignature)
			?? []).length, 2);
		const componentWit = (await runCopied(environment.LEAN_BRIDGE_WASM_TOOLS, [
			"component", "wit", join(installedRoot, `component/${pkg.name}.wasm`)
		], relocated)).stdout;
		assert.match(componentWit, new RegExp(witSignature.source, "u"));
		assert.doesNotMatch(componentWit
			, /(?:\bTrue\b|\bproof\b|_before|_after)/iu);
		await saveLakeFile(relocated, "proof-argument-negative.c", negativeSource);
		const compile = {
			...copiedCleanEnvironment, PATH: join(relocated, "tools")
			, PKG_CONFIG_LIBDIR: join(installedRoot, "lib/pkgconfig")
			, PKG_CONFIG_PATH: ""
		};
		const flags = (await runCopied("/usr/bin/pkg-config", [
			"--cflags", "--libs", `${pkg.name}-wit`
		], relocated, compile)).stdout.trim().split(/\s+/u);
		await runCopied("/usr/bin/cc", [
			"-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
			, "proof-argument-negative.c", ...flags
			, "-o", "proof-argument-negative"
		], relocated, compile);
		const negative = await runCopied(join(relocated, "proof-argument-negative")
			, [], relocated, copiedCleanEnvironment);
		assert.equal(negative.stderr, "");
		assert.match(negative.stdout
			, /^direct-proof-wit-rejected:Unknown export, invalid WIT input or 16 MiB conversion limit\n$/u);
		const diagnostic = negative.stdout.trim().slice(
			"direct-proof-wit-rejected:".length
		);
		await saveLakeFile(records, "wit-wasi/consumer.c", source);
		await saveLakeFile(records, "wit-wasi/directprooferasure.wit", wit);
		await saveLakeFile(records
			, "wit-wasi/directprooferasure_wasmtime.h", header);
		await saveLakeFile(records, "wit-wasi/component.wit", componentWit);
		await saveLakeFile(records
			, "wit-wasi/proof-argument-negative.c", negativeSource);
		await saveLakeFile(records, "report.json", canonicalJson({
			schemaVersion: 1, profile: "wit-wasi", route, producerCommit
			, builds, receipt
			, observation: {
				profile: "wit-wasi", checks: installed.checks
				, runtimeParameters: 1, proofSlots: 0
				, offlineInstall: installed.offlineInstall
				, compilerFreePath: installed.compilerFreePath
				, consumerSha256: sha256(source), headerSha256: sha256(header)
				, witSha256: sha256(wit), componentWitSha256: sha256(componentWit)
				, executableSha256, closure
				, executions: [
					{ checks: 1005, relocated: false }
					, { checks: 1005, relocated: true }
				]
				, negativeProofArgument: {
					rejected: true, relocated: true, suppliedArguments: 3
					, diagnostic
				}
			}
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
			, relocatedInstallation: true
		}));
	}
);
