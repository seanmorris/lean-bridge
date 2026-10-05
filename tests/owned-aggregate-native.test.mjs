/**
 * Real Lean ownership, typed carriers and independent failure-injection probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedAggregateLeaseSource } from "../src/backends/native/owned-aggregate-leases.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";

const bindings = compiled => {
	const { model, symbols } = compiled;
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const operation = name => model.declarations.find(item => item.name === name);
	const parameter = name => operation(name).parameters[0].type;
	const aliases = { BUNDLE: "lean:Owned.Bundle", PAYLOAD: "lean:Owned.Payload"
		, CHOICE: "lean:Owned.Choice", TREE: "lean:Owned.Tree"
		, ALIAS: "lean:Owned.BundleAlias", ROW: "lean:Owned.TicketRow"
		, TICKETS: parameter("echoArray"), HISTORY: parameter("echoList")
		, OPTIONAL: parameter("echoOption"), RESULT: parameter("echoResult")
		, TUPLE: parameter("echoTuple"), NESTED: parameter("echoNested")
		, RECORD_CALLBACK: operation("callbackRecord").parameters[1].type
		, TREE_CALLBACK: operation("callbackRecursive").parameters[1].type
		, RECORD_CLOSURE: operation("makeRecord").result.type
		, TREE_CLOSURE: operation("makeRecursive").result.type };
	aliases.TREES = nodes.get(aliases.TREE).cases[1].fields[0].type;
	aliases.ROW_ITEMS = nodes.get(aliases.ROW).target;
	aliases.TUPLE_TAIL = nodes.get(aliases.TUPLE).arguments[1];
	aliases.NESTED_LIST = nodes.get(aliases.NESTED).arguments[0];
	aliases.NESTED_OPTION = nodes.get(aliases.NESTED_LIST).arguments[0];
	const lines = [`#define COMPONENT_ID ${JSON.stringify(model.component.id)}`
		, `#define COMPONENT_INITIALIZER initialize_${compiled.module}`];
	for(const [name, id] of Object.entries(aliases))
	{
		const node = nodes.get(id);
		const actions = ["make", "items", "branch", "none", "apply", "field0", "field1"];
		if(node.kind === "record") actions.push(...node.fields.map((_, i) => `field${i}`));
		if(node.kind === "variant") node.cases.forEach((item, i) => {
			actions.push(`make${i}`, ...item.fields.map((_, j) => `case${i}_field${j}`));
		});
		actions.push("make0", "make1");
		for(const action of new Set(actions)) lines.push(`#define ${name}_${action} ${symbols.types[id]}_${action}`);
	}
	for(const operation of model.declarations) lines.push(`#define F_${operation.name} ${symbols.exports[operation.id]}`);
	return lines.join("\n") + "\n";
};

test("CI requires the actual owned native execution and retains its report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const command = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-aggregate-native.test.mjs";
	assert.equal(workflow.split(command).length - 1, 2);
	assert.ok(workflow.includes("test -s build/owned-aggregate-native/transport.json"));
	assert.ok(workflow.includes("            build/owned-aggregate-native/transport.json"));
});

test("owned aggregate carriers preserve identities and release failed native acquisitions", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t);
	assert.equal(compiled.model.declarations.length, 22);
	await saveLakeFile(compiled.directory, "probe-bindings.h", bindings(compiled));
	await saveLakeFile(compiled.directory, "owned-leases.h", ownedAggregateLeaseSource);
	const fixture = resolve("tests/fixtures/structured-types");
	const source = await readFile(`${fixture}/owned-aggregate-carriers.c`, "utf8") + "\n"
		+ await readFile(`${fixture}/owned-aggregate-leases.c`, "utf8");
	const execute = await compiled.compile("probe", source);
	const result = JSON.parse((await execute()).stdout);
	assert.equal(result.exports, 22); assert.equal(result.depth, 128);
	assert.equal(result.liveAllocations, 0); assert.equal(result.liveIdentities, 0);
	assert.ok(result.checks > 20000); assert.ok(result.allocationFailures > 40);
	const sanitized = await compiled.compile("probe-sanitized", source, true);
	// Preserve the unsuppressed Lean/GMP startup report and reject any increase.
	const sanitizerEnvironment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...sanitizerEnvironment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	const exercised = await sanitized([], sanitizerEnvironment);
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr), "Owned values changed the cold-session leak report");
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	const leak = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked in (\d+) allocation\(s\)/u.exec(cold.stderr);
	if(cold.stderr)
	{ assert.ok(leak, cold.stderr); assert.match(cold.stderr, /__gmp_default_allocate/u); }
	assert.deepEqual(JSON.parse(exercised.stdout), result);
	for(const mutation of [
		{ name: "missing-retain"
			, before: "owner->kind = kind; owner->value = value; lean_inc(value);"
			, after: "owner->kind = kind; owner->value = value;" }
		, { name: "missing-release"
			, before: "lean_dec(owner->value); --context->live_owners;"
			, after: "--context->live_owners;" }
		, { name: "missing-rollback"
			, before: "lb_owned_drop(context, entry->owner); LB_OWNED_FREE(entry);"
			, after: "(void)lb_owned_drop; LB_OWNED_FREE(entry);" }
		, { name: "reused-thread"
			, before: " || context->thread_serial != lb_owned_thread_serial"
			, after: "" }
	]) {
		assert.ok(ownedAggregateLeaseSource.includes(mutation.before));
		await saveLakeFile(compiled.directory, "owned-leases.h", ownedAggregateLeaseSource.replace(mutation.before, mutation.after));
		const changed = await compiled.compile(mutation.name, source);
		await assert.rejects(() => changed(), /check failed at/);
	}
	await saveLakeFile(compiled.directory, "owned-leases.h", ownedAggregateLeaseSource);
	const report = { result
		, bindingIrSha256: compiled.model.bindingIrSha256
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, probeSha256: sha256(source)
		, leaseSourceSha256: sha256(ownedAggregateLeaseSource)
		, sanitizer: "address,undefined"
		, startupLeakBaseline: { bytes: Number(leak?.[1] ?? 0)
			, allocations: Number(leak?.[2] ?? 0), unchangedAfterCalls: true
			, report: normalize(cold.stderr).replaceAll(compiled.directory, "<probe>") }
		, rejectedMutations: ["missing-retain", "missing-release", "missing-rollback", "reused-thread"] };
	t.diagnostic(JSON.stringify(report));
	await saveLakeFile(resolve("build/owned-aggregate-native"), "transport.json", canonicalJson(report));
});
