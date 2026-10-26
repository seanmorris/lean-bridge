/**
 * Check the semantic join between immutable consumers and hosted execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	auditOwnedCheckedRecordConsumerSource
	, auditOwnedCheckedRecordSemanticMatrix
} from "./owned-checked-record-semantic-audit.mjs";

const full = `
echoBooking(); echoClaims(); echoClaims(); echoClaims(); echoClaims();
pairClaim(); transferClaim(); transferClaim();
transferPairClaim(); transferPairClaim();
transferWithClaimCallback(); transferWithClaimCallback();
withClaimCallback(); withClaimCallback(); withClaimCallback();
claimClosure(); retain(); claimFor(); close();
`;
const resultOnly = "newTicket(); claimFor(); close();";

test("owned checked-record semantic source contract separates full and result-only APIs", () => {
	const acceptedFull = auditOwnedCheckedRecordConsumerSource(full
		, { label: "fixture/full", resultOnly: false });
	assert.equal(acceptedFull.operations.echoClaims, 4);
	assert.equal(acceptedFull.operations.transferPairClaim, 2);
	const acceptedResult = auditOwnedCheckedRecordConsumerSource(resultOnly
		, { label: "fixture/result-only", resultOnly: true });
	assert.equal(acceptedResult.operations.claimFor, 1);
	assert.equal(acceptedResult.operations.transferClaim, 0);
	assert.throws(() => auditOwnedCheckedRecordConsumerSource(
		full.replaceAll("echoClaims();", "")
		, { label: "fixture/missing-array", resultOnly: false }), /echoClaims/u);
	assert.throws(() => auditOwnedCheckedRecordConsumerSource(
		`${resultOnly} transferClaim();`
		, { label: "fixture/widened-result", resultOnly: true }), /exposes transferClaim/u);
});

test("owned checked-record semantic audit binds all aligned sources and executions", () => {
	const audit = auditOwnedCheckedRecordSemanticMatrix();
	assert.equal(audit.kind, "owned-checked-record-semantic-audit-v1");
	assert.deepEqual(audit.coverage, { lanes: 11, profiles: 17, routes: 44
		, consumerSources: 25, executedCells: 52 });
	assert.deepEqual(audit.lanes.map(lane => lane.lane), [
		"native", "perl", "python", "ruby", "rust", "dotnet", "jvm"
		, "php", "wit", "javascript", "php-wasm"
	]);
	for(const lane of audit.lanes)
	{
		assert.equal(lane.routes.length, 4, lane.lane);
		assert.ok(lane.sources.length > 0, lane.lane);
		for(const route of lane.routes)
			for(const result of Object.values(route.profiles))
				assert.ok(result.checks > 0 && result.executions > 0
					, `${lane.lane}/${route.route}`);
	}
});

test("owned checked-record semantic audit rejects changed retained bytes", () => {
	const readGit = (revision, path) => {
		const bytes = execFileSync("git", ["show", `${revision}:${path}`]
			, { maxBuffer: 64 * 1024 ** 2 });
		return path.endsWith("sources/consumer/tests/fixtures/structured-types/"
			+ "owned-checked-record-installed.c") ? Buffer.concat([bytes, Buffer.from("x")])
			: bytes;
	};
	assert.throws(() => auditOwnedCheckedRecordSemanticMatrix({ readGit })
		, /native: .* bytes/u);
});

test("owned checked-record semantic receipt is the exact current audit", async () => {
	const path = "docs/evidence/owned-checked-record-semantic-audit-20261026.json";
	const bytes = await readFile(path);
	const receipt = JSON.parse(bytes);
	assert.equal(bytes.toString("utf8"), canonicalJson(receipt));
	assert.deepEqual(receipt, auditOwnedCheckedRecordSemanticMatrix());
});
