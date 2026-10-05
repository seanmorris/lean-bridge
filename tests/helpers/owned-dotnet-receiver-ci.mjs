/**
 * Require complete C# receiver acceptance and retain every installed report.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedRubyReceiverCi } from "./owned-ruby-receiver-ci.mjs";
import { assertOwnedDotnetBorrowCi } from "./owned-dotnet-borrow-evidence.mjs";

export const ownedDotnetReceiverScript = "LEAN_BRIDGE_OWNED_DOTNET_RECEIVER_TEST=1 node --test --test-concurrency=1 tests/owned-dotnet-receivers.test.mjs tests/owned-dotnet-receiver-packaging.test.mjs tests/owned-dotnet-receiver-plain.test.mjs";
export const ownedDotnetReceiverReports = ["ordinary", "reviewed"].flatMap(mode =>
	["", "-package", "-plain", "-consuming"].map(suffix => `build/owned-dotnet-receivers/${mode}${suffix}.json`));

/**
 * Keep both source paths, all optional-capability cases and package verification.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Actual package scripts.
 */
export const assertOwnedDotnetReceiverCi = (workflow, manifest) => {
	assertOwnedRubyReceiverCi(workflow, manifest); assertOwnedDotnetBorrowCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-dotnet-receivers"], ownedDotnetReceiverScript);
	const steps = workflow.split("      - name: ").filter(section => section.split("\n").includes("        id: type_corpus_dotnet"));
	assert.equal(steps.length, 1); const [step] = steps;
	assert.match(step, /^ {8}if: matrix\.profile == 'dotnet'$/mu);
	for(const line of [
		"npm run test:owned-dotnet-receivers > build/owned-dotnet-receivers.log 2>&1"
		, "cat build/owned-dotnet-receivers.log"
		, ...["tests 10", "pass 10", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-dotnet-receivers.log`)
		, ...ownedDotnetReceiverReports.map(path => "test -s " + path)
	]) assert.ok(step.split("\n").includes("          " + line), line);
	const upload = workflow.split("      - name: Upload the .NET real-Lean type corpus report\n")[1]?.split("      - name: ")[0];
	assert.match(upload ?? "", /^ {10}if-no-files-found: error$/mu);
	for(const path of ["build/owned-dotnet-receivers/", "build/owned-dotnet-receivers.log"])
		assert.ok(upload.split("\n").includes("            " + path));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-dotnet-receivers"'));
};
