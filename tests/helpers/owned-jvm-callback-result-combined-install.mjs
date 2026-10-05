/**
 * Consume Maven peers of a shared native/Wasm release without author files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedJvmEvidence } from "../../src/build/owned-jvm-artifacts.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { ownedJvmCallbackResultInstalledFixture } from "./owned-jvm-callback-result-installed.mjs";
import { inspectOwnedJvmInstalledAssets } from "./owned-jvm-installed-assets.mjs";
import { installedJvmCorpus } from "./type-corpus-jvm.mjs";
import { prepareJvmCorpusDependencies } from "./type-corpus-jvm-tools.mjs";

/**
 * Preserve original archives and offline build tools before removing producers.
 *
 * @param options - Shared producer, handoff and native source identity.
 */
export const prepareOwnedJvmCallbackCombined = async options => {
	const { root, mode, output, author, handoff, receipt, environment, native } = options;
	const nativeProfile = join(output, "profiles/native");
	const verified = await ownedJvmEvidence({ nativeRoot: join(nativeProfile, "native/component")
		, runtimeRoot: join(nativeProfile, "native/runtime")
		, adapterRoot: join(nativeProfile, "native/owned-jvm-binding") });
	assert.deepEqual(verified.model, native.model);
	assert.deepEqual(verified.receipt, native.receipt);
	const compiled = JSON.parse(await readFile(join(nativeProfile, "native/jvm/native-jvm.json"), "utf8"));
	const manifest = JSON.parse(await readFile(join(nativeProfile, "packages/maven/jar/META-INF/lean-bridge/package-receipt.json"), "utf8"));
	assert.equal(compiled.schemaVersion, 5); assert.equal(manifest.schemaVersion, 5);
	assert.deepEqual(compiled.ownedValues, verified.projection.contract);
	assert.deepEqual(manifest.ownedValues, verified.projection.contract);
	const packages = receipt.packages.filter(item => item.target === "maven");
	assert.equal(packages.length, 1); const pkg = packages[0];
	assert.equal(pkg.runtimeIdentity, native.receipt.runtimeIdentity);
	const dependencies = await prepareJvmCorpusDependencies({ directory: author
		, handoff, pkg, environment, clean: copiedCleanEnvironment });
	const fixture = ownedJvmCallbackResultInstalledFixture(verified.projection.namespace, true);
	for(const profile of ["java", "kotlin"])
		await cp(handoff, join(root, `${mode}-maven-handoff-${profile}`), { recursive: true });
	const report = { adapter: verified.adapter, compiled, manifest, dependencies, observations: [] };
	const execute = async consumer => {
		for(const path of [output, author, handoff])
			await assert.rejects(access(path), { code: "ENOENT" });
		for(const profile of ["java", "kotlin"])
		{
			const result = await installedJvmCorpus({ library: { jvmModule: verified.projection.namespace }
				, profile, consumer, handoff: join(root, `${mode}-maven-handoff-${profile}`)
				, pkg, dependencies, environment, clean: copiedCleanEnvironment
				, fixture: { ...fixture, ...profile === "java" ? { inspectInstalled: inspectOwnedJvmInstalledAssets } : {} } });
			assert.deepEqual(result.observation.errors, []);
			assert.equal(result.jvm.packageReceiptSha256, sha256(canonicalJson(manifest)));
			const checks = Number(result.observation.results.find(item => item.id === "owned/callback-result-checks").observed.integer);
			assert.equal(checks, 47);
			assert.equal(result.observation.results.filter(item => item.status === "rejected-at-compile-time").length, fixture.rejections(profile).length);
			assert.equal(result.jvm.handoffRemovedBeforeExecution, true);
			if(profile === "java")
			{
				assert.equal(result.jvm.inspection.scenarios.length, 40);
				assert.ok(result.jvm.inspection.scenarios.every(item => item.rejected));
			}
			report.observations.push({ profile, checks, ...result });
		}
	};
	return { report, execute };
};
