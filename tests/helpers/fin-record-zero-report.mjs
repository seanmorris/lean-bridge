/**
 * Validate current installed Fin 0 nominal collection reports before CI archives them.
 * This checks report consistency, not hosted provenance or dispatch measurements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { finRecordZeroChecks, finRecordZeroRefinements, finRecordZeroReviewedIr, finRecordZeroTargets } from "./fin-record-zero-fixture.mjs";

const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", ruby: "rb", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c", perl: "pl" };
const hashes = ["bindingIrSha256", "consumerSha256", "modelSha256", "receiptSha256", "sourceTreeSha256"];
const closed = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
const coordinate = pkg => {
	const name = pkg.ecosystem === "pypi" ? pkg.name.toLowerCase().replaceAll(/[-_.]+/g, "-")
		: ["nuget", "composer", "npm", "cargo"].includes(pkg.ecosystem) ? pkg.name.toLowerCase() : pkg.name;
	return `${pkg.ecosystem}:${name}@${pkg.version}`;
};

/**
 * Reconstruct the original canonical receipt from all selected consumer rows.
 *
 * @param report - Parsed installed report containing every selected package.
 */
export const finRecordZeroReceipt = report => {
	const first = report.reports[0], unique = new Map();
	for(const row of report.reports) for(const pkg of row.packages)
	{
		const key = coordinate(pkg);
		if(unique.has(key)) assert.deepEqual(unique.get(key), pkg, "Shared JVM package rows must agree");
		else unique.set(key, pkg);
	}
	return { schemaVersion: 1, kind: "lean-bridge-package-set-receipt"
		, component: { id: "finrecordzero@1.0.0", name: "finrecordzero", version: "1.0.0" }
		, source: { treeSha256: first.sourceTreeSha256 }
		, profiles: [{ id: "native-library-v1", bindingIrSha256: first.bindingIrSha256, runtimeIdentity: first.packages[0].runtimeIdentity }]
		, packages: [...unique.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, pkg]) => pkg) };
};

/**
 * Require both source routes to report every selected consumer and the exact independent fixture.
 *
 * @param report - Parsed original installed report.
 * @param profiles - Explicit selected host profiles.
 * @param route - Either ordinary-source or reviewed-ir.
 */
export const assertFinRecordZeroReport = async (report, profiles, route) => {
	assert.ok(Array.isArray(profiles) && profiles.length > 0);
	assert.equal(new Set(profiles).size, profiles.length);
	for(const profile of profiles) assert.ok(Object.hasOwn(finRecordZeroTargets, profile), profile);
	assert.ok(["ordinary-source", "reviewed-ir"].includes(route));
	closed(report, ["schemaVersion", "reports", "archives", "reproducible"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(row => row.profile), [...profiles].sort());
	const first = report.reports[0];
	for(const row of report.reports)
	{
		closed(row, ["profile", "path", "checks", "packages", "refinements"
			, "offlineInstall", "compilerFreePath"
			, "sourceRemovedBeforeInstallation", ...hashes
			, ...(route === "reviewed-ir" ? ["reviewedSourceSha256"] : [])]);
		assert.equal(row.path, route); assert.equal(row.checks, finRecordZeroChecks);
		for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(row[flag], true);
		for(const key of hashes) assert.match(row[key], /^[a-f0-9]{64}$/u);
		for(const key of hashes.filter(key => key !== "consumerSha256")) assert.equal(row[key], first[key], key);
		assert.deepEqual(row.refinements, finRecordZeroRefinements);
		assert.equal(row.consumerSha256, sha256(await readFile(`tests/fixtures/fin-record-zero-consumers/${row.profile}.${extensions[row.profile]}`)));
		if(route === "reviewed-ir") assert.equal(row.reviewedSourceSha256, sha256(canonicalJson(finRecordZeroReviewedIr())));
		const [target, identity] = finRecordZeroTargets[row.profile];
		assert.ok(row.packages.length > 0);
		for(const pkg of row.packages) assert.equal(pkg.target, target);
		const components = row.packages.filter(pkg => pkg.role === "component");
		assert.equal(components.length, 1);
		assert.equal(components[0].name, identity.name ?? identity.module.replaceAll("::", "-"));
		assert.equal(components[0].version, identity.version);
	}
	const receipt = finRecordZeroReceipt(report);
	validatePackageSetReceipt(receipt);
	assert.equal(first.receiptSha256, sha256(canonicalJson(receipt)), "Package identities must reconstruct the original receipt digest");
	assert.deepEqual(report.archives, Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
	return true;
};
