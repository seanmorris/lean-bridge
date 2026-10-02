/**
 * Build and install JVM callbacks beside every completed callback backend.
 *
 * @file
 */
import test from "node:test";
import { runOwnedCallbackCombinedRelease } from "./helpers/owned-callback-combined-release.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration as configuration
	, ownedDotnetCallbackResultCombinedReviewedIr as reviewedIr
	, ownedDotnetCallbackResultCombinedSource as source } from "./helpers/owned-dotnet-callback-result-fixture.mjs";

test("installed Maven and C/C++/Cargo/PyPI/RubyGems/NuGet/npm archives share callback-result contracts", {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_PACKAGE_TEST !== "1"
	, timeout: 7200000
}, t => runOwnedCallbackCombinedRelease(t, {
	configuration, reviewedIr, source, dotnet: true, jvm: true
	, buildTimeoutMs: 2400000
	, reportDirectory: "build/owned-jvm-callback-results"
}));
