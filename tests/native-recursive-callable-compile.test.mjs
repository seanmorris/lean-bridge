/**
 * Execute fresh native Lean callback carriers through the real borrow registry.
 * This is transport evidence, not an installed-package acceptance claim.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { readVerifiedNativeComponent } from "../src/build/native-artifacts.mjs";
import { nativeGraphCarrierAbi } from "../src/build/native-graph-model.mjs";
import { componentStructuredCallablePrefix, componentStructuredCopiedView } from "../src/build/component-structured-callable-lean.mjs";
import { componentRecursiveHelper } from "../src/build/component-recursive-lean.mjs";
import { componentRecursiveLimits } from "../src/abi/component-recursive.mjs";
import { generateNativeCallableGraphBorrows } from "../src/backends/c/native-callable-graph-borrows.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { structuredCallableReviewedIr, structuredCallableExports, structuredCallableArities } from "./helpers/structured-callable-fixture.mjs";
import { nativeRecursiveCallableCallsProbe } from "./helpers/native-recursive-callable-calls-probe.mjs";
import { witNestedAliasExports, witNestedAliasReviewedIr } from "./helpers/wit-structured-alias-fixture.mjs";

const probe = model => {
	const abi = nativeGraphCarrierAbi(model), view = componentStructuredCopiedView(abi);
	const converters = generateNativeCallableGraphBorrows(model.bindingIr, model.copiedGraph);
	const tree = { kind: "named", id: "lean:Structured.Tree" };
	const helper = componentRecursiveHelper(view, tree);
	const array = componentRecursiveHelper(view, { kind: "apply", constructor: "array", arguments: [tree] });
	const exported = name => model.bindingIr.declarations.find(item => item.source.declaration === "Structured." + name);
	const call = exported("callRecursive"), twice = exported("twiceRecursive"), make = exported("makeRecursive");
	const symbol = item => abi.exports.find(value => value.bindingId === item.id).symbol + "_lean";
	const callback = componentStructuredCallablePrefix(abi, abi.callbacks.find(item => item.id === call.parameters[1].type.id));
	const callbackKey = abi.callbacks.find(item => item.id === call.parameters[1].type.id).key;
	const nativeTree = converters.payloads.copy(tree).name;
	const referenced = [
		"ng_release"
		, ...converters.layout.nodes.flatMap(node => ["check", "in", "out"].map(action => `ng_${sha256(node.id).slice(0, 20)}_${action}`))
		, ...abi.callbacks.map(signature => `ng_invoke_${signature.key}`)
	];
	const closure = componentStructuredCallablePrefix(abi, abi.callbacks.find(item => item.id === make.result.type.id));
	return `#include "component.h"
#include "lean_bridge_native_runtime.h"
#include <stdio.h>
#include <stdlib.h>
static size_t graph_live, graph_attempts, graph_fail_at;
static void *graph_allocate(size_t bytes) {
  if (++graph_attempts == graph_fail_at) return NULL;
  void *value = malloc(bytes); if (value) ++graph_live; return value;
}
static void graph_release(void *value) {
  if (value) { if (!graph_live) abort(); --graph_live; free(value); }
}
#define LB_GRAPH_MALLOC graph_allocate
#define LB_GRAPH_FREE graph_release
${converters.source}
static void link_typed_adapters(void) {
${referenced.map(name => `  (void)${name};`).join("\n")}
}
static unsigned checks, calls, empty_replies;
static int reply_empty;
static void check(int condition) { ++checks; if (!condition) { fprintf(stderr, "check %u failed\\n", checks); abort(); } }
static lean_object *carry(lean_object *value) { return lean_array_push(lean_alloc_array(0, 0), value); }
static lean_object *make_tree(unsigned depth, unsigned value) {
  if (!depth) return ${helper}_make0(carry(lean_unsigned_to_nat(value)));
  lean_object *children = carry(make_tree(depth - 1, value));
  return ${helper}_make1(${array}_make(children));
}
static void expect_tree(lean_object *value, unsigned depth, unsigned leaf) {
  check(lean_is_array(value) && lean_array_size(value) == 1);
  lean_inc(value);
  check(${helper}_branch(value) == (depth ? 1 : 0));
  if (depth) {
    lean_object *children = ${array}_items(${helper}_case1_field0(value));
    check(lean_is_array(children) && lean_array_size(children) == 1);
    lean_object *child = lean_array_get_core(children, 0); lean_inc(child); lean_dec(children);
    expect_tree(child, depth - 1, leaf);
  } else {
    lean_object *nat = ${helper}_case0_field0(value), *expected = lean_unsigned_to_nat(leaf);
    check(lean_is_array(nat) && lean_array_size(nat) == 1);
    check(lean_nat_eq(lean_array_get_core(nat, 0), expected));
    lean_dec(nat); lean_dec(expected);
  }
}
static lean_object *echo(void *context, lean_object *value) {
  check(context == &calls); ++calls;
  if (reply_empty) { ++empty_replies; lean_dec(value); return lean_alloc_array(0, 0); }
  return value;
}
typedef struct { ng_borrow_frame *frame; unsigned mode; } copy_context;
typedef struct { uint32_t limb; } copy_owner;
static unsigned borrow_calls, released_replies, allocation_failures;
static void release_reply(void *owner) { ++released_replies; graph_release(owner); }
static uint32_t copied_echo(void *context, const ${nativeTree} *input, ${nativeTree} *out) {
  copy_context *state = context; ++borrow_calls;
  check(input->_bridge_owner == NULL && input->_bridge_release == NULL);
  if (!state->mode) { *out = *input; return NG_OK; }
  copy_owner *owner = graph_allocate(sizeof(*owner));
  if (!owner) return NG_ALLOC;
  owner->limb = 42;
  *out = (${nativeTree}){0};
  out->_bridge_owner = owner; out->_bridge_release = release_reply;
  out->kind = state->mode == 2 ? 999 : 0;
  out->cases.leaf.value.data = &owner->limb; out->cases.leaf.value.length = 1;
  if (state->mode == 4) {
    out->kind = 1; out->cases.branch.children.data = out; out->cases.branch.children.length = 1;
  }
  return state->mode == 3 ? NG_CALLBACK : NG_OK;
}
static size_t copied_call(unsigned depth, unsigned mode, size_t failure, size_t budget, uint32_t expected) {
  check(graph_live == 0); graph_attempts = 0; graph_fail_at = failure;
  ng_borrow_frame frame = { .budget = { .bytes = budget, .nodes = ${componentRecursiveLimits.valueNodes} } };
  copy_context context = { &frame, mode };
  ng_borrow_${callbackKey} host = { { copied_echo, &context }, &frame };
  uint64_t token = lb_native_callback_register((void (*)(void))ng_invoke_${callbackKey}, &host);
  check(token != 0);
  lean_object *result = ${symbol(call)}(make_tree(depth, 17), ${callback}_wrap((size_t)token));
  lb_native_callback_release(token);
  check(frame.status == expected);
  expect_tree(result, expected || mode ? 0 : depth, expected ? 0 : mode ? 42 : 17);
  check(graph_live == 0); check(lb_native_callback_take_error() == 0);
  if (expected == NG_ALLOC) ++allocation_failures;
  return graph_attempts;
}
extern lean_object *initialize_${"LeanBridgeNative" + sha256(model.component.id).slice(0, 16)}(uint8_t);
static void *initialize_component(uint8_t builtin) {
  return initialize_${"LeanBridgeNative" + sha256(model.component.id).slice(0, 16)}(builtin);
}
int main(void) {
  link_typed_adapters();
  check(lean_bridge_native_component_initialize("${model.component.id}", initialize_component));
  uint64_t token = lb_native_callback_register((void (*)(void))echo, &calls); check(token != 0);
  for (unsigned depth = 0; depth <= 64; ++depth) {
    expect_tree(${symbol(call)}(make_tree(depth, depth + 1), ${callback}_wrap((size_t)token)), depth, depth + 1);
    expect_tree(${symbol(twice)}(make_tree(depth, depth + 2), ${callback}_wrap((size_t)token)), depth, depth + 2);
    lean_object *captured = ${symbol(make)}(make_tree(depth, depth + 3));
    lean_inc(captured);
    expect_tree(${closure}_apply(captured, carry(lean_box(1)), make_tree(0, 987)), depth, depth + 3);
    expect_tree(${closure}_apply(captured, carry(lean_box(0)), make_tree(depth, 789)), depth, 789);
    check(!lb_native_callback_take_error());
  }
  check(calls == 195);
  reply_empty = 1;
  expect_tree(${symbol(call)}(make_tree(32, 17), ${callback}_wrap((size_t)token)), 0, 0);
  check(empty_replies == 1); reply_empty = 0;
  lb_native_callback_release(token);
  expect_tree(${symbol(call)}(make_tree(32, 18), ${callback}_wrap((size_t)token)), 0, 0);
  check(lb_native_callback_take_error() == 1); check(lb_native_callback_take_error() == 0);
  expect_tree(${symbol(call)}(make_tree(1, 19), ${callback}_wrap(0)), 0, 0);
  check(lb_native_callback_take_error() == 1);
  check(calls == 196);
  size_t attempts = copied_call(32, 0, 0, 16u * 1024u * 1024u, NG_OK);
  check(attempts > 32);
  for (size_t failure = 1; failure <= attempts; ++failure)
    copied_call(32, 0, failure, 16u * 1024u * 1024u, NG_ALLOC);
  copied_call(32, 1, 0, 16u * 1024u * 1024u, NG_OK);
  copied_call(32, 2, 0, 16u * 1024u * 1024u, NG_INVALID);
  copied_call(32, 3, 0, 16u * 1024u * 1024u, NG_CALLBACK);
  copied_call(32, 4, 0, 16u * 1024u * 1024u, NG_INVALID);
  copied_call(32, 0, 0, 0, NG_LIMIT);
  copied_call(70, 0, 0, 16u * 1024u * 1024u, NG_LIMIT);
  check(released_replies == 4); check(allocation_failures == attempts); check(graph_live == 0);
  printf("{\\"checks\\":%u,\\"callbacks\\":%u,\\"emptyReplies\\":%u,\\"depth\\":64,\\"allocationFailures\\":%u,\\"releasedReplies\\":%u}\\n",
    checks, calls, empty_replies, allocation_failures, released_replies);
  return 0;
}
`;
};

test("fresh ordinary and reviewed native recursive callback carriers execute on 64-bit Lean", {
	skip: process.env.LEAN_BRIDGE_NATIVE_RECURSIVE_CALLABLE_TEST !== "1"
	, timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-native-recursive-callable-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const run = (command, args, cwd = root, env = {}) => processBuildRunner.capture({
		command, args, cwd, env: { ...process.env, ...env }, timeoutMs: 180_000
	})
		.catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const runtime = await buildNativeSharedRuntime({ outputRoot: join(root, "runtime"), leanPrefix });
	const reports = [];
	for(const reviewed of [false, true])
	{
		const directory = join(root, reviewed ? "reviewed" : "ordinary"), project = join(directory, "project");
		await cp("tests/fixtures/onboarding/structured-callables", project, { recursive: true });
		const sourceLean = await readFile(join(project, "Structured.lean"), "utf8");
		const aliasLean = await readFile("tests/fixtures/structured-callable-consumers/wit-aliases.lean", "utf8");
		assert.equal(sourceLean.split("end Structured").length, 2);
		await saveLakeFile(project, "Structured.lean", sourceLean.replace("end Structured", aliasLean + "\nend Structured"));
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, ...reviewed ? {} : { exports: [...structuredCallableExports({ recursive: true }), ...witNestedAliasExports]
				, arities: { ...structuredCallableArities, "Structured.makeNestedAlias": 1, "Structured.makeNestedPlain": 1 } } }));
		if(reviewed)
		{
			const ir = structuredCallableReviewedIr({ recursive: true }), aliases = witNestedAliasReviewedIr();
			ir.types.push(...aliases.types.filter(type => !ir.types.some(existing => existing.id === type.id)));
			ir.declarations.push(...aliases.declarations);
			await saveLakeFile(project, "structured.binding-ir.json", canonicalJson(ir));
		}
		const compiled = await buildNativeComponent({ projectRoot: project
			, outputRoot: join(directory, "component")
			, runtimeRoot: runtime.root
			, leanPrefix
			, targets: ["c"]
			, copiedGraphs: true })
			.catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
		const verified = await readVerifiedNativeComponent(compiled.root, runtime.identity, { copiedGraphs: true });
		assert.deepEqual(verified.model, compiled.model); assert.equal(compiled.model.exports.length, 33);
		assert.equal(compiled.model.schemaVersion, reviewed ? 5 : 4);
		const source = probe(compiled.model);
		await saveLakeFile(directory, "consumer.c", source);
		const converters = generateNativeCallableGraphBorrows(compiled.model.bindingIr, compiled.model.copiedGraph);
		const p = converters.layout.prefix;
		await saveLakeFile(directory, `${p}-graph-types.h`, converters.typesHeader);
		await saveLakeFile(directory, `${p}-graph.h`, `#include "${p}-graph-types.h"\n`);
		await saveLakeFile(directory, `${p}-callable-borrows.h`, converters.header);
		const compilerArguments = ["-std=c11"
			, "-O2"
			, "-g0"
			, "-Wall"
			, "-Wextra"
			, "-Werror"
			, "-pthread"
			, "-I", compiled.root, "-I", join(runtime.root, "include")
			, "consumer.c", "-L", compiled.root, "-L", join(runtime.root, "lib")
			, "-l:" + compiled.receipt.library, "-llean_bridge_native", "-lleanshared"
			, "-Wl,-rpath," + compiled.root
			, "-Wl,-rpath," + join(runtime.root, "lib")
			, "-o"
			, "consumer"];
		await run("cc", compilerArguments, directory);
		const result = JSON.parse((await run(join(directory, "consumer"), [], directory)).stdout);
		assert.equal(result.callbacks, 196); assert.equal(result.emptyReplies, 1); assert.equal(result.depth, 64);
		assert.ok(result.checks > 25000);
		assert.ok(result.allocationFailures > 32); assert.equal(result.releasedReplies, 4);
		await run(process.env.LEAN_BRIDGE_SANITIZER_CC ?? "cc", [...compilerArguments.slice(0, -2)
			, "-O1", "-g", "-fsanitize=address,undefined", "-fno-omit-frame-pointer"
			, "-o", "consumer-sanitized"], directory);
		const sanitized = JSON.parse((await run(join(directory, "consumer-sanitized"), [], directory, {
			ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1"
			, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
		})).stdout);
		assert.deepEqual(sanitized, result);
		const mutations = [
			{ name: "argument-arena", before: "  ng_release(arena.head);" }
			, { name: "reply-owner", before: `  ${converters.payloads.copy({ kind: "named", id: "lean:Structured.Tree" }).name}_clear(&reply);` }
		];
		for(const mutation of mutations)
		{
			assert.ok(source.includes(mutation.before));
			await saveLakeFile(directory, mutation.name + ".c", source.replaceAll(mutation.before, "  /* deliberately omitted cleanup */"));
			await run("cc", compilerArguments.map(argument => argument === "consumer.c"
				? mutation.name + ".c" : argument === "consumer" ? mutation.name : argument), directory);
			await assert.rejects(() => run("sh", ["-c", 'ulimit -c 0\nexec "$1"', "ownership-mutation", join(directory, mutation.name)], directory)
				, /check [0-9]+ failed/);
		}
		const callsProbe = nativeRecursiveCallableCallsProbe(compiled.model, compiled.receipt);
		await saveLakeFile(directory, "calls.c", callsProbe.source);
		await saveLakeFile(directory, `${p}-callable-borrows.h`, callsProbe.generated.borrowsHeader);
		await saveLakeFile(directory, `${p}-callable-graph.h`, callsProbe.generated.header);
		const callsArguments = compilerArguments.map(argument => argument === "consumer.c" ? "calls.c" : argument === "consumer" ? "calls" : argument);
		await run("cc", callsArguments, directory);
		const executeCalls = (executable, args = [], env = {}) => run("sh", ["-c", 'ulimit -c 0\nexec "$@"', "native-callable-probe", join(directory, executable), ...args], directory, env);
		const callsResult = JSON.parse((await executeCalls("calls")).stdout);
		t.diagnostic(JSON.stringify({ path: reviewed ? "reviewed-ir" : "ordinary-source", nativeCalls: callsResult }));
		assert.equal(callsResult.shapes, 9); assert.equal(callsResult.reentryDepth, 64);
		assert.equal(callsResult.aliasSignatures, 2);
		assert.ok(callsResult.checks > 10000); assert.ok(callsResult.rejections > 1100);
		assert.ok(callsResult.allocationFailures > 50); assert.ok(callsResult.ownedReplies > 100);
		await run(process.env.LEAN_BRIDGE_SANITIZER_CC ?? "cc", [...callsArguments.slice(0, -2)
			, "-O1", "-g", "-fsanitize=address,undefined", "-fno-omit-frame-pointer"
			, "-o", "calls-sanitized"], directory);
		const sanitizerEnvironment = { ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1"
			, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" };
		const callsSanitized = JSON.parse((await executeCalls("calls-sanitized", [], sanitizerEnvironment)).stdout);
		assert.deepEqual(callsSanitized, callsResult);
		for(const executable of ["calls", "calls-sanitized"])
			for(const arguments_ of [["retire"], ["retire", "preserve-error"], ["malformed"]])
				await executeCalls(executable, arguments_, sanitizerEnvironment);
		const callsMutations = [
			{ name: "closure-disposal" }
			, { name: "failed-output", before: "  uint32_t status = ng_call_leave(call);"
				, after: "  uint32_t status = ng_call_leave(call); if (status) memset(out, 0, sizeof(*out));" }
		];
		const dispose = callsProbe.generated.closures[0].dispose;
		const signature = new RegExp(`void (${callsProbe.generated.layout.prefix}_callback_[0-9a-f]+_lease_dispose)\\(uint64_t token\\) \\{ ng_closure_drop\\(token, [^;]+; \\}`, "g");
		assert.ok(callsProbe.source.includes(`void ${dispose}(uint64_t token)`));
		for(const mutation of callsMutations)
		{
			const changed = mutation.name === "closure-disposal"
				? callsProbe.source.replace(signature, "void $1(uint64_t token) { (void)token; }")
				: callsProbe.source.replaceAll(mutation.before, mutation.after);
			assert.notEqual(changed, callsProbe.source);
			await saveLakeFile(directory, mutation.name + ".c", changed);
				await run("cc", [...callsArguments.map(argument => argument === "calls.c" ? mutation.name + ".c"
					: argument === "calls" ? mutation.name : argument)
					, "-O0"], directory);
			await assert.rejects(() => executeCalls(mutation.name), /call check at/);
		}
		reports.push({ path: reviewed ? "reviewed-ir" : "ordinary-source"
			, result
			, sanitized
			, rejectedCleanupMutations: mutations.map(mutation => mutation.name)
			, consumerSha256: sha256(source)
			, calls: { result: callsResult
				, sanitized: callsSanitized
				, sourceSha256: sha256(callsProbe.source)
				, retirementChecks: ["stop-repeated-callback", "preserve-first-error", "malformed-carrier"]
				, rejectedMutations: callsMutations.map(mutation => mutation.name) }
			, nativeLibrary: compiled.receipt.nativeLibrary
			, bindingIrSha256: compiled.model.bindingIrSha256 });
		t.diagnostic(JSON.stringify(reports.at(-1)));
	}
	assert.deepEqual(reports[0].result, reports[1].result);
	await saveLakeFile(resolve("build/native-recursive-callables"), "transport.json", canonicalJson({ reports }));
});
