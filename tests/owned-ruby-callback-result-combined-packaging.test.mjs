/**
 * Original archives preserve combined callback, receiver and transfer APIs.
 *
 * @file
 */
import test from "node:test";
import { runOwnedCallbackCombinedRelease } from "./helpers/owned-callback-combined-release.mjs";
import { ownedRubyCallbackResultCombinedConfiguration as configuration
	, ownedRubyCallbackResultCombinedReviewedIr as reviewedIr
	, ownedRubyCallbackResultCombinedSource as source } from "./helpers/owned-ruby-callback-result-fixture.mjs";

test("installed C/C++/Cargo/PyPI/RubyGems/npm archives combine callback lifetimes, receiver methods and transfers", {
	skip: process.env.LEAN_BRIDGE_OWNED_RUBY_CALLBACK_RESULT_TEST !== "1"
	, timeout: 1800000
}, t => runOwnedCallbackCombinedRelease(t, {
	configuration, reviewedIr, source
	, reportDirectory: "build/owned-ruby-callback-results"
}));
