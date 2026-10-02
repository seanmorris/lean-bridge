/**
 * Reject coordinated callback contracts and unsupported installed Maven claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertOwnedJvmCallbackPackageInputs, assertOwnedJvmCallbackPackageExecution } from "./helpers/owned-jvm-callback-result-package-evidence.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST === "1";
const report = async (mode, variant) => JSON.parse(await readFile(`build/owned-jvm-callback-results/${mode}-${variant}-package.json`, "utf8"));
const zero = "0".repeat(64);

test("JVM callback package reports reconstruct all native and managed contracts", {
	skip: !enabled, timeout: 300000
}, async t => {
	let reports = 0, rejected = 0;
	for(const mode of ["ordinary", "reviewed"]) for(const variant of ["no-host", "combined"])
	{
		const original = await report(mode, variant);
		await assertOwnedJvmCallbackPackageInputs(original); reports++;
		const mutations = [
			item => { item.adapter.jvmValues.callbackResultAnchors.anchor = "closure-owner"; }
			, item => { item.compiled.ownedValues.callbackResultAnchors.signatures.pop(); }
			, item => { item.manifest.ownedValues.callbackResultAnchors.signatures[1].parameter = 0; }
			, item => { item.componentReceipt.callbackResultAnchors.maximumDepth++; }
			, item => { item.adapter.schemaVersion--; }
			, item => { item.compiled.schemaVersion--; }
			, item => { item.manifest.schemaVersion--; }
			, item => { item.manifest.runtimeIdentity = zero; }
			, item => { item.compiled.evidence.libraries["libleanshared.so"] = zero; }
			, item => { item.compiled.evidence.ownedValues.callbackResultAnchors.anchor = "closure-owner"; }
			, item => {
				const path = `src/main/java/${item.compiled.namespace.replaceAll(".", "/")}/Api.java`;
				item.compiled.files[path].sha256 = zero;
				item.manifest.files[`META-INF/lean-bridge/jvm/${path}`].sha256 = zero;
				item.manifest.compiledProjectionSha256 = sha256(canonicalJson(item.compiled));
			}
			, item => { delete item.manifest.files["META-INF/lean-bridge/component/model.json"]; }
			, item => { item.manifest.files["META-INF/lean-bridge/native-jvm-adapter.json"].bytes--; }
			, item => { item.input.sourceIdentity.exportConfigurationSha256 = zero; }
			, item => { item.input.sourceIdentity.modules[0].source.sha256 = zero; }
			, item => { item.compiled.kotlin.options = []; }
			, item => { item.manifest.files["META-INF/maven/org.leanbridge/owned-callback-results/pom.xml"].sha256 = zero; }
			, item => { item.adapter.files["src/owned_aggregates-jvm-thread-exit.cpp"].sha256 = zero; }
			, item => { item.adapter.files["unrecorded.c"] = { bytes: 1, sha256: zero }; }
			, item => {
				for(const contract of [item.adapter.jvmValues, item.compiled.ownedValues, item.manifest.ownedValues, item.compiled.evidence.ownedValues])
					contract.callbackResultAnchors.anchor = "closure-owner";
			}
		];
		for(const [index, change] of mutations.entries())
		{
			const changed = structuredClone(original); change(changed);
			await assert.rejects(assertOwnedJvmCallbackPackageInputs(changed), `${mode}/${variant} input forgery ${index}`); rejected++;
		}
	}
	assert.equal(reports, 4); assert.equal(rejected, 80);
	t.diagnostic(JSON.stringify({ reports, rejected }));
});

for(const mode of ["ordinary", "reviewed"]) for(const variant of ["no-host", "combined"])
test(`installed JVM callback execution reconstructs ${mode} ${variant}`, {
	skip: !enabled, timeout: 300000
}, async t => {
	const original = await report(mode, variant);
	await assertOwnedJvmCallbackPackageExecution(original);
	const mutations = [
		item => { item.observations[0].checks++; }
		, item => { item.sourceRemovedBeforeInstallation = false; }
		, item => { item.observations[1].jvm.consumerSourceSha256 = zero; }
		, item => { item.observations[0].jvm.signaturesSha256 = zero; }
		, item => { item.observations[0].observation.results.pop(); }
		, item => { item.observations[1].observation.results[2].diagnostics[0].code = "unrelated"; }
		, item => { item.observations[0].jvm.documentation.pop(); }
		, item => { item.observations[1].jvm.documentation[0].sourceSha256 = zero; }
		, item => { item.observations[0].jvm.documentation[0].stdout = "unsupported\n"; }
		, item => { item.observations[0].jvm.runtimeExecutions.pop(); }
		, item => { item.observations[1].jvm.runtimeExecutions[1].stderr = "unexplained warning"; }
		, item => { item.observations[0].jvm.runtimeExecutions[1].stdout = "{}\n"; }
		, item => {
			const execution = item.observations[1].jvm.runtimeExecutions[1];
			execution.observation.results[1].observed.integer = "999";
			execution.stdout = JSON.stringify(execution.observation);
		}
		, item => { item.observations[0].jvm.runtimeExecutions[0].code = 1; }
		, item => { item.observations[1].jvm.runtimeModules.push("jdk.compiler@22.0.2"); }
		, item => { item.observations[0].jvm.deployment["package.jar"].sha256 = zero; }
		, item => { item.observations[0].observation.nativeLibraries["libleanshared.so"] = zero; }
		, item => { item.observations[1].jvm.resolvedDependencies[0].sha256 = zero; }
		, item => { item.observations[0].jvm.inspection.scenarios.pop(); }
		, item => { item.observations[0].jvm.inspection.scenarios[0].diagnostic = "unrelated"; }
		, item => { item.observations[0].jvm.inspection.scenarios[1].existingPackageUsable = false; }
		, item => { item.observations[0].jvm.inspection.scenarios[0].nativeLibraries = item.observations[0].jvm.nativeLibraries; }
		, item => { item.observations[0].jvm.inspection.probeSha256 = zero; }
		, item => { item.tamperRejections.pop(); }
		, item => { item.incapableReadersRejected.pop(); }
		, item => { item.cli.externalRegistryWrites = true; }
		, item => { item.cliInstallation.filesVerified--; }
		, item => { item.builds.pop(); }
		, item => {
			const build = item.builds[1];
			(item.combined ? build.result : build.projections[0]).packages[0].sha256 = zero;
		}
		, item => { item.independentPackageSetReceipt.packages[0].artifacts[0].sha256 = zero; }
		, item => { item.packageSetReceipt.packages[0].artifacts[0].sha256 = zero; }
		, item => { item.verification.result.receiptSha256 = zero; }
	];
	for(const [index, change] of mutations.entries())
	{
		const changed = structuredClone(original); change(changed);
		await assert.rejects(assertOwnedJvmCallbackPackageExecution(changed), `execution forgery ${index}`);
	}
	t.diagnostic(`${mutations.length} false execution claims rejected`);
});
