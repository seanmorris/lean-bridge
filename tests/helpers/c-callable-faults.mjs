/**
 * Inject failures into generated C allocations without changing installed archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";

/**
 * Check failed wrapper allocation, conversion cleanup and balanced closure leases.
 *
 * @param output - Fresh native release root.
 * @param working - Private fault-injection directory.
 * @param environment - Producer C compiler environment.
 */
export const checkCCallableFaults = async (output, working, environment) => {
	const adapter = join(output, "native/c-binding"), component = join(output, "native/component"), runtime = join(output, "native/runtime");
	const receipt = JSON.parse(await readFile(join(component, "native-component.json"), "utf8"));
	const ir = callableReviewedIr();
	const ref = name => ir.declarations.find(item => item.name === name).result.type.id.replace("bridge:Callback", "");
	const cb = ir.declarations.find(item => item.name === "callString").parameters[1].type.id.replace("bridge:Callback", "");
	const prelude = "#include <stddef.h>\nvoid *lb_test_malloc(size_t);\nvoid *lb_test_calloc(size_t, size_t);\nvoid *lb_test_realloc(void *, size_t);\nvoid lb_test_free(void *);\n";
	for(const name of ["native", "callables"])
	{
		const source = await readFile(join(adapter, `src/${name}.c`), "utf8");
		await saveLakeFile(working, `${name}.c`, prelude + source.replace(/\b(malloc|calloc|realloc|free)\b/g, "lb_test_$1"));
	}
	await saveLakeFile(working, "fault.c", `#include <callables.h>
#include <lean_bridge_native_runtime.h>
#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
static int remaining = -1, live, calls;
static unsigned checks;
#define CHECK(x) do { ++checks; assert(x); } while (0)
static int allowed(void) { if (!remaining) return 0; if (remaining > 0) --remaining; return 1; }
void *lb_test_malloc(size_t n) { if (!allowed()) return NULL; void *p = malloc(n); if (p) ++live; return p; }
void *lb_test_calloc(size_t n, size_t w) { if (!allowed()) return NULL; void *p = calloc(n, w); if (p) ++live; return p; }
void *lb_test_realloc(void *p, size_t n) { if (!allowed()) return NULL; int fresh = p == NULL; void *q = realloc(p, n); if (q && fresh) ++live; return q; }
void lb_test_free(void *p) { if (p) { --live; free(p); } }
static unsigned identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }
static callables_status echo(void *raw, const callables_string *value, callables_string *out, callables_error *error) {
  (void)raw; (void)error; ++calls; *out = *value; return CALLABLES_STATUS_OK;
}
int main(void) {
  callables_error error = {0}; unsigned before = identities();
  callables_owned_callback${ref("makeUInt32")} *owned = NULL;
  remaining = 0;
  CHECK(callables_make_uint32(42, &owned, &error) == CALLABLES_STATUS_UNEXPECTED_ERROR);
  CHECK(!owned && !live && identities() == before);
  remaining = -1;
  CHECK(callables_make_uint32(42, &owned, &error) == CALLABLES_STATUS_OK && owned);
  CHECK(live == 1 && identities() == before + 1);
  callables_owned_callback${ref("makeUInt32")}_dispose(&owned);
  CHECK(!owned && !live && identities() == before);
  callables_string value = {.data="hello", .length=5}, result = {0};
  callables_callback${cb} callback = {echo, NULL};
  for (int limit = 0; limit < 6; ++limit) {
    remaining = limit; calls = 0;
    callables_status status = callables_twice_string(&value, &callback, &result, &error);
    if (limit < 3) CHECK(status != CALLABLES_STATUS_OK);
    else { CHECK(status == CALLABLES_STATUS_OK && calls == 2); CHECK(result.length == 5 && !memcmp(result.data, "hello", 5)); }
    callables_string_clear(&result); CHECK(!live && identities() == before);
  }
  remaining = -1;
  callables_owned_callback${ref("makeString")} *text = NULL;
  CHECK(callables_make_string(&value, &text, &error) == CALLABLES_STATUS_OK);
  remaining = 0;
  CHECK(callables_owned_callback${ref("makeString")}_call(text, true, &value, &result, &error) != CALLABLES_STATUS_OK);
  CHECK(!result.data && live == 1);
  remaining = -1;
  CHECK(callables_owned_callback${ref("makeString")}_call(text, true, &value, &result, &error) == CALLABLES_STATUS_OK);
  callables_string_clear(&result); callables_owned_callback${ref("makeString")}_dispose(&text);
  CHECK(!live && identities() == before);
  printf("fault-ok:%u\\n", checks); return 0;
}
`);
	const command = join(working, "fault");
	const args = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
		, "-I", join(adapter, "include"), "-I", join(adapter, "internal")
		, "-I", component, "-I", join(runtime, "include")
		, "callables.c", "native.c", "fault.c"
		, "-L", component, "-L", join(runtime, "lib")
		, `-l:${receipt.library}`, "-llean_bridge_native", "-lleanshared"
		, `-Wl,-rpath,${component}`, `-Wl,-rpath,${join(runtime, "lib")}`
		, "-o", command];
	await processBuildRunner.capture({ command: environment.CC ?? "cc", args, cwd: working, env: environment });
	const result = await processBuildRunner.capture({ command, args: [], cwd: working, env: environment });
	assert.match(result.stdout.trim(), /^fault-ok:\d+$/);
	return Number(result.stdout.trim().split(":")[1]);
};
