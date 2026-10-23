/**
 * Tests closed repository test-profile classification.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import test from "node:test";

import { classifyRepositoryTest, groupRepositoryTests, repositoryTestProfiles } from "../src/adoption/test-profiles.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { verifyAddedTestRegistrations } from "./helpers/test-registration-history.mjs";

const root = resolve(".");
const visit = async directory => {
	const paths = [];
	for(const entry of await readdir(directory, { withFileTypes: true }))
	{
		const path = resolve(directory, entry.name);
		if(entry.isDirectory()) paths.push(...await visit(path));
		else if(entry.isFile() && entry.name.endsWith(".test.mjs")) paths.push(relative(root, path).replaceAll("\\", "/"));
	}
	return paths;
};

test("every repository test receives exactly one named execution profile", async () => {
	const paths = await visit(resolve(root, "tests"));
	const grouped = groupRepositoryTests(paths);
	assert.deepEqual(repositoryTestProfiles, ["contract", "browser", "performance", "managed", "php", "native", "component", "consumer", "all"]);
	assert.equal(Object.values(grouped).flat().length, paths.length);
	assert.equal(new Set(Object.values(grouped).flat()).size, paths.length);
	assert.ok(grouped.contract.includes("tests/test-profiles.test.mjs"));
	for(const name of ["component-consumer-docs", "consumer-guide-docs", "documentation-demo-api", "lean-author-documentation", "reference-documentation"])
		assert.ok(grouped.contract.includes(`tests/${name}.test.mjs`));
	assert.ok(grouped.native.includes("tests/rust-generator.test.mjs"));
	assert.ok(grouped.contract.includes("tests/perl-contract.test.mjs"));
	assert.ok(grouped.contract.includes("tests/zero-payload-checked-records.test.mjs"));
	for(const name of ["checked-record-value-index-jvm-evidence"
		, "checked-record-value-index-matrix"
		, "checked-record-value-index-matrix-inventory"
		, "checked-record-value-index-native-evidence"
		, "checked-record-value-index-php"
		, "checked-record-value-index-python"
		, "zero-payload-checked-record-browser-evidence"
		, "zero-payload-checked-record-hosted-promotion"
		, "zero-payload-checked-record-native-evidence"
		, "zero-payload-checked-record-native-promotion"
		, "zero-payload-checked-record-dotnet-evidence"
		, "zero-payload-checked-record-dotnet-promotion"
		, "zero-payload-checked-record-jvm-evidence"
		, "zero-payload-checked-record-jvm-promotion"
		, "zero-payload-checked-record-perl"
		, "zero-payload-checked-record-perl-evidence"
		, "zero-payload-checked-record-php-evidence"
		, "zero-payload-checked-record-python-evidence"
		, "zero-payload-checked-record-ruby-evidence"
		, "zero-payload-checked-record-rust-evidence"
		, "zero-payload-checked-record-rust-promotion"
		, "zero-payload-checked-record-wit-evidence"])
		assert.ok(grouped.contract.includes(`tests/${name}.test.mjs`), name);
	for(const name of [
		"dependent-checked-record-browser-foundation"
		, "dependent-checked-record-matrix"
		, "dependent-checked-record-matrix-inventory"
		, "dependent-checked-record-native-foundation"
	]) assert.ok(grouped.contract.includes(`tests/${name}.test.mjs`), name);
	assert.ok(grouped.contract.includes("tests/owned-php-wasm-callback-results.test.mjs"));
	assert.ok(grouped.contract.includes("tests/owned-php-wasm-callback-result-evidence.test.mjs"));
	assert.ok(grouped.contract.includes("tests/callback-subtype-php-wasm.test.mjs"));
	assert.ok(grouped.contract.includes("tests/wit-owned-callback-result-installed-acceptance.test.mjs"));
	assert.ok(grouped.contract.includes("tests/owned-checked-record-javascript-packaging.test.mjs"));
	assert.ok(grouped.contract.includes("tests/owned-checked-record-language-packaging.test.mjs"));
	assert.ok(grouped.contract.includes("tests/owned-checked-record-managed-packaging.test.mjs"));
	assert.ok(grouped.contract.includes("tests/owned-checked-record-native-packaging.test.mjs"));
	assert.ok(grouped.contract.includes("tests/owned-checked-record-perl-packaging.test.mjs"));
	assert.ok(grouped.contract.includes("tests/owned-checked-record-php-wasm-packaging.test.mjs"));
	for(const name of [
		"owned-subtype-host-registration-history"
		, "owned-subtype-javascript-packaging"
		, "owned-subtype-language-packaging"
		, "owned-subtype-native-packaging"
		, "owned-subtype-perl-packaging"
		, "owned-subtype-php-wasm-packaging"
		, "owned-subtype-remaining-packaging"
	]) assert.ok(grouped.contract.includes(`tests/${name}.test.mjs`), name);
	assert.ok(grouped.native.includes("tests/perl-native.test.mjs"));
	assert.ok(grouped.native.includes("tests/lake-workspace.test.mjs"));
	assert.ok(grouped.native.includes("tests/lake-generators.test.mjs"));
	assert.ok(grouped.native.includes("tests/lake-generator-prerequisites.test.mjs"));
	assert.ok(grouped.contract.includes("tests/lake-generator-contract.test.mjs"));
	assert.ok(grouped.component.includes("tests/release-rehearsal.test.mjs"));
	assert.ok(grouped.component.includes("tests/internal/abi/js-pending-operations.test.mjs"));
	assert.ok(grouped.consumer.includes("tests/consumer-node.test.mjs"));
	// Ungated cases run with the component profile; installed native-fin cases stay gated for the c-family shard.
	for(const name of ["native-fin", "component-engine-failure"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "component", name);
});

test("unclassified tests and non-tests are rejected", () => {
	assert.throws(() => classifyRepositoryTest("tests/new-contract.test.mjs"), /Unclassified repository test/);
	assert.throws(() => classifyRepositoryTest("tests/helper.mjs"), /Not a repository test path/);
});

test("missing manifest entries and duplicate discovered paths are rejected", () => {
	assert.throws(() => groupRepositoryTests(["tests/test-profiles.test.mjs"]), /entries do not exist/);
});

test("historical test registration checks permit additions but reject edits and ambiguous lineage", () => {
	const before = '\t\t, "existing"\n', after = before + '\t\t, "new-one"\n', latest = after + '\t\t, "new-two"\n';
	const entry = (before, after, name) => ({ path: "src/adoption/test-profiles.mjs", previousSha256: sha256(before), currentSha256: sha256(after), addedTests: [name] });
	const updates = [entry(before, after, "new-one"), entry(after, latest, "new-two")];
	verifyAddedTestRegistrations(latest, sha256(before), updates);
	verifyAddedTestRegistrations(latest, sha256(after), updates);
	assert.throws(() => verifyAddedTestRegistrations(latest.replace("existing", "edited"), sha256(before), updates), /Missing or ambiguous/);
	assert.throws(() => verifyAddedTestRegistrations(latest, sha256(before), [...updates, updates[1]]), /Missing or ambiguous/);
	assert.throws(() => verifyAddedTestRegistrations(latest, sha256(before), [{ ...updates[1], addedTests: ["new-one"] }]), /changed more/);
	assert.throws(() => verifyAddedTestRegistrations(latest, sha256(before), [{ ...updates[1], addedTests: ["new-two", "new-two"] }]), /equal/);
});
