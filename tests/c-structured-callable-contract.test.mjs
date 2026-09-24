/**
 * Explicit C structured-callable admission and nested borrow ownership.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateCallableBorrowViews } from "../src/backends/c/native-callables.mjs";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { nativeCallbackDefault } from "../src/build/native-model.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const options = { callables: true, structuredCallables: true, compounds: true, lists: true, variants: true };
const surface = ir => compilePrimitiveCSurface(ir, options);

test("structured callables require explicit admission and Python admits the copied surface", () => {
	const ir = structuredCallableReviewedIr();
	assert.throws(() => compilePrimitiveCSurface(ir, { ...options, structuredCallables: false }), { code: "unsupported-native-c-signature" });
	const python = compileCopiedPythonModel(ir).surface;
	const selected = surface(ir);
	assert.equal(selected.functions.length, 26); assert.equal(selected.callbacks.size, 14);
	assert.equal(selected.copies.length, 25);
	assert.equal(python.functions.length, selected.functions.length);
	assert.equal(python.callbacks.size, selected.callbacks.size);
	assert.equal(python.copies.length, selected.copies.length);
});

test("structured C callables retain copy ownership, lifetime and recursion gates", () => {
	for(const mutate of [
		ir => { ir.types.find(type => type.callable).callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.callable).callable.result.lifetime = { scope: "explicit", anchor: null }; }
		, ir => { ir.types.find(type => type.callable).callable.resultMode = "promise"; }
		, ir => { const cb = ir.types.find(type => type.callable); cb.callable.result.type = { kind: "named", id: cb.id }; }
	]) {
		const ir = structuredCallableReviewedIr(); mutate(ir);
		assert.throws(() => surface(ir), { code: "unsupported-native-c-signature" });
	}
	assert.throws(() => surface(structuredCallableReviewedIr({ recursive: true })), { code: "unsupported-native-c-signature" });
});

test("native callback failure values construct valid copied branches", () => {
	const string = { kind: "primitive", name: "string" };
	assert.match(nativeCallbackDefault({ kind: "option", element: string }), /_none\(lean_box\(0\)\)$/u);
	assert.match(nativeCallbackDefault({ kind: "result", arguments: [string, string] }), /_ok\(lean_mk_string\(""\)\)$/u);
	assert.match(nativeCallbackDefault({ kind: "tuple", arguments: [string, string] }), /_make\(lean_mk_string\(""\), lean_mk_string\(""\)\)$/u);
	assert.match(nativeCallbackDefault({ kind: "variant", name: "One", cases: [{ name: "value", fields: [{ name: "text", type: string }] }] }), /_make0\(lean_mk_string\(""\)\)$/u);
	assert.throws(() => nativeCallbackDefault({ kind: "resource", name: "Identity" }), /identity results need a failure representation/u);
});

test("nested callback borrows clean every allocation checkpoint under sanitizers", { timeout: 120_000 }, async t => {
	const execute = promisify(execFile), root = await mkdtemp(join(tmpdir(), "lean-bridge-structured-borrows-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = structuredCallableReviewedIr(), selected = surface(ir);
	const payload = selected.copy({ kind: "named", id: "lean:Structured.Payload" });
	await saveLakeFile(root, "structured.h", generateCBindingPackage(ir)["include/structured.h"]);
	await saveLakeFile(root, "borrow.c", `#include "structured.h"
#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
static size_t live, attempts, fail_at, released;
static void *tracked_alloc(size_t bytes) {
  if (fail_at && ++attempts == fail_at) return NULL;
  void *value = malloc(bytes); if (value) ++live; return value;
}
static void tracked_free(void *value) { if (value) { assert(live); --live; free(value); } }
static void release_value(void *value) { ++released; tracked_free(value); }
#define malloc tracked_alloc
#define free tracked_free
${generateCallableBorrowViews(selected)}
#undef malloc
#undef free
static structured_string text(void) {
  char *value = tracked_alloc(4); assert(value); memcpy(value, "abc", 4);
  return (structured_string){value, 3, value, release_value};
}
static void clear_text(structured_string *value) {
  if (value->owner && value->release) value->release(value->owner);
  *value = (structured_string){0};
}
static void release_rows(void *value) {
  structured_option_string_value *rows = value;
  for (size_t index = 0; index < 2; ++index) if (rows[index].has_value) clear_text(&rows[index].value);
  release_value(value);
}
static structured_payload make(void) {
  structured_payload value = {0}; value.text = text();
  structured_option_string_value *rows = tracked_alloc(2 * sizeof(*rows)); assert(rows);
  rows[0] = (structured_option_string_value){1, text()}; rows[1] = (structured_option_string_value){1, text()};
  value.rows = (structured_array_option_string_span){rows, 2, rows, release_rows};
  uint32_t *limb = tracked_alloc(sizeof(*limb)); assert(limb); *limb = 71;
  value.count = (structured_nat){limb, 1, limb, release_value};
  value.nested.has_value = 1; value.nested.value.is_ok = 0; value.nested.value.error = text();
  return value;
}
static void clear(structured_payload *value) {
  clear_text(&value->text);
  if (value->rows.owner && value->rows.release) value->rows.release(value->rows.owner);
  if (value->count.owner && value->count.release) value->count.release(value->count.owner);
  if (value->nested.has_value && !value->nested.value.is_ok) clear_text(&value->nested.value.error);
  *value = (structured_payload){0};
}
static void observe(const structured_payload *value) {
  assert(!value->text.owner && !value->text.release);
  assert(!value->rows.owner && !value->rows.release);
  for (size_t index = 0; index < 2; ++index) {
    assert(value->rows.data[index].has_value);
    assert(!value->rows.data[index].value.owner && !value->rows.data[index].value.release);
    assert(value->rows.data[index].value.length == 3);
    assert(!memcmp(value->rows.data[index].value.data, "abc", 3));
  }
  assert(!value->count.owner && !value->count.release && value->count.data[0] == 71);
  assert(!value->nested.value.error.owner && !value->nested.value.error.release);
}
int main(void) {
  unsigned checks = 0;
  for (unsigned mode = 0; mode < 3; ++mode) for (size_t point = 0; point <= 6; ++point) {
    fail_at = 0; released = 0;
    structured_payload value = make(); assert(live == 6);
    size_t budget = mode == 1 ? point * sizeof(lb_borrow_owner) : 16u * 1024u * 1024u;
    attempts = 0; fail_at = mode == 2 ? point : 0;
    lb_borrow_owner *owners = NULL;
    int status = lb_borrow_${payload.index}(&value, &owners, &budget);
    fail_at = 0;
    if ((mode == 1 && point < 6) || (mode == 2 && point)) assert(status != 1);
    else {
      assert(status == 1); observe(&value);
      structured_payload returned = value; clear(&returned); assert(released == 0);
      observe(&value);
    }
    clear(&value); lb_borrow_clear(owners); assert(released == 6 && live == 0); ++checks;
  }
  printf("structured-borrows:%u\\n", checks); return 0;
}
`);
	const binary = join(root, "borrow");
	await execute(process.env.CC ?? "cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-g", "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-no-pie", "borrow.c", "-o", binary], { cwd: root });
	const output = await execute(binary, [], { cwd: root, env: { ...process.env, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1" } });
	assert.equal(output.stdout, "structured-borrows:21\n"); assert.equal(output.stderr, "");
});
