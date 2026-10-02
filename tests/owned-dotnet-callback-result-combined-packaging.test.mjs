/**
 * The installed CLI publishes .NET and its native/Wasm peers from one API.
 *
 * @file
 */
import test from "node:test";
import { runOwnedCallbackCombinedRelease } from "./helpers/owned-callback-combined-release.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration as configuration
	, ownedDotnetCallbackResultCombinedReviewedIr as reviewedIr
	, ownedDotnetCallbackResultCombinedSource as source } from "./helpers/owned-dotnet-callback-result-fixture.mjs";

test("installed NuGet and C/C++/Cargo/PyPI/RubyGems/npm archives share callback-result contracts", {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_CALLBACK_RESULT_TEST !== "1"
	, timeout: 2400000
}, t => runOwnedCallbackCombinedRelease(t, {
	configuration, reviewedIr, source, dotnet: true
	, reportDirectory: "build/owned-dotnet-callback-results"
}));
