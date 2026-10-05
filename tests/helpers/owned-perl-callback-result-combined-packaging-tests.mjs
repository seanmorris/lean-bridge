/**
 * Install nine archive targets built from one native and one Wasm source model.
 *
 * @file
 */
import test from "node:test";
import { runOwnedCallbackCombinedRelease } from "./owned-callback-combined-release.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration as configuration
	, ownedDotnetCallbackResultCombinedReviewedIr as reviewedIr
	, ownedDotnetCallbackResultCombinedSource as source } from "./owned-dotnet-callback-result-fixture.mjs";
import { prepareOwnedPerlCallbackCombined } from "./owned-perl-callback-result-combined-install.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";

test("installed CPAN and eight peer targets share callback-result contracts", {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_PACKAGE_TEST !== "1"
	, timeout: 7200000
}, t => runOwnedCallbackCombinedRelease(t, {
	configuration, reviewedIr, source, dotnet: true, jvm: true
	, independentRebuild: false, minimumFreeBytes: 3 * 1024 ** 3
	, additionalNativeConsumer: {
		target: "cpan", profile: "perl"
		, configuration: { module: "LeanBridge::OwnedProbe", version: "0.010" }
		, roles: ["runtime", "component"]
		, environment: { LEAN_BRIDGE_PERLS: JSON.stringify(perlGraphCommands()) }
		, prepare: prepareOwnedPerlCallbackCombined
	}
	, buildTimeoutMs: 2400000
	, reportDirectory: "build/owned-perl-callback-results"
}));
