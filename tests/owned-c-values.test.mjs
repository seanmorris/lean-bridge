/**
 * Compile an independent C consumer using only the public ownership-aware API.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const prepare = async (t, options = {}) => {
	const compiled = await compileOwnedAggregateFixture(t, options);
	const generated = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component });
	let direct = "";
	if(options.fixture === "owned-scalars")
	{
		const symbol = name => generated.carriers.symbols.exports[generated.layout.functions.find(item => item.name === name).id];
		direct = `void owned_test_direct(unsigned count) {
  if (!lean_bridge_native_component_initialize(${JSON.stringify(compiled.model.component.id)}, oc_initialize)) abort();
  for (unsigned i = 0; i < count; ++i) {
    lean_object *ticket = ${symbol("newTicket")}(ov_carry(lean_box(42)), ov_carry(lean_mk_string("ticket")));
    lean_object *packet = ${symbol("makePacket")}(ticket);
    lean_object *correct = ${symbol("inspect")}(packet);
    if (!ov_carrier(correct) || lean_unbox(lean_array_get_core(correct, 0)) != 1) abort();
    lean_dec(correct);
  }
}
`;
	}
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
void owned_test_retire(void) { lean_bridge_native_runtime_retire(); }
${direct}`;
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation(source) : source);
	return { compiled, generated, implementation };
};

const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");

test("owned C values retain semantic names and hide native identity/tag storage", () => {
	const ir = ownedAggregateReviewedIr(), before = structuredClone(ir);
	const values = generateOwnedCValues(ir);
	assert.deepEqual(ir, before);
	assert.equal(values.functions.length, 22); assert.equal(values.callbacks.length, 4);
	assert.equal(values.retains.length, 5);
	assert.match(values.header, /owned_aggregates_ticket_t primary;/u);
	assert.match(values.header, /mpz_srcptr count;/u);
	assert.match(values.header, /bool has_value;/u); assert.match(values.header, /bool is_ok;/u);
	assert.match(values.header, /OWNED_AGGREGATES_CHOICE_T_KIND_PAIR/u);
	assert.match(values.header, /owned_aggregates_make_record_result_t_call/u);
	assert.doesNotMatch(values.header, /lbov_|lean_object|uint64_t token|\bf\d+;|uint32_t tag|cases\.c\d+/u);
	assert.deepEqual(values.native.model.bindingIr, ir);
	const collision = structuredClone(ir); collision.declarations[0].name = "sessionOpen";
	assert.throws(() => generateOwnedCValues(collision), /identifier collision/u);
	const fields = structuredClone(ir);
	fields.types.find(type => type.name === "Bundle").fields[1].name = "primary";
	assert.throws(() => generateOwnedCValues(fields), /duplicate/u);
});

test("owned C anonymous aliases remain finite across shared type diamonds", () => {
	const ir = ownedAggregateReviewedIr(), template = ir.types.find(type => type.name === "TicketRow");
	let target = { kind: "named", id: "lean:Owned.Ticket" };
	for(let i = 0; i < 24; ++i)
	{
		const id = `lean:Owned.Diamond${i}`;
		ir.types.push({ ...template, id, name: `Diamond${i}`, target: { kind: "apply", constructor: "tuple", arguments: [target, target] } });
		target = { kind: "named", id };
	}
	const declaration = ir.declarations.find(item => item.name === "echoRow");
	declaration.parameters[0].type = target; declaration.result.type = target;
	const values = generateOwnedCValues(ir);
	assert.ok(values.aliases.length < 200); assert.ok(values.header.length < 100000);
});

test("CI runs public C execution and retains both consumer reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const command = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-c-values.test.mjs";
	assert.ok(workflow.includes("          " + command + "\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && ' + command + '"'));
	for(const name of ["public-c", "public-c-scalars"])
	{
		assert.ok(workflow.includes(`test -s build/owned-aggregate-native/${name}.json`));
		assert.ok(workflow.includes(`            build/owned-aggregate-native/${name}.json\n`));
	}
});

test("public C owned values execute separately compiled semantic consumers with atomic cleanup", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const { compiled, generated, implementation } = await prepare(t);
	await saveLakeFile(compiled.directory, "header-check.cpp", '#include "owned_aggregates.h"\nstatic_assert(sizeof(bool) == 1);\n');
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "header-check.cpp"], compiled.directory, { PATH: "/usr/bin:/bin" });
	const source = await readFile("tests/fixtures/structured-types/owned-public-values.c", "utf8");
	const run = await compiled.compile("public-values", source, false, ["public-api.c", "-lgmp"]);
	const normal = await run(); assert.equal(normal.stderr, "");
	const result = JSON.parse(normal.stdout); t.diagnostic(JSON.stringify(result));
	assert.ok(result.checks > 100); assert.ok(result.failures > 10);
	assert.equal(result.live, 0); assert.equal(result.identities, 0);
	const sanitized = await compiled.compile("public-values-sanitized", source, true, ["public-api.c", "-lgmp"]);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.deepEqual(JSON.parse(exercised.stdout), result);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr), "Public C conversion added allocations to the cold leak report");
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	const mutations = [
		["public-arena-leak", "oc_release(result->blocks); LB_OWNED_FREE(result);", "LB_OWNED_FREE(result);"]
		, ["public-native-leak", "int status = ov_owner_clear(&result->native);", "int status = LB_OWNED_OK;"]
		, ["public-failed-result-leak", "(void)ov_owner_clear(&result->native);", "(void)result->native;"]
		, ["public-cycle-check", "if (budget->path[i].address == value && budget->path[i].type == type) return LB_OWNED_INVALID;", "if (0 && budget->path[i].address == value && budget->path[i].type == type) return LB_OWNED_INVALID;"]
	];
	for(const [name, before, after] of mutations)
	{
		assert.ok(generated.source.includes(before));
		await saveLakeFile(compiled.directory, "public-api.c", implementation(generated.source.replace(before, after)));
		const changed = await compiled.compile(name, source, false, ["public-api.c", "-lgmp"]);
		await assert.rejects(() => changed(), /public C check failed/u);
	}
	const variant = generated.values.functions.find(item => item.name === "echoVariant");
	const originalCall = `  if (!status) status = ${variant.symbol}(&active->native, &raw0, &returned, &result_owner->native);`;
	assert.ok(generated.source.includes(originalCall));
	await saveLakeFile(compiled.directory, "public-api.c", implementation(generated.source.replace(originalCall, originalCall + "\n  if (!status) returned.tag = UINT32_MAX;")));
	const corrupted = await compiled.compile("public-malformed-result", source, false, ["public-api.c", "-lgmp"]);
	const rejected = await corrupted([], { LEAN_BRIDGE_OWNED_BAD_REPLY: "1" });
	assert.deepEqual(JSON.parse(rejected.stdout), { badReply: true }); assert.equal(rejected.stderr, "");
	const report = { result
		, bindingIrSha256: generated.layout.model.bindingIrSha256
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, headerSha256: sha256(generated.publicHeader)
		, adapterSha256: sha256(generated.source), probeSha256: sha256(source)
		, rejectedMutations: mutations.map(item => item[0])
		, malformedResultRetiresRuntime: true, cppHeaderCompiled: true
		, startupLeakBaseline: normalize(cold.stderr).replaceAll(compiled.directory, "<probe>") };
	await saveLakeFile(resolve("build/owned-aggregate-native"), "public-c.json", canonicalJson(report));
});

test("public C preserves all nineteen scalar types and nested optional units", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const { compiled, generated } = await prepare(t, { fixture: "owned-scalars", witness: "import Owned\n" });
	const source = await readFile("tests/fixtures/structured-types/owned-public-scalars.c", "utf8");
	const run = await compiled.compile("public-scalars", source, false, ["public-api.c", "-lgmp"]);
	const normal = await run(); assert.equal(normal.stderr, "");
	const result = JSON.parse(normal.stdout); t.diagnostic(JSON.stringify(result));
	assert.equal(result.primitives, 19); assert.ok(result.checks > 100); assert.ok(result.failures > 10);
	assert.equal(result.live, 0); assert.equal(result.identities, 0);
	const sanitized = await compiled.compile("public-scalars-sanitized", source, true, ["public-api.c", "-lgmp"]);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const direct = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_LEAN_ONLY: "1" });
	const repeated = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_LEAN_ONLY: "100" });
	const exercised = await sanitized([], environment);
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.deepEqual(JSON.parse(direct.stdout), { direct: true });
	assert.deepEqual(JSON.parse(repeated.stdout), { direct: true });
	assert.deepEqual(JSON.parse(exercised.stdout), result);
	assert.equal(normalize(direct.stderr), normalize(repeated.stderr), "Direct Lean calls added per-call leaks");
	assert.equal(normalize(exercised.stderr), normalize(direct.stderr), "Public C conversion added leaks beyond the direct Lean control");
	for(const check of [cold, direct, repeated, exercised]) assert.doesNotMatch(check.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	const report = { result, primitives: 19
		, bindingIrSha256: generated.layout.model.bindingIrSha256
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, headerSha256: sha256(generated.publicHeader)
		, adapterSha256: sha256(generated.source), probeSha256: sha256(source)
		, startupLeakBaseline: normalize(cold.stderr).replaceAll(compiled.directory, "<probe>")
		, directLeanLeakBaseline: { repetitions: [1, 100], report: normalize(direct.stderr).replaceAll(compiled.directory, "<probe>") } };
	await saveLakeFile(resolve("build/owned-aggregate-native"), "public-c-scalars.json", canonicalJson(report));
});
