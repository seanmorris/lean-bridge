/**
 * Execute owned native value conversion against fresh compiler-authenticated Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedNativeValueLayout } from "../src/backends/native/owned-value-layout.mjs";
import { generateOwnedNativeValueAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../src/backends/native/owned-aggregate-leases.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned native layouts preserve retained leaves and keep recursive fields finite", () => {
	const ir = ownedAggregateReviewedIr(), before = structuredClone(ir);
	const layout = compileOwnedNativeValueLayout(ir);
	assert.deepEqual(ir, before);
	assert.deepEqual(layout.model.bindingIr, ir);
	assert.equal(layout.functions.length, 22); assert.equal(layout.callbacks.length, 4);
	for(const node of layout.nodes)
		for(const field of [...node.fields, ...node.cases.flatMap(branch => branch.fields)])
			assert.equal(field.pointer, !layout.nodes.find(child => child.id === field.type).leaf);
	assert.deepEqual(layout.aliases.map(alias => [alias.id, alias.target]), [
		["lean:Owned.BundleAlias", "lean:Owned.Bundle"]
		, ["lean:Owned.TicketRow", layout.model.types.find(type => type.id === "lean:Owned.TicketRow").target]
	]);
	assert.equal(layout.nodes.find(node => node.id === "lean:Owned.Ticket").identityKind, "resource:Owned.Ticket");
	const unsupported = structuredClone(ir);
	unsupported.declarations.find(item => item.name === "primary").result = {
		...unsupported.declarations.find(item => item.name === "primary").result
		, ownership: "borrow", lifetime: { scope: "parameter", anchor: "arg0" }
	};
	assert.throws(() => compileOwnedNativeValueLayout(unsupported), /explicit output leases/);
});

const nativeBindings = generated => {
	const { layout, carriers } = generated;
	const nodes = new Map(layout.nodes.map(node => [node.id, node]));
	const fn = name => layout.functions.find(item => item.name === name);
	const param = name => fn(name).parameters[0];
	const names = { Ticket: "lean:Owned.Ticket", Bundle: "lean:Owned.Bundle"
		, Payload: "lean:Owned.Payload", Choice: "lean:Owned.Choice"
		, Tree: "lean:Owned.Tree", Nat: "primitive:nat", Integer: "primitive:int"
		, Text: "primitive:string", Bytes: "primitive:bytes"
		, Tickets: param("echoArray"), History: param("echoList")
		, Optional: param("echoOption"), Result: param("echoResult")
		, Tuple: param("echoTuple"), Row: param("echoRow")
		, Nested: param("echoNested"), RecordClosure: fn("makeRecord").result
		, TreeClosure: fn("makeRecursive").result
		, RecordCallback: fn("callbackRecord").parameters[1]
		, TreeCallback: fn("callbackRecursive").parameters[1] };
	names.Trees = nodes.get(names.Tree).cases[1].fields[0].type;
	names.TupleTail = nodes.get(names.Tuple).fields[1].type;
	names.NestedList = nodes.get(names.Nested).element;
	names.NestedOption = nodes.get(names.NestedList).element;
	const lines = [`#define COMPONENT_ID ${JSON.stringify(layout.model.component.id)}`
		, `#define COMPONENT_INITIALIZER initialize_${carriers.module}`];
	for(const [name, id] of Object.entries(names))
	{
		lines.push(`typedef ${nodes.get(id).cName} ${name};`);
		lines.push(`#define ${name}_in ${nodes.get(id).walker}_in`, `#define ${name}_out ${nodes.get(id).walker}_out`);
	}
	for(const item of layout.functions) lines.push(`#define V_${item.name} ${item.symbol}`);
	for(const name of ["RecordClosure", "TreeClosure", "RecordCallback", "TreeCallback"])
		lines.push(`#define ${name}_apply ${layout.callbacks.find(item => item.id === names[name]).symbol}`);
	for(const name of ["RecordCallback", "TreeCallback"])
		lines.push(`#define ${name}_kind ${JSON.stringify(nodes.get(names[name]).identityKind)}`);
	return lines.join("\n") + "\n";
};

test("CI executes the owned value and scalar probes and retains both reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const command = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-native-values.test.mjs tests/owned-native-scalars.test.mjs";
	assert.ok(workflow.includes("          " + command + "\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && ' + command + '"'));
	for(const name of ["values", "scalars"])
	{
		assert.ok(workflow.includes(`test -s build/owned-aggregate-native/${name}.json`));
		assert.ok(workflow.includes(`            build/owned-aggregate-native/${name}.json\n`));
	}
});

test("owned values round-trip typed native fields with bounded atomic acquisition and cleanup", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t);
	const generated = generateOwnedNativeValueAdapters({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component });
	assert.equal(generated.carriers.leanSource, compiled.leanSource);
	assert.equal(generated.carriers.header, compiled.header);
	await saveLakeFile(compiled.directory, "owned-values.h", generated.typesHeader);
	await saveLakeFile(compiled.directory, "owned-leases.h", ownedAggregateLeaseSource);
	await saveLakeFile(compiled.directory, "owned-values-codec.h", generated.source);
	await saveLakeFile(compiled.directory, "value-bindings.h", nativeBindings(generated));
	const source = await readFile("tests/fixtures/structured-types/owned-native-values.c", "utf8");
	const run = await compiled.compile("native-values", source);
	const normal = await run(); assert.equal(normal.stderr, "");
	const result = JSON.parse(normal.stdout);
	t.diagnostic(JSON.stringify(result));
	assert.ok(result.checks > 1000); assert.ok(result.failures > 20);
	assert.equal(result.faultCases, 5);
	assert.equal(result.live, 0); assert.equal(result.identities, 0);
	const sanitized = await compiled.compile("native-values-sanitized", source, true);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.deepEqual(JSON.parse(exercised.stdout), result);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr), "Owned conversion added allocations to the cold leak report");
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	const leak = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked in (\d+) allocation\(s\)/u.exec(cold.stderr);
	if(cold.stderr)
	{ assert.ok(leak, cold.stderr); assert.match(cold.stderr, /__gmp_default_allocate/u); }
	const mutations = [
		{ name: "missing-arena-release"
			, before: "LB_OWNED_FREE(allocation); allocation = next;"
			, after: "allocation = next;" }
		, { name: "failed-commit-leak"
			, before: "if (owner->batch.context) lb_owned_batch_release(context, &owner->batch);"
			, after: "(void)context;" }
		, { name: "failed-clear-leak"
			, before: "if (owner->batch.context) return status;"
			, after: "if (status) return status;" }
		, { name: "missing-cycle-check"
			, before: "if (budget->path[i].address == value && budget->path[i].type == type) return LB_OWNED_INVALID;"
			, after: "if (0 && budget->path[i].address == value && budget->path[i].type == type) return LB_OWNED_INVALID;" }
	];
	for(const mutation of mutations)
	{
		assert.ok(generated.source.includes(mutation.before));
		await saveLakeFile(compiled.directory, "owned-values-codec.h", generated.source.replace(mutation.before, mutation.after));
		const changed = await compiled.compile(mutation.name, source);
		await assert.rejects(() => changed(), /value check failed at/);
	}
	await saveLakeFile(compiled.directory, "owned-values-codec.h", generated.source);
	const report = { result
		, bindingIrSha256: generated.layout.model.bindingIrSha256
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, adapterSha256: sha256(generated.source), probeSha256: sha256(source)
		, rejectedMutations: mutations.map(mutation => mutation.name)
		, startupLeakBaseline: { bytes: Number(leak?.[1] ?? 0)
			, allocations: Number(leak?.[2] ?? 0), unchangedAfterCalls: true
			, report: normalize(cold.stderr).replaceAll(compiled.directory, "<probe>") } };
	t.diagnostic(JSON.stringify(report));
	await saveLakeFile(resolve("build/owned-aggregate-native"), "values.json", canonicalJson(report));
});
