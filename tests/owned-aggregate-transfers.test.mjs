/**
 * Execute atomic transfer of complete input owner batches against compiled Lean.
 * This does not enable transferred declarations in downstream package builders.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedAggregateLeaseSource } from "../src/backends/native/owned-aggregate-leases.mjs";
import { ownedAggregateTransferLeaseSource } from "../src/backends/native/owned-aggregate-transfers.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("transfer transactions preserve the existing non-transfer ledger byte for byte", () => {
	assert.ok(ownedAggregateTransferLeaseSource.startsWith(ownedAggregateLeaseSource));
	const added = ownedAggregateTransferLeaseSource.slice(ownedAggregateLeaseSource.length);
	assert.doesNotMatch(added, /LB_OWNED_ALLOC\(|LB_OWNED_FREE\(|lean_(?:inc|dec)\(/u);
	assert.match(added, /lb_owned_scope_transfer_many/u);
});

test("input owner batches move atomically and remain alive through the real Lean call", {
	skip: process.env.LEAN_BRIDGE_OWNED_TRANSFER_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t);
	const symbol = name => compiled.symbols.exports[compiled.model.declarations.find(item => item.name === name).id];
	await saveLakeFile(compiled.directory, "transfer-bindings.h", [
		`#define COMPONENT_ID ${JSON.stringify(compiled.model.component.id)}`
		, `#define COMPONENT_INITIALIZER initialize_${compiled.module}`
		, `#define F_NEW ${symbol("newTicket")}`
		, `#define F_SERIAL ${symbol("serial")}`
		, `#define F_RETAIN ${symbol("retainTicket")}`, ""
	].join("\n"));
	await saveLakeFile(compiled.directory, "owned-transfers.h", ownedAggregateTransferLeaseSource);
	const source = await readFile("tests/fixtures/structured-types/owned-aggregate-transfers.c", "utf8");
	const execute = await compiled.compile("transfers", source);
	const normal = await execute(); assert.equal(normal.stderr, "");
	const result = JSON.parse(normal.stdout);
	assert.ok(result.checks > 8000); assert.equal(result.liveAllocations, 0);
	const sanitized = await compiled.compile("transfers-sanitized", source, true);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.deepEqual(JSON.parse(exercised.stdout), result);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	const mutations = [
		{ name: "wrong-input-owner"
			, before: "entry->owner->token == token && !strcmp(entry->owner->kind, kind)"
			, after: "entry->owner->token == token || !strcmp(entry->owner->kind, kind)" }
		, { name: "duplicate-input"
			, before: "if (batches[i] == batches[j]) return LB_OWNED_INVALID;"
			, after: "if (0 && batches[i] == batches[j]) return LB_OWNED_INVALID;" }
		, { name: "missing-input-retention"
			, before: "last->next = scope->inputs; scope->inputs = batch->entries;"
			, after: "last->next = scope->inputs;" }
		, { name: "missing-moved-state"
			, before: "*batch = (lb_owned_batch){0};\n  }\n  scope->retained"
			, after: "/* missing move */\n  }\n  scope->retained" }
		, { name: "unbounded-transfer"
			, before: "if (retained >= LB_OWNED_RETAINED_LIMIT - scope->retained) return LB_OWNED_LIMIT;"
			, after: "if (0 && retained >= LB_OWNED_RETAINED_LIMIT - scope->retained) return LB_OWNED_LIMIT;" }
	];
	for(const mutation of mutations)
	{
		assert.ok(ownedAggregateTransferLeaseSource.includes(mutation.before));
		await saveLakeFile(compiled.directory, "owned-transfers.h", ownedAggregateTransferLeaseSource.replace(mutation.before, mutation.after));
		const changed = await compiled.compile(mutation.name, source);
		await assert.rejects(() => changed());
	}
	const report = { ...result
		, realLean: true, allocationFreeCommit: true
		, ownerMembership: true, allocationFreeInputViews: true
		, sanitizer: "address,undefined", leakBaselineUnchanged: true
		, rejectedMutations: mutations.map(item => item.name)
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, ledgerSha256: sha256(ownedAggregateTransferLeaseSource)
		, probeSha256: sha256(source)
		, startupLeakBaseline: normalize(cold.stderr).replaceAll(compiled.directory, "<probe>") };
	await saveLakeFile(resolve("build/owned-transfers"), "native.json", canonicalJson(report));
	t.diagnostic(JSON.stringify(report));
});
