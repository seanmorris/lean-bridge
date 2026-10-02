/**
 * Reconstruct each ecosystem in the original seven-target callback release.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedRubyCallbackCombinedRelease } from "./owned-ruby-callback-result-acceptance.mjs";
import { ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { assertOwnedDotnetCallbackPackageInputs } from "./owned-dotnet-callback-result-package-evidence.mjs";
import { assertOwnedDotnetCallbackCli, assertOwnedDotnetCallbackInstalledExecution } from "./owned-dotnet-callback-result-package-execution.mjs";

const fixture = {
	source: ownedDotnetCallbackResultCombinedSource
	, exports: [["receiverExports", 5], ["resultAnchors", 1], ["inputTransfers", 2]]
	, cli: assertOwnedDotnetCallbackCli
	, cProbe: source => {
		const original = "owned_aggregates_callback_record_argument1_t_host";
		assert.equal(source.split(original).length, 3);
		return source.replaceAll(original, "owned_aggregates_apply_twice_argument1_t_host");
	}
};

/**
 * Validate shared compiler contracts and each independently generated package.
 *
 * @param item - Original combined release report.
 */
export const assertOwnedDotnetCallbackCombinedInputs = async item => {
	assert.ok(["ordinary", "reviewed"].includes(item.mode));
	await assertOwnedRubyCallbackCombinedRelease(item, item.mode, ["nuget"], fixture);
	const targets = {
		c: { name: "owned-callback-combinations", version: "1.2.3" }
		, cpp: { name: "owned-cpp-callback-combinations", version: "1.2.3" }
		, cargo: { name: "owned-callback-results", version: "1.2.3" }
		, pypi: { name: "owned-callback-results", version: "1.2.3" }
		, rubygems: { name: "owned-callback-results", version: "1.2.3" }
		, npm: { name: `@owned/${item.mode}-callback-combinations`, version: "1.2.3" }
		, nuget: { name: "Owned.CallbackResults", version: "1.2.3" }
	};
	const dotnet = item.installedDotnet;
	const reconstructed = await assertOwnedDotnetCallbackPackageInputs({
		mode: item.mode, combined: true, input: item.nativeInput
		, componentReceipt: item.native.receipt, runtimeReceipt: item.nativeRuntime
		, adapterReceipt: dotnet.adapterReceipt
		, compiledProjection: dotnet.compiledProjection, manifest: dotnet.manifest
	}, targets);
	const packages = item.receipt.packages.filter(value => value.target === "nuget");
	assert.equal(packages.length, 1);
	assert.equal(packages[0].name, dotnet.manifest.name);
	assert.equal(packages[0].version, dotnet.manifest.version);
	assert.equal(packages[0].runtimeIdentity, item.native.receipt.runtimeIdentity);
	assert.deepEqual([...item.built.result.targets].sort(), Object.keys(targets).sort());
	assert.deepEqual(item.receipt.profiles.map(profile => profile.id), ["javascript-wasm-owned-v1", "native-library-v1"]);
	for(const profile of item.receipt.profiles)
	{
		const compiled = profile.id === "native-library-v1" ? item.native : item.wasm;
		assert.equal(profile.bindingIrSha256, compiled.model.bindingIrSha256);
		if(profile.id === "native-library-v1") assert.equal(profile.runtimeIdentity, compiled.receipt.runtimeIdentity);
		for(const pkg of item.receipt.packages.filter(value => value.profile === profile.id))
			assert.equal(pkg.runtimeIdentity, profile.runtimeIdentity);
	}
	return reconstructed;
};

/**
 * Require SDK-free installed .NET execution alongside all six peer ecosystems.
 *
 * @param item - Complete release report after installed process checks.
 */
export const assertOwnedDotnetCallbackCombinedRelease = async item => {
	const { projection } = await assertOwnedDotnetCallbackCombinedInputs(item);
	const dotnet = item.installedDotnet;
	await assertOwnedDotnetCallbackInstalledExecution(dotnet, projection, true);
	assert.equal(dotnet.checks, 57); assert.equal(dotnet.relocatedChecks, 57);
	for(const name of ["cliRemovedBeforeConsumerInstall", "offlineInstall", "handoffRemovedBeforeRelocatedExecution"])
		assert.equal(dotnet[name], true, name);
};
