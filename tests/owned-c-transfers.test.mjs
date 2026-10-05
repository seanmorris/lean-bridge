/**
 * Fresh ordinary/reviewed Lean declarations consumed through the public C ABI.
 * Production package admission remains a separate installed acceptance gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { canonicalizeJsonValue } from "../src/binding-ir/canonical.mjs";
import { validateReviewedOwnedSource, reviewedOwnedSourceSelection } from "../src/analyze/reviewed-owned-source.mjs";
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedTransferReviewedIr, ownedTransferConfiguration, ownedTransferSource } from "./helpers/owned-transfer-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const review = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source)
		, semanticSha256: sha256(canonicalizeJsonValue(document)) };
};
const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");

test("transferred public C parameters require an explicit capability and owner slots", () => {
	const ir = ownedTransferReviewedIr();
	assert.throws(() => generateOwnedCValues(ir), /call-scoped input borrows/u);
	const values = generateOwnedCValues(ir, { hostCallbacks: true, transferredInputs: true });
	assert.deepEqual(values.functions.find(item => item.name === "bundle").transfers, [0, 2]);
	assert.match(values.header, /owned_aggregates_retain_ticket\(owned_aggregates_session \*session, owned_aggregates_ticket_t a0, owned_aggregates_result \*\*a0_owner,/u);
	assert.match(values.header, /A later failure does not restore consumed owners/u);
	assert.equal(values.hostArgument(values.functions.find(item => item.name === "transferCallback"), 0), false);
	const ordinary = ownedAggregateReviewedIr();
	assert.equal(generateOwnedCValues(ordinary, { transferredInputs: true }).header, generateOwnedCValues(ordinary).header);
	for(const mutate of [
		value => { value.declarations.find(item => item.name === "echoRecord").parameters[0].lifetime.anchor = "arg0"; }
		, value => { value.declarations.find(item => item.name === "echoRecord").parameters[0].lifetime.scope = "runtime"; }
		, value => { value.declarations.find(item => item.name === "newTicket").parameters[0].ownership = "transfer"; }
	]) {
		const changed = structuredClone(ir); mutate(changed);
		assert.throws(() => generateOwnedCValues(changed, { transferredInputs: true }));
	}
});

test("ordinary and reviewed transfer choices select identical authenticated contracts", async () => {
	const ir = ownedTransferReviewedIr(), configuration = await ownedTransferConfiguration();
	assert.deepEqual(validateReviewedOwnedSource(review(ir)), ir);
	assert.deepEqual(reviewedOwnedSourceSelection(review(ir)).contracts, configuration.contracts);
	assert.equal(Object.keys(configuration.contracts).length, 18);
});

for(const path of ["ordinary", "reviewed"]) test(`${path} transferred C inputs validate before moving and clean up after real Lean calls`, {
	skip: process.env.LEAN_BRIDGE_OWNED_TRANSFER_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...(path === "ordinary" ? { configuration: await ownedTransferConfiguration() } : { reviewedIr: ownedTransferReviewedIr() })
		, hostCallbacks: true
		, sourceSuffix: ownedTransferSource
		, evidenceName: `transfers-${path}-inputs.json`
	});
	const options = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component
		, hostCallbacks: true
		, transferredInputs: true };
	const generated = generateOwnedCPackage(options);
	assert.throws(() => generateOwnedCPackage({ ...options, transferredInputs: false }), /call-scoped input borrows/u);
	assert.throws(() => generateOwnedCPackage(options, {}), /does not support transferred inputs/u);
	assert.equal(generated.values.functions.filter(item => item.transfers?.length).length, 18);
	const implementation = source => `#include <stddef.h>
extern void *owned_test_allocate(size_t);
extern void owned_test_free(void *);
#define LB_OWNED_ALLOC owned_test_allocate
#define LB_OWNED_FREE owned_test_free
${source}
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
`;
	for(const [name, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, name.startsWith("src/") ? "public-api.c" : name.split("/").at(-1)
			, name.startsWith("src/") ? implementation(source) : source);
	const copy = name => {
		const id = generated.values.functions.find(item => item.name === name).parameters[0];
		return generated.values.copies.find(item => item.id === id).cName;
	};
	await saveLakeFile(compiled.directory, "transfer-copies.h", [
		...[["OPTION", "echoOption"], ["ARRAY", "echoArray"], ["LIST", "echoList"]
			, ["RESULT", "echoResult"], ["TUPLE", "echoTuple"]
			, ["ROW", "echoRow"], ["NESTED", "echoNested"]]
			.map(([macro, name]) => `#define COPY_${macro} ${copy(name)}`)
		, ""
	].join("\n"));
	await saveLakeFile(compiled.directory, "header-check.cpp", '#include "owned_aggregates.h"\nstatic_assert(sizeof(bool) == 1);\n');
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "header-check.cpp"], compiled.directory, { PATH: "/usr/bin:/bin" });
	const source = await readFile("tests/fixtures/structured-types/owned-public-transfers.c", "utf8");
	const execute = await compiled.compile(`${path}-transfers`, source, false, ["public-api.c", "-lgmp"]);
	const normal = await execute(); assert.equal(normal.stderr, "");
	const result = JSON.parse(normal.stdout); t.diagnostic(JSON.stringify(result));
	assert.ok(result.checks > 1000); assert.ok(result.beforeFailures > 0); assert.ok(result.afterFailures > 0);
	assert.equal(result.live, 0); assert.equal(result.identities, 0);
	const sanitized = await compiled.compile(`${path}-transfers-sanitized`, source, true, ["public-api.c", "-lgmp"]);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.deepEqual(JSON.parse(exercised.stdout), result);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	const mutations = path === "ordinary" ? [
		["missing-moved-slot", "*frame->inputs[i].slot = NULL;", "/* missing moved slot */"]
		, ["wrong-owner-membership", "entry->owner->token == token && !strcmp(entry->owner->kind, kind)", "entry->owner->token == token || !strcmp(entry->owner->kind, kind)"]
		, ["leaked-source-payload", "oc_release(result->blocks); LB_OWNED_FREE(result);\n  }\n  return status;", "LB_OWNED_FREE(result);\n  }\n  return status;"]
	] : [];
	for(const [name, before, after] of mutations)
	{
		const ledger = name === "wrong-owner-membership";
		const original = ledger ? generated.files["internal/owned-leases.h"] : generated.source;
		assert.ok(original.includes(before));
		await saveLakeFile(compiled.directory, ledger ? "owned-leases.h" : "public-api.c"
			, ledger ? original.replace(before, after) : implementation(original.replace(before, after)));
		const changed = await compiled.compile(name, source, false, ["public-api.c", "-lgmp"]);
		await assert.rejects(() => changed(), /transfer C check failed/u);
		await saveLakeFile(compiled.directory, ledger ? "owned-leases.h" : "public-api.c", ledger ? original : implementation(original));
	}
	const variant = generated.values.functions.find(item => item.name === "echoVariant");
	const originalCall = `  if (!status) status = ${variant.symbol}(&active->native, &raw0, &transfer, &returned, &result_owner->native);`;
	assert.ok(generated.source.includes(originalCall));
	await saveLakeFile(compiled.directory, "public-api.c", implementation(generated.source.replace(originalCall
		, originalCall + "\n  if (!status) returned.tag = UINT32_MAX;")));
	const malformed = await compiled.compile(`${path}-transfers-malformed`, source, true, ["public-api.c", "-lgmp"]);
	const rejected = await malformed([], { ...environment, LEAN_BRIDGE_OWNED_BAD_REPLY: "1" });
	assert.deepEqual(JSON.parse(rejected.stdout), { badReply: true });
	assert.equal(normalize(rejected.stderr), normalize(cold.stderr));
	await saveLakeFile(resolve("build/owned-transfers"), `${path}-c.json`, canonicalJson({
		result, path, actualLean: true
		, bindingIrSha256: generated.layout.model.bindingIrSha256
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, headerSha256: sha256(generated.publicHeader)
		, sourceSha256: sha256(generated.source)
		, probeSha256: sha256(source)
		, rejectedMutations: mutations.map(item => item[0])
		, malformedResultConsumesInputs: true
		, sanitizer: "address,undefined"
		, startupLeakBaseline: normalize(cold.stderr).replaceAll(compiled.directory, "<probe>")
	}));
});

test("the transfer capability does not change generated code for existing borrowed-input APIs", {
	skip: process.env.LEAN_BRIDGE_OWNED_TRANSFER_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, { hostCallbacks: true, evidenceName: "transfers-unchanged-inputs.json" });
	const options = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true };
	assert.deepEqual(generateOwnedCPackage({ ...options, transferredInputs: true }).files, generateOwnedCPackage(options).files);
});
