/**
 * Allocation-fault checks for private native copied compound results.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Fail adapter allocations without replacing Lean's allocator.
 *
 * @param output - Fresh compound release.
 * @param working - Isolated probe directory.
 * @param environment - Producer compiler environment.
 */
export const checkNativeCompoundFaults = async (output, working, environment) => {
	const binding = join(output, "native/c-binding"), component = join(output, "native/component"), runtime = join(output, "native/runtime");
	const receipt = JSON.parse(await readFile(join(component, "native-component.json")));
	const source = await readFile(join(binding, "src/native.c"), "utf8");
	await saveLakeFile(working, "adapter.c", "#include <stddef.h>\nvoid *probe_malloc(size_t);\nvoid *probe_calloc(size_t,size_t);\nvoid *probe_realloc(void*,size_t);\nvoid probe_free(void*);\n" + source.replace(/\b(malloc|calloc|realloc|free)\b/g, "probe_$1"));
	await saveLakeFile(working, "probe.c", `#include "compounds.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static int remaining = -1, live; static unsigned checks;
#define CHECK(x) do { ++checks; assert(x); } while (0)
static int allowed(void) { if (!remaining) return 0; if (remaining > 0) --remaining; return 1; }
void *probe_malloc(size_t n) { if (!allowed()) return NULL; void *p = malloc(n); if (p) ++live; return p; }
void *probe_calloc(size_t n, size_t w) { if (!allowed()) return NULL; void *p = calloc(n,w); if (p) ++live; return p; }
void *probe_realloc(void *old, size_t n) { if (!allowed()) return NULL; int fresh = !old; void *p = realloc(old,n); if (fresh && p) ++live; return p; }
void probe_free(void *p) { if (p) { --live; free(p); } }
int main(void) {
  compounds_error error = {0}; uint8_t bytes[] = {0,255};
  compounds_option_bytes_value input = {1, {bytes,2,NULL,NULL}};
  for (unsigned round = 0; round < 50; ++round) {
    int succeeded = 0;
    for (int limit = 0; limit < 20; ++limit) {
      compounds_result_option_array_bytes_string_value out = {0}; remaining = limit;
      compounds_status status = compounds_duplicate(&input, &out, &error);
      if (status == COMPOUNDS_STATUS_OK) {
        CHECK(out.is_ok && out.ok.has_value && out.ok.value.length == 2);
        compounds_result_option_array_bytes_string_value_clear(&out); compounds_result_option_array_bytes_string_value_clear(&out);
        CHECK(live == 0); succeeded = 1; break;
      }
      CHECK(status == COMPOUNDS_STATUS_UNEXPECTED_ERROR && live == 0 && !out.is_ok);
    }
    CHECK(succeeded);
  }
  remaining = -1; input.has_value = 0;
  compounds_result_option_array_bytes_string_value out = {0};
  CHECK(compounds_duplicate(&input, &out, &error) == COMPOUNDS_STATUS_OK);
  CHECK(!out.is_ok && out.error.length == 5); compounds_result_option_array_bytes_string_value_clear(&out); CHECK(live == 0);
  input.has_value = 1; input.value.length = 6u * 1024u * 1024u; input.value.data = calloc(input.value.length,1); CHECK(input.value.data);
  CHECK(compounds_duplicate(&input, &out, &error) == COMPOUNDS_STATUS_INVALID_ARGUMENT); CHECK(live == 0 && !out.is_ok);
  free((void*)input.value.data); printf("native-fault-ok:%u\\n", checks);
}
`);
	const executable = join(working, "probe");
	await runCopied("/usr/bin/cc", ["-std=c11"
		, "-Wall"
		, "-Wextra"
		, "-Werror"
		, "-UNDEBUG"
		, "-I"
		, join(binding, "include")
		, "-I"
		, join(binding, "internal")
		, "-I"
		, component
		, "-I"
		, join(runtime, "include")
		, "adapter.c"
		, "probe.c"
		, join(binding, "src/compounds.c")
		, "-L"
		, component
		, "-L"
		, join(runtime, "lib")
		, `-l:${receipt.library}`
		, "-llean_bridge_native"
		, "-lleanshared"
		, `-Wl,-rpath,${component}`
		, `-Wl,-rpath,${join(runtime, "lib")}`
		, "-o"
		, executable], working, environment);
	const result = await runCopied(executable, [], working);
	assert.match(result.stdout, /^native-fault-ok:\d+\n$/);
	return Number(result.stdout.trim().split(":")[1]);
};
