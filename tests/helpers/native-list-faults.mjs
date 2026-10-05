/**
 * Partial List output allocation and budget failure cleanup against real Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Fail every copied-output allocation without replacing Lean's allocator.
 *
 * @param output - Fresh List release.
 * @param working - Task-owned probe directory.
 * @param environment - Producer compiler environment.
 */
export const checkNativeListFaults = async (output, working, environment) => {
	const binding = join(output, "native/c-binding"), component = join(output, "native/component"), runtime = join(output, "native/runtime");
	const receipt = JSON.parse(await readFile(join(component, "native-component.json")));
	const source = await readFile(join(binding, "src/native.c"), "utf8");
	await saveLakeFile(working, "adapter.c", "#include <stddef.h>\nvoid *probe_malloc(size_t);\nvoid *probe_calloc(size_t,size_t);\nvoid *probe_realloc(void*,size_t);\nvoid probe_free(void*);\n" + source.replace(/\b(malloc|calloc|realloc|free)\b/g, "probe_$1"));
	await saveLakeFile(working, "probe.c", `#include "lists.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
static int remaining = -1, live; static unsigned checks;
#define CHECK(x) do { ++checks; assert(x); } while (0)
static int allowed(void) { if (!remaining) return 0; if (remaining > 0) --remaining; return 1; }
void *probe_malloc(size_t n) { if (!allowed()) return NULL; void *p = malloc(n); if (p) ++live; return p; }
void *probe_calloc(size_t n, size_t w) { if (!allowed()) return NULL; void *p = calloc(n,w); if (p) ++live; return p; }
void *probe_realloc(void *old, size_t n) { if (!allowed()) return NULL; int fresh = !old; void *p = realloc(old,n); if (fresh && p) ++live; return p; }
void probe_free(void *p) { if (p) { --live; free(p); } }
int main(void) {
  lists_error error = {0}; uint8_t bytes[] = {0,255}; lists_bytes input = {bytes,2,NULL,NULL};
  for (unsigned round = 0; round < 50; ++round) {
    int succeeded = 0;
    for (int limit = 0; limit < 20; ++limit) {
      lists_list_bytes_span out = {0}; remaining = limit;
      lists_status status = lists_duplicate(&input, &out, &error);
      if (status == LISTS_STATUS_OK) {
        CHECK(out.length == 2 && out.data[0].length == 2 && out.data[1].data[1] == 255);
        lists_list_bytes_span_clear(&out); lists_list_bytes_span_clear(&out);
        CHECK(live == 0); succeeded = 1; break;
      }
      CHECK(status == LISTS_STATUS_UNEXPECTED_ERROR && live == 0 && !out.length);
    }
    CHECK(succeeded);
  }
  remaining = -1; input.length = 6u * 1024u * 1024u; input.data = calloc(input.length,1); CHECK(input.data);
  lists_list_bytes_span out = {0};
  for (unsigned i = 0; i < 10; ++i) {
    CHECK(lists_duplicate(&input, &out, &error) == LISTS_STATUS_INVALID_ARGUMENT); CHECK(live == 0 && !out.length);
  }
  free((void*)input.data); input = (lists_bytes){bytes,2,NULL,NULL};
  CHECK(lists_duplicate(&input, &out, &error) == LISTS_STATUS_OK); lists_list_bytes_span_clear(&out); CHECK(live == 0);
  printf("native-list-fault-ok:%u\\n", checks);
}
`);
	const executable = join(working, "probe");
	await runCopied("/usr/bin/cc", ["-std=c11"
		, "-Wall"
		, "-Wextra"
		, "-Werror"
		, "-UNDEBUG"
		, "-I", join(binding, "include")
		, "-I", join(binding, "internal")
		, "-I", component
		, "-I", join(runtime, "include")
		, "adapter.c", "probe.c", join(binding, "src/lists.c")
		, "-L", component
		, "-L", join(runtime, "lib")
		, `-l:${receipt.library}`
		, "-llean_bridge_native", "-lleanshared"
		, `-Wl,-rpath,${component}`
		, `-Wl,-rpath,${join(runtime, "lib")}`
		, "-o", executable], working, environment);
	const result = await runCopied(executable, [], working);
	assert.match(result.stdout, /^native-list-fault-ok:\d+\n$/);
	return { native: Number(result.stdout.trim().split(":")[1]) };
};
