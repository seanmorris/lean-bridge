/**
 * Reject false CPAN or peer claims without weakening eight-target defaults.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedJvmCallbackCombinedRelease } from "./owned-jvm-callback-result-combined-evidence.mjs";
import { assertOwnedPerlCallbackCombinedRelease } from "./owned-perl-callback-result-combined-evidence.mjs";

const zero = "0".repeat(64);
const directory = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_PACKAGE_REPORTS ?? "build/owned-perl-callback-results";
const first = item => item.installedPerl.observations[0];
const rawPerl = mutate => item => {
	const execution = first(item).executions[0]; mutate(execution.observation);
	execution.stdout = JSON.stringify(execution.observation) + "\n";
};
const cliGenerated = path => item => {
	item.cli.files.find(file => file.path === path).sha256 = "1".repeat(64);
	const inventory = Object.fromEntries(Object.entries(item.cli)
		.filter(([name]) => !["archive", "inventorySha256", "externalRegistryWrites"].includes(name)));
	item.cli.inventorySha256 = sha256(canonicalJson(inventory));
};
const changes = [
	["extra acceptance", item => { item.acceptance = true; }]
	, ["report schema", item => { item.schemaVersion++; }]
	, ["source mode", item => { item.mode = item.mode === "ordinary" ? "reviewed" : "ordinary"; }]
	, ["invented rebuild", item => { item.independentProducerBuild = true; }]
	, ["unclaimed build", item => { item.independentBuild = structuredClone(item.built); }]
	, ["unclaimed second receipt", item => { item.independentPackageSetReceipt = structuredClone(item.receipt); }]
	, ["compiler metadata", item => { item.nativeInput.metadata.producer.toolVersion = "4.99.0"; }]
	, ["source configuration", item => { item.nativeInput.sourceIdentity.exportConfigurationSource = "{}"; }]
	, ["coordinated generated CLI README", cliGenerated("README.md")]
	, ["coordinated generated CLI manifest", cliGenerated("package.json")]
	, ["different Perl model", item => { item.installedPerl.model.schemaVersion++; }]
	, ["missing callback policy", item => { delete item.installedPerl.manifest.ownedValues.callbackResultAnchors; }]
	, ["callback-local parameter", item => { item.installedPerl.manifest.ownedValues.callbackResultAnchors.signatures[0].parameter++; }]
	, ["binding contract", item => { item.installedPerl.bindingManifest.schemaVersion++; }]
	, ["different shared core", item => { item.installedPerl.componentReceipt.nativeLibrary.sha256 = zero; }]
	, ["compiled XS source", item => { item.installedPerl.manifest.files["Component.xs"] = zero; }]
	, ["installer source", item => { item.installedPerl.manifest.files["LeanBridgeBuild.pm"] = zero; }]
	, ["runtime coordinate", item => { item.installedPerl.runtimeManifest.version = "0.001"; }]
	, ["runtime identity confusion", item => { item.installedPerl.manifest.runtimeIdentity = item.installedPerl.manifest.nativeRuntimeIdentity; }]
	, ["unbound CPAN archive", item => { item.installedPerl.archives[0].sha256 = zero; }]
	, ["missing CPAN target", item => { item.receipt.packages = item.receipt.packages.filter(pkg => pkg.target !== "cpan"); }]
	, ["missing prebuilt ABI", item => { item.installedPerl.manifest.prebuilt.pop(); }]
	, ["missing install", item => { item.installedPerl.observations.pop(); }]
	, ["repeated ABI", item => { item.installedPerl.observations[2] = structuredClone(first(item)); }]
	, ["missing public rerun", item => { first(item).executions.pop(); }]
	, ["false owner count", rawPerl(observed => { observed.checks--; })]
	, ["false host count", rawPerl(observed => { observed.phases.host--; })]
	, ["runtime failure", item => { first(item).executions[0].code = 7; }]
	, ["runtime warning", item => { first(item).executions[0].stderr = "closed owner\n"; }]
	, ["wrong install image", item => { first(item).receipts[1].installed.sha256 = zero; }]
	, ["omitted configure", item => { first(item).installs[1].commands.splice(1, 1); }]
	, ["missing asset rejection", item => { first(item).assets.observations.pop(); }]
	, ["live broker after asset failure", item => {
		const asset = first(item).assets.observations[0];
		asset.observation.brokerIdentities++; asset.execution.stdout = JSON.stringify(asset.observation);
	}]
	, ["native counter promotion", item => { item.installedPerl.limitations = []; }]
	, ["missing raw producer", item => { item.rawExecutions.splice(1, 1); }]
	, ["producer failure", item => { item.rawExecutions[1].code = 1; }]
	, ["producer target arguments", item => { item.rawExecutions[1].args.splice(-5, 2); }]
	, ["changed build stdout", item => { item.rawExecutions[1].stdout = "{}\n"; }]
	, ["invalid Node executable", item => { item.rawExecutions[2].command = "/usr/bin/false"; }]
	, ["inconsistent Node executable", item => { item.rawExecutions[38].command = "/different/bin/node"; }]
	, ["verify not raw", item => { item.cliVerificationExecution.stdout = "{}\n"; }]
	, ["coordinated verification", item => {
		item.cliVerification.result.archives--;
		item.cliVerificationExecution.stdout = canonicalJson(item.cliVerification);
		item.rawExecutions[2].stdout = canonicalJson(item.cliVerification);
	}]
	, ["C public check skipped", item => { item.rawExecutions[5].stdout = "callback-results-installed:218\n"; }]
	, ["C++ public check skipped", item => { item.rawExecutions[8].stdout = "owned-cpp-callback-results-installed:75\n"; }]
	, ["Python relocated check skipped", item => { item.rawExecutions[33].stdout = "{}\n"; }]
	, ["Rust rerun skipped", item => { item.rawExecutions.splice(37, 1); }]
	, ["JS callback result changed", item => { item.rawExecutions[38].stdout = "{}\n"; }]
	, ["JVM public rerun skipped", item => { item.installedJvm.observations[0].jvm.runtimeExecutions.pop(); }]
	, ["JVM documentation changed", item => { item.installedJvm.observations[1].jvm.documentation[0].sourceSha256 = zero; }]
	, ["dotnet result changed", item => { item.installedDotnet.relocatedChecks--; }]
	, ["Ruby owner leak", item => { item.installedRuby.loader.liveIdentities++; }]
	, ["browser skipped", item => { item.browser.executions.pop(); }]
];

for(const mode of ["ordinary", "reviewed"])
test(`nine-target Perl callback release reconstructs ${mode} inputs and execution`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_EVIDENCE_TEST !== "1"
	, timeout: 300000
}, async t => {
	const name = mode + "-combined-release.json";
	const original = JSON.parse(await readFile(join(directory, name), "utf8"));
	await assertOwnedPerlCallbackCombinedRelease(name, original);
	// This transformed report checks reader portability, not another execution.
	const portable = JSON.parse(JSON.stringify(original)
		.replaceAll(dirname(original.rawExecutions[0].cwd), "/ci/relocated-shared-producer")
		.replaceAll(original.rawExecutions[2].command, "/opt/hostedtoolcache/node/22/x64/bin/node"));
	await assertOwnedPerlCallbackCombinedRelease(name, portable);
	await assert.rejects(assertOwnedPerlCallbackCombinedRelease("wrong-name.json", original));
	for(const [label, mutate] of changes)
	{
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(assertOwnedPerlCallbackCombinedRelease(name, changed), label);
	}
	// Default eight-target readers must not inherit the opt-in ninth target or
	// waive their original independent-build requirement.
	await assert.rejects(assertOwnedJvmCallbackCombinedRelease(original), error =>
		error.actual === false && error.expected === true);
	const nine = structuredClone(original);
	nine.independentProducerBuild = true;
	nine.independentBuild = structuredClone(nine.built);
	nine.independentBuild.result.output += "-second";
	nine.independentPackageSetReceipt = structuredClone(nine.receipt);
	await assert.rejects(assertOwnedJvmCallbackCombinedRelease(nine));
	t.diagnostic(`${changes.length + 3} false shared-release or legacy-default claims rejected`);
});
