/**
 * Keep public owned WIT execution source-bound without promoting installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedWitPackage, ownedWitPackageHistoricalBytes } from "./helpers/wit-owned-package-history.mjs";
import { assertOwnedWitSessionCi, assertOwnedWitSessionExecution } from "./helpers/wit-owned-session-evidence.mjs";
import { beforeOwnedWitSession, ownedWitSessionAddedPaths
	, ownedWitSessionBaseline, ownedWitSessionChangedPaths, ownedWitSessionPath
	, ownedWitSessionPrevious, reverseOwnedWitSessionUpdate } from "./helpers/wit-owned-session-history.mjs";

const read = async () => JSON.parse(await readFile(ownedWitSessionPath, "utf8"));

test("owned WIT public session successor authenticates all sources and preserves installed classifications", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-session");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedWitSessionBaseline);
	assert.deepEqual(record.previous, ownedWitSessionPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedWitSessionAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedWitPackageHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitSessionChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = beforeOwnedWitPackage(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(beforeOwnedWitSession(update.path, current)), update.previousSha256);
		assert.equal(beforeOwnedWitSession(update.path, current, update.currentSha256), current);
	}
	const current = beforeOwnedWitPackage("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"));
	const prior = JSON.parse(beforeOwnedWitSession("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedWitPackageHistoricalBytes(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), prior, "A session probe cannot establish installed package support");
});

test("owned WIT public session history rejects unknown text, forged ancestors and overlapping edits", async () => {
	for(const update of (await read()).updates)
	{
		const current = beforeOwnedWitPackage(update.path, await readFile(update.path, "utf8")), unknown = current + "\n/* unrelated */\n";
		assert.equal(beforeOwnedWitSession(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedWitSessionUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unrecorded.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedWitSessionUpdate(current, changed));
	}
});

test("owned WIT public session evidence requires both compiled source paths and zero skipped checks", async () => {
	assertOwnedWitSessionExecution(await read());
});

test("owned WIT public session evidence rejects leaks, omitted probes and unsupported claims", async () => {
	const original = await read();
	const rewrite = (record, before, after) => {
		assert.ok(record.runs.sessions.text.includes(before));
		record.runs.sessions.text = record.runs.sessions.text.replaceAll(before, after);
		record.runs.sessions.sha256 = sha256(record.runs.sessions.text);
	};
	for(const mutate of [
		...["installedPackages", "transferredInputs", "anchoredBorrowedResults", "retainedHostCallbacks"]
			.map(key => record => { record.scope[key] = true; })
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { record.runs.sessions.exitCode = 1; }
		, record => { record.runs.sessions.text += "unrecorded"; }
		, record => { record.runs.nativeRegression.text += "unrecorded"; }
		, record => rewrite(record, "# skipped 0", "# skipped 1")
		, record => rewrite(record, '"reviewed":true', '"reviewed":false')
		, record => rewrite(record, '"identities":0', '"identities":1')
		, record => rewrite(record, '"live":0', '"live":1')
		, record => rewrite(record, '"failures":1204', '"failures":0')
		, record => rewrite(record, '"nativeImports":3932', '"nativeImports":3931')
		, record => rewrite(record, '"primitives":19', '"primitives":18')
		, record => rewrite(record, "rejected mutation: missing-independent-result-owner", "")
		, record => rewrite(record, "rejected mutation: missing-store-lease-cleanup", "")
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => assertOwnedWitSessionExecution(changed), undefined, mutate.toString());
	}
});

test("owned WIT public session CI executes enabled probes and retains the complete log", async () => {
	assertOwnedWitSessionCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("owned WIT public session CI rejects hidden failures and disabled or missing checks", async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const execute = "      - name: Execute owned WIT public sessions and host callbacks\n";
	for(const [before, after] of [
		...["LEAN_BRIDGE_WIT_OWNED_SESSION_TEST"]
			.map(name => [`          ${name}: "1"`, `          ${name}: "0"`])
		, ...["tests/wit-owned-session.test.mjs"].map(path => [path, ""])
		, ["  wasi-consumer:\n", "  wasi-consumer:\n    if: false\n"]
		, [execute, execute + "        if: false\n"]
		, [execute, execute + "        continue-on-error: true\n"]
		, ["tee build/wit-owned-session.log\n", "tee build/wit-owned-session.log || true\n"]
		, ...["pass 7", "fail 0", "skipped 0"].map(value => [`          rg '^# ${value}$' build/wit-owned-session.log\n`, ""])
		, ["          path: build/wit-owned-session.log\n", ""]
		, ["      - name: Preserve owned WIT public session execution\n        if: always()", "      - name: Preserve owned WIT public session execution\n        if: false"]
		, ["steps.owned_wit_session.outcome != 'success'", "false"]
		, ["      - wasi-consumer\n", ""]
	]) {
		const changed = source.replace(before, after); assert.notEqual(changed, source);
		assert.throws(() => assertOwnedWitSessionCi(changed), before);
	}
});
