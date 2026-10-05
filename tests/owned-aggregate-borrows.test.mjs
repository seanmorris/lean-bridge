/**
 * Check bounded, owner-anchored lifetime trees against real Lean resources.
 * No downstream builder admits borrowed results until its public adapter exists.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedAggregateLeaseSource, ownedAggregateLeaseRuntime } from "../src/backends/native/owned-aggregate-leases.mjs";
import { ownedAggregateTransferLeaseSource, ownedAggregateTransferRuntime } from "../src/backends/native/owned-aggregate-transfers.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owner-anchored lifetimes require an explicit runtime capability", () => {
	assert.equal(ownedAggregateLeaseRuntime(), ownedAggregateLeaseSource);
	assert.equal(ownedAggregateTransferRuntime(), ownedAggregateTransferLeaseSource);
	assert.doesNotMatch(ownedAggregateLeaseSource, /lb_owned_scope_commit_borrow|lb_owned_batch_expire_children/u);
	assert.match(ownedAggregateTransferRuntime({ anchoredResults: true }), /lb_owned_scope_commit_borrow/u);
});

test("borrowed result trees expire with their exact owner without breaking retained aliases", {
	skip: process.env.LEAN_BRIDGE_OWNED_BORROW_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t);
	const symbol = name => compiled.symbols.exports[compiled.model.declarations.find(item => item.name === name).id];
	const bindings = [
		`#define COMPONENT_ID ${JSON.stringify(compiled.model.component.id)}`
		, `#define COMPONENT_INITIALIZER initialize_${compiled.module}`
		, `#define F_NEW ${symbol("newTicket")}`
		, `#define F_SERIAL ${symbol("serial")}`
		, `#define F_RETAIN ${symbol("retainTicket")}`, ""
	].join("\n");
	await saveLakeFile(compiled.directory, "borrow-bindings.h", bindings);
	const ledger = ownedAggregateTransferRuntime({ anchoredResults: true });
	await saveLakeFile(compiled.directory, "owned-borrows.h", ledger);
	const source = await readFile("tests/fixtures/structured-types/owned-aggregate-borrows.c", "utf8");
	const execute = await compiled.compile("borrows", source);
	const normal = await execute(); assert.equal(normal.stderr, "");
	const result = JSON.parse(normal.stdout);
	assert.ok(result.checks > 1000); assert.equal(result.liveAllocations, 0);
	const sanitized = await compiled.compile("borrows-sanitized", source, true);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.deepEqual(JSON.parse(exercised.stdout), result);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	/* Existing transfer behavior also executes against the extended ledger. */
	await saveLakeFile(compiled.directory, "transfer-bindings.h", bindings);
	await saveLakeFile(compiled.directory, "owned-transfers.h", ledger);
	const transfers = await compiled.compile("borrow-transfer-regression", await readFile("tests/fixtures/structured-types/owned-aggregate-transfers.c", "utf8"));
	const regression = await transfers(); assert.equal(regression.stderr, "");
	assert.ok(JSON.parse(regression.stdout).checks > 8000);
	const mutations = [
		{ name: "missing-owner-generation", before: "batch->generation != generation", after: "generation == 0" }
		, { name: "expired-view-revived", before: " || batch->expired) continue;", after: ") continue;" }
		, { name: "retained-alias-substitution"
			, before: "  if (!batch) return LB_OWNED_INVALID;\n  for (lb_owned_entry *entry = batch->entries; entry; entry = entry->next) {"
			, after: "  if (!batch) return LB_OWNED_INVALID;\n  return lb_owned_scope_borrow(scope, kind, token, out);\n  for (lb_owned_entry *entry = batch->entries; entry; entry = entry->next) {" }
		, { name: "missing-transfer-expiration", before: "    lb_owned_batch_move_children(scope, batch);\n    lb_owned_batch **position", after: "    lb_owned_batch **position" }
		, { name: "early-descendant-destruction", before: "    lb_owned_batch_move_children(scope, batch);", after: "    lb_owned_batch_expire_children(context, batch);" }
		, { name: "disposal-reentry", before: "if (!registered || registered->expired) return NULL;", after: "if (!registered || registered->expired) return batch;" }
		, { name: "missing-input-pin"
			, before: "status = lb_owned_scope_hold(scope, kind, entry->owner->value, entry->owner, 1, &retained);"
			, after: "status = lb_owned_scope_hold(scope, kind, entry->owner->value, entry->owner, 0, &retained);" }
	];
	for(const mutation of mutations)
	{
		assert.ok(ledger.includes(mutation.before));
		await saveLakeFile(compiled.directory, "owned-borrows.h", ledger.replace(mutation.before, mutation.after));
		const changed = await compiled.compile(mutation.name, source);
		await assert.rejects(() => changed(), undefined, mutation.name);
	}
	const report = { ...result, realLean: true, ownerGenerations: true
		, borrowedDepth: 128
		, originalTransferChecks: JSON.parse(regression.stdout).checks
		, sanitizer: "address,undefined", leakBaselineUnchanged: true
		, rejectedMutations: mutations.map(item => item.name)
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, ledgerSha256: sha256(ledger), probeSha256: sha256(source)
		, startupLeakBaseline: normalize(cold.stderr).replaceAll(compiled.directory, "<probe>") };
	await saveLakeFile(resolve("build/owned-borrows"), "native.json", canonicalJson(report));
	t.diagnostic(JSON.stringify(report));
});
