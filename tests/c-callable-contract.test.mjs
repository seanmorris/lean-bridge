/**
 * Keep C callable admission distinct from unimplemented host projections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateNativeCallables } from "../src/backends/c/native-callables.mjs";

test("only explicit C callable admission accepts all nineteen primitive signatures", () => {
	const ir = callableReviewedIr();
	assert.throws(() => compilePrimitiveCSurface(ir), { code: "unsupported-native-c-signature" });
	const surface = compilePrimitiveCSurface(ir, { callables: true });
	assert.equal(surface.callbacks.size, 38); assert.equal(surface.copies.length, 19);
	assert.equal(surface.functions.length, 58);
});

for(const [name, change] of Object.entries({
	"retained host callback": ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, "asynchronous callback": ir => { ir.types[0].callable.resultMode = "promise"; }
	, "unreported host failure": ir => { ir.declarations[0].failure.mode = "none"; }
	, "once-only callback": ir => { ir.types[0].callable.invocation = "once"; }
	, "immediate self-disposal": ir => { ir.types[0].callable.selfDisposal = "reject"; }
	, "callback copied container": ir => { ir.types[0].callable.result.type = { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "uint8" }] }; }
	, "reserved callback argument": ir => { ir.types[0].callable.parameters[0].name = "context"; }
	, "optional callback argument": ir => { ir.types[0].callable.parameters[0].optional = true; }
})) test(`C admission rejects ${name}`, () => {
	const ir = callableReviewedIr(); change(ir);
	assert.throws(() => compilePrimitiveCSurface(ir, { callables: true }), { code: "unsupported-native-c-signature" });
});

test("public C callable wrappers release failed allocations and reject null dynamic arguments", () => {
	const source = generateCBindingPackage(callableReviewedIr())["src/callables.c"];
	assert.match(source, /if \(owned == NULL\) \{\s+if \(callables_runtime->callback[0-9a-f]+_dispose/);
	assert.match(source, /if \(self == NULL \|\| out == NULL \|\| value1 == NULL\)/);
});

test("C call frames use bounded thread storage and preserve nesting, errors and reuse", async t => {
	const run = promisify(execFile), compiler = process.env.LEAN_BRIDGE_FRAME_CC ?? "cc";
	try
	{ await run(compiler, ["--version"]); }
	catch(error)
	{
		if(error.code !== "ENOENT") throw error;
		t.skip("C compiler unavailable");
		return;
	}
	const { source } = generateNativeCallables({ types: [], pointerBits: 64 }, { prefix: "sample", callbacks: new Map([["test", {}]]), functions: [] });
	const scopes = source.split("/* Registry")[0];
	assert.match(scopes, /static _Thread_local lb_frame lb_frames\[64\]/u);
	assert.match(scopes, /static lb_frame \*lb_enter\(void\)/u);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-c-frames-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await writeFile(join(directory, "frames.c"), `#include <assert.h>
#include <pthread.h>
#include <stddef.h>
#include <string.h>
typedef enum { SAMPLE_STATUS_OK, SAMPLE_STATUS_INVALID_ARGUMENT, SAMPLE_STATUS_UNEXPECTED_ERROR } sample_status;
typedef enum { SAMPLE_ERROR_UNEXPECTED = 1 } sample_error_code;
typedef struct { sample_error_code code; const char *message; size_t message_length; } sample_error;
static _Thread_local int pending;
static int lb_native_callback_take_error(void) { int result = pending; pending = 0; return result; }
${scopes}
static void *exercise(void *context) {
  (void)context;
  assert(lb_depth == 0 && lb_current == NULL);
  for(unsigned repetition = 0; repetition < 2; ++repetition) {
    for(unsigned i = 0; i < 64; ++i) {
      lb_frame *frame = lb_enter();
      assert(frame == &lb_frames[i] && frame == lb_current);
      assert(frame->status == SAMPLE_STATUS_OK && frame->budget == 16u * 1024u * 1024u);
      frame->budget = i;
    }
    assert(lb_enter() == NULL && lb_depth == 64);
    for(unsigned i = 64; i > 0; --i) {
      sample_error error = {0};
      assert(lb_current->budget == i - 1);
      assert(lb_leave(lb_current, &error) == SAMPLE_STATUS_OK);
      assert(error.message == NULL && lb_depth == i - 1);
    }
    assert(lb_current == NULL);
  }
  return NULL;
}
int main(void) {
  exercise(NULL);
  lb_frame *parent = lb_enter();
  pending = 1;
  lb_frame *child = lb_enter();
  assert(parent->status == SAMPLE_STATUS_INVALID_ARGUMENT);
  assert(child->status == SAMPLE_STATUS_OK);
  lb_record(parent, SAMPLE_STATUS_UNEXPECTED_ERROR, NULL, "second error");
  assert(lb_leave(child, NULL) == SAMPLE_STATUS_OK && lb_current == parent);
  pthread_t thread;
  assert(pthread_create(&thread, NULL, exercise, NULL) == 0);
  assert(pthread_join(thread, NULL) == 0);
  assert(lb_depth == 1 && lb_current == parent);
  sample_error error = {0};
  assert(lb_leave(parent, &error) == SAMPLE_STATUS_INVALID_ARGUMENT);
  assert(strcmp(error.message, "Expired or wrong-thread host callback") == 0);
  exercise(NULL);
  return 0;
}
`);
	await run(compiler, ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", "-pthread", "frames.c", "-o", "frames"], { cwd: directory });
	await run(join(directory, "frames"), []);
});
