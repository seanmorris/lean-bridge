/**
 * Verify paired installed C/C++ alias reports and reconstruct their package receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { finRecordRefinements } from "./fin-record-install.mjs";
import { finRecordReviewedIr } from "./reviewed-fin-record-fixture.mjs";

/** Reconstruct the explicit alias decisions independently of the producer helper. */
export const finRecordAliasReview = () => {
	const ir = finRecordReviewedIr();
	const rename = type => type.kind === "named" && ["lean:FinRecords.Tile", "lean:FinRecords.Shape"].includes(type.id)
		? { ...type, id: `${type.id}Name` }
		: type.kind === "apply" ? { ...type, arguments: type.arguments.map(rename) } : type;
	for(const declaration of ir.declarations)
	{
		declaration.parameters.forEach(parameter => { parameter.type = rename(parameter.type); });
		declaration.result.type = rename(declaration.result.type);
	}
	for(const name of ["Tile", "Shape"])
	{
		const id = `lean:FinRecords.${name}`, original = ir.types.find(type => type.id === id);
		ir.types.push({ ...structuredClone(original)
			, id: `${id}Name`, name: `${name}Name`
			, kind: "alias", fields: [], cases: [], target: { kind: "named", id }
			, source: { ...original.source, declaration: `FinRecords.${name}Name`, extensions: {} } });
	}
	return ir;
};

/**
 * Validate one original report against pinned caller bytes and independent alias decisions.
 *
 * @param report - Parsed report emitted only after two successful builds.
 * @param route - Either ordinary-source or reviewed-ir.
 * @param sources - Original producer source hashes authenticated by the archive.
 */
export const assertFinRecordAliasReport = (report, route, sources) => {
	assert.ok(["ordinary-source", "reviewed-ir"].includes(route));
	assert.deepEqual(Object.keys(report).sort(), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(row => row.profile), ["c", "cpp"]);
	const hashes = ["bindingIrSha256", "consumerSha256", "modelSha256", "receiptSha256", "sourceTreeSha256"];
	const first = report.reports[0], packages = [];
	for(const row of report.reports)
	{
		const keys = ["profile", "path", "checks", "packages", "refinements"
			, "offlineInstall", "compilerFreePath"
			, "sourceRemovedBeforeInstallation", ...hashes
			, ...(route === "reviewed-ir" ? ["reviewedSourceSha256"] : [])
		];
		assert.deepEqual(Object.keys(row).sort(), keys.sort());
		assert.equal(row.path, route);
		assert.equal(row.checks, row.profile === "c" ? 2064 : 2053);
		for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"]) assert.equal(row[flag], true);
		for(const key of hashes) assert.match(row[key], /^[a-f0-9]{64}$/u);
		for(const key of hashes.filter(key => key !== "consumerSha256")) assert.equal(row[key], first[key]);
		assert.equal(row.consumerSha256, sources[`tests/fixtures/fin-record-consumers/${row.profile}.${row.profile}`]);
		assert.deepEqual(row.refinements, finRecordRefinements);
		if(route === "reviewed-ir") assert.equal(row.reviewedSourceSha256, sha256(canonicalJson(finRecordAliasReview())));
		assert.equal(row.packages.length, 1);
		assert.equal(row.packages[0].target, row.profile);
		assert.equal(row.packages[0].role, "component");
		assert.equal(row.packages[0].name, "finrecords"); assert.equal(row.packages[0].version, "1.0.0");
		packages.push(...row.packages);
	}
	const coordinate = pkg => `${pkg.ecosystem}:${pkg.name}@${pkg.version}`;
	packages.sort((a, b) => coordinate(a) < coordinate(b) ? -1 : coordinate(a) > coordinate(b) ? 1 : 0);
	const receipt = { schemaVersion: 1, kind: "lean-bridge-package-set-receipt"
		, component: { id: "finrecords@1.0.0", name: "finrecords", version: "1.0.0" }
		, source: { treeSha256: first.sourceTreeSha256 }
		, profiles: [{ id: "native-library-v1", bindingIrSha256: first.bindingIrSha256, runtimeIdentity: first.packages[0].runtimeIdentity }]
		, packages };
	validatePackageSetReceipt(receipt);
	assert.equal(first.receiptSha256, sha256(canonicalJson(receipt)));
	assert.deepEqual(report.archives, Object.fromEntries(packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
};
