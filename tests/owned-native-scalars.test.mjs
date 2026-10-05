/**
 * Independent Lean and C oracles for every primitive inside an owned record.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../src/backends/native/owned-aggregate-leases.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const bindings = generated => {
	const { layout, carriers } = generated;
	const nodes = new Map(layout.nodes.map(node => [node.id, node]));
	const names = { Ticket: "lean:Owned.Ticket", Packet: "lean:Owned.Packet"
		, Scalars: "lean:Owned.Scalars", Empty: "lean:Owned.Empty"
		, Nat: "primitive:nat", Text: "primitive:string"
		, Units: layout.functions.find(item => item.name === "units").result };
	names.OuterOption = nodes.get(names.Packet).fields[2].type;
	names.InnerOption = nodes.get(names.OuterOption).fields[0].type;
	assert.equal(nodes.get(names.Scalars).fields.length, 19);
	assert.equal(new Set(nodes.get(names.Scalars).fields.map(field => field.type)).size, 19);
	const lines = [`#define COMPONENT_ID ${JSON.stringify(layout.model.component.id)}`
		, `#define COMPONENT_INITIALIZER initialize_${carriers.module}`];
	for(const [name, id] of Object.entries(names)) lines.push(`typedef ${nodes.get(id).cName} ${name};`);
	for(const [prefix, name] of [["S", "Scalars"], ["P", "Packet"]])
		for(const field of nodes.get(names[name]).fields) lines.push(`#define ${prefix}_${field.sourceName} ${field.name}`);
	for(const item of layout.functions) lines.push(`#define V_${item.name} ${item.symbol}`
		, `#define C_${item.name} ${carriers.symbols.exports[item.id]}`);
	return lines.join("\n") + "\n";
};

test("owned packets preserve all primitives, nested optional units and cumulative list bounds", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, { fixture: "owned-scalars", witness: "import Owned\n" });
	const generated = generateOwnedNativeValueAdapters({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component });
	assert.equal(generated.carriers.leanSource, compiled.leanSource);
	await saveLakeFile(compiled.directory, "owned-values.h", generated.typesHeader);
	await saveLakeFile(compiled.directory, "owned-leases.h", ownedAggregateLeaseSource);
	await saveLakeFile(compiled.directory, "owned-values-codec.h", generated.source);
	await saveLakeFile(compiled.directory, "scalar-bindings.h", bindings(generated));
	const source = await readFile("tests/fixtures/structured-types/owned-native-scalars.c", "utf8");
	const run = await compiled.compile("native-scalars", source);
	const normal = await run(); assert.equal(normal.stderr, "");
	const result = JSON.parse(normal.stdout); t.diagnostic(JSON.stringify(result));
	assert.ok(result.checks > 100); assert.ok(result.failures > 5);
	assert.equal(result.live, 0); assert.equal(result.identities, 0);
	const sanitized = await compiled.compile("native-scalars-sanitized", source, true);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const direct = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_LEAN_ONLY: "1" });
	const repeated = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_LEAN_ONLY: "100" });
	const exercised = await sanitized([], environment);
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.deepEqual(JSON.parse(direct.stdout), { direct: true });
	assert.deepEqual(JSON.parse(repeated.stdout), { direct: true });
	assert.deepEqual(JSON.parse(exercised.stdout), result);
	assert.equal(normalize(direct.stderr), normalize(repeated.stderr), "Direct Lean calls added per-call leaks");
	assert.equal(normalize(exercised.stderr), normalize(direct.stderr), "Scalar conversion added allocations beyond direct Lean calls");
	const leakReport = result => {
		assert.doesNotMatch(result.stderr, /ERROR: AddressSanitizer|runtime error:/u);
		const leak = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked in (\d+) allocation\(s\)/u.exec(result.stderr);
		if(result.stderr)
		{ assert.ok(leak, result.stderr); assert.match(result.stderr, /__gmp_default_allocate/u); }
		return { bytes: Number(leak?.[1] ?? 0), allocations: Number(leak?.[2] ?? 0)
			, report: normalize(result.stderr).replaceAll(compiled.directory, "<probe>") };
	};
	const report = { result, primitives: 19
		, bindingIrSha256: generated.layout.model.bindingIrSha256
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, adapterSha256: sha256(generated.source), probeSha256: sha256(source)
		, startupLeakBaseline: leakReport(cold)
		, directLeanLeakBaseline: { ...leakReport(direct)
			, repetitions: [1, 100], unchangedAfterCalls: true } };
	t.diagnostic(JSON.stringify(report));
	await saveLakeFile(resolve("build/owned-aggregate-native"), "scalars.json", canonicalJson(report));
});
