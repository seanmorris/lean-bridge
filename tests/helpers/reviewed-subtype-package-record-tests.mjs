/**
 * Preserve existing installed callers while retaining complete original package records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import "./reviewed-subtype-package-record-history-tests.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { createReviewedSubtypePackageRecords, retainReviewedSubtypeFiles } from "./reviewed-subtype-package-records.mjs";
import { reviewedSubtypeNpmCaller, reviewedSubtypeNpmTypescript, reviewedSubtypePackageChecks, reviewedSubtypePackageTestNames } from "./reviewed-subtype-package-fixture.mjs";

test("reviewed package records keep original bytes, refuse stale output and preserve partial failures", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-package-records-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const prior = process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_PACKAGE_RECORDS;
	delete process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_PACKAGE_RECORDS;
	t.after(() => {
		if(prior === undefined) delete process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_PACKAGE_RECORDS;
		else process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_PACKAGE_RECORDS = prior;
	});
	const path = join(directory, "output/report.json"), root = await createReviewedSubtypePackageRecords(path);
	assert.equal(root, path + ".records");
	const original = Buffer.from("{\n  \"original\": true\n}\n");
	await saveLakeFile(directory, "input.json", original);
	await retainReviewedSubtypeFiles(root, "build-0", directory, { "model.json": "input.json" });
	assert.deepEqual(await readFile(join(root, "build-0/model.json")), original);
	await assert.rejects(createReviewedSubtypePackageRecords(path), { code: "EEXIST" });
	assert.deepEqual(await readFile(join(root, "build-0/model.json")), original);
	await assert.rejects(retainReviewedSubtypeFiles(root, "build-1", directory, { "model.json": "input.json", "receipt.json": "missing.json" }), { code: "ENOENT" });
	assert.deepEqual(await readFile(join(root, "build-1/model.json")), original);
	for(const prefix of ["..", "build-2", "../outside", "build-0/nested"])
		await assert.rejects(retainReviewedSubtypeFiles(root, prefix, directory, { "value.json": "input.json" }));
	for(const files of [{ "../outside": "input.json" }, { ".": "input.json" }, { "value.json": "../input.json" }, { "value.json": "/input.json" }])
		await assert.rejects(retainReviewedSubtypeFiles(root, "", directory, files));
	process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_PACKAGE_RECORDS = join(directory, "selected/records");
	assert.equal(await createReviewedSubtypePackageRecords(path), join(directory, "selected/records"));
});

test("reviewed npm callers retain the original installed source identities and strict TypeScript contract", async () => {
	const archived = JSON.parse(await readFile("docs/evidence/reviewed-subtype-20261008/npm.json"));
	assert.equal(sha256(reviewedSubtypeNpmCaller), archived.consumerSha256);
	assert.equal(sha256(reviewedSubtypeNpmTypescript), archived.typescript.sourceSha256);
	assert.deepEqual(reviewedSubtypePackageChecks, { c: 2033, cpp: 2026, npm: 2036 });
	const native = await readFile("tests/reviewed-subtype-installed.test.mjs", "utf8");
	const npm = await readFile("tests/helpers/reviewed-subtype-npm-tests.mjs", "utf8");
	assert.ok(native.includes(reviewedSubtypePackageTestNames["c-cpp"]));
	assert.ok(npm.includes(reviewedSubtypePackageTestNames.npm));
	assert.ok(native.includes("expectedChecks: reviewedSubtypePackageChecks[profile]"));
	assert.ok(native.includes('"package-set-receipt.json": "package-set-receipt.json"'));
	assert.ok(native.includes('`consumer.${profile}`'));
	for(const name of ["binding-ir.json", "compiler-adapters.json", "component-build-plan.json", "component-release-bundle.json", "component-package-receipt.json", "provenance.json", "runtime-requirement.json", "index.mjs", "index.mts", "index.d.ts", "check.mjs"])
		assert.ok(npm.includes(`"${name}"`), name);
	assert.ok(npm.includes('"--strict", "--noEmit", "--skipLibCheck", "false"'));
});
