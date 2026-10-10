/**
 * Execute generated Fin diagnostics without a Lean runtime. Installed gates remain separate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { sha256 } from "../../src/capsule/node.mjs";
import { finDiagnosticRejection } from "../../src/backends/c/fin-diagnostic.mjs";
import { finRefinementWalk, generateCopiedNativeCalls, nativeCReference } from "../../src/backends/c/native-copied-values.mjs";
import { generateNativePrimitiveC } from "../../src/backends/c/native-primitives.mjs";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { compilePrimitiveCSurface } from "../../src/backends/c/primitive-surface.mjs";
import { finRecordCompilerModel, finRecordNat, finRecordShape, finRecordSignatures } from "./fin-record-model.mjs";
import { finCallbackCompilerModel } from "./fin-callback-model.mjs";
import { finReplyCompilerModel } from "./fin-reply-model.mjs";
import { finRecordDispatchColumns, finRecordDispatchExpected } from "./fin-record-dispatch.mjs";
import "./native-fin-diagnostic-source-history-tests.mjs";
import "./native-fin-nix-boundary-tests.mjs";
import "./native-fin-diagnostic-php-wasm-tests.mjs";

const run = promisify(execFile);
const surfaceOf = model => compilePrimitiveCSurface(model.bindingIr, { wordBits: model.pointerBits, callables: true, structuredCallables: true, compounds: true, lists: true, variants: true });
const initializer = { initializer: "initialize_LeanBridgeNative0123456789abcdef" };
const rejection = (path, name = "failure") => finDiagnosticRejection({ path, name, bound: "184467440737095516170", indent: "  ", reject: message => `return ${message};` });
const cString = JSON.stringify;
const suffix = " is not below its Fin 184467440737095516170 bound";
const compile = async (t, source, files = {}, defines = []) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-diagnostics-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await Promise.all(Object.entries({ ...files, "test.c": source }).map(([path, text]) => writeFile(join(directory, path), text)));
	const binary = join(directory, "test");
	await run("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-Wformat=2", "-pedantic", "-pthread", ...defines.map(name => `-D${name}`), "test.c", "-o", binary], { cwd: directory });
	return () => run(binary, [], { cwd: directory, timeout: 30_000 });
};

test("the published CLI includes the native Fin diagnostic generator", async () => {
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.ok(manifest.files.includes("src/backends/c/fin-diagnostic.mjs"));
	const release = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	assert.ok(release.files.includes("src/backends/c/fin-diagnostic.mjs"));
});

test("the first installed Fin diagnostic report retains exact original bytes and only its measured C/C++ scope", async () => {
	const directory = "docs/evidence/native-fin-diagnostics-20261010";
	const reportBytes = await readFile(`${directory}/ordinary-c-cpp.json`);
	const tap = await readFile(`${directory}/ordinary-c-cpp.tap`, "utf8");
	assert.equal(sha256(reportBytes), "31b27a9cc5b78f4bfd979ede83ce9bf0d70e9e2ebd0dcb00a0b2cf46859d6387");
	assert.equal(sha256(tap), "e824c012d8a90820c942e690186e845642f7aa261873090cd9d2e26902095738");
	assert.match(tap, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	const report = JSON.parse(reportBytes);
	assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => [item.profile, item.checks]), [["c", 2064], ["cpp", 2053]]);
	for(const entry of report.reports)
	{
		assert.equal(entry.path, "ordinary-source");
		for(const fact of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(entry[fact], true, fact);
		assert.equal(entry.packages.length, 1);
		assert.equal(entry.packages[0].target, entry.profile);
		for(const archive of entry.packages[0].artifacts) assert.equal(report.archives[archive.path], archive.sha256);
	}
	assert.deepEqual(report.reports[0].dispatch.columns, finRecordDispatchColumns);
	assert.deepEqual(report.reports[0].dispatch.observed, finRecordDispatchExpected);
	assert.equal(Object.hasOwn(report.reports[1], "dispatch"), false);
});

test("compiled Fin messages preserve full paths, size_t indices and literal source names", async t => {
	const field = `.field%zu%n%s_"\\雪${"x".repeat(1500)}`;
	const staticName = "arg0.inner.digit";
	const source = `#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
static const char *plain(void) { ${rejection([staticName], "plain")} }
static const char *indexed(size_t outer, size_t inner) {
  ${rejection(["arg0[", { index: "outer" }, "]?.cases[", { index: "inner" }, "]", field])}
}
int main(void) {
  const char *message = indexed(SIZE_MAX, SIZE_MAX);
  const char *maximum = sizeof(size_t) == 8 ? "18446744073709551615" : "4294967295";
  char expected[4096];
  snprintf(expected, sizeof(expected), "arg0[%s]?.cases[%s]%s%s", maximum, maximum, ${cString(field)}, ${cString(suffix)});
  assert(strcmp(message, expected) == 0);
  assert(strlen(message) > 1500);
  assert(strcmp(plain(), ${cString(staticName + suffix)}) == 0);
  /* An unrelated static failure does not invalidate the returned indexed message. */
  assert(strcmp(message, expected) == 0);
  message = indexed(0, 17);
  assert(strcmp(message, ${cString(`arg0[0]?.cases[17]${field}${suffix}`)}) == 0);
  puts("fin-diagnostic-format-ok");
}
`;
	assert.doesNotMatch(rejection([staticName]), /snprintf|_Thread_local/u);
	assert.equal((await (await compile(t, source))()).stdout, "fin-diagnostic-format-ok\n");
});

test("indexed Fin message storage survives return and isolates overlapping calls on separate threads", async t => {
	const source = `#define _XOPEN_SOURCE 700
#include <assert.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#ifdef SHARED_STORAGE
#define _Thread_local
#endif
static pthread_barrier_t barrier;
static const char *indexed(size_t index) { ${rejection(["arg0[", { index: "index" }, "].digit"])} }
static void wait_for_peer(void) {
  int result = pthread_barrier_wait(&barrier);
  assert(result == 0 || result == PTHREAD_BARRIER_SERIAL_THREAD);
}
static void *worker(void *unused) {
  (void)unused;
  wait_for_peer();
  const char *message = indexed(29);
  wait_for_peer();
  assert(strcmp(message, ${cString(`arg0[29].digit${suffix}`)}) == 0);
  return NULL;
}
int main(void) {
  assert(pthread_barrier_init(&barrier, NULL, 2) == 0);
  const char *message = indexed(7);
  pthread_t thread;
  assert(pthread_create(&thread, NULL, worker, NULL) == 0);
  wait_for_peer();
  wait_for_peer();
  int valid = strcmp(message, ${cString(`arg0[7].digit${suffix}`)}) == 0;
  assert(pthread_join(thread, NULL) == 0);
  assert(pthread_barrier_destroy(&barrier) == 0);
  if (!valid) { fputs("shared diagnostic storage\\n", stderr); return 1; }
  puts("fin-diagnostic-thread-ok");
}
`;
	assert.equal((await (await compile(t, source))()).stdout, "fin-diagnostic-thread-ok\n");
	// Deterministic negative control: the second thread overwrites shared storage before comparison.
	await assert.rejects(await compile(t, source, {}, ["SHARED_STORAGE"]), error => error.code === 1 && error.stderr === "shared diagnostic storage\n");
});

// Emit independent caller data in the actual generated header's types. Active branches alone exist.
const payload = (type, value, copy) => {
	if(type.kind === "alias") return payload(type.target, value, copy);
	const c = copy(type), wrap = fields => `(${c.name}){${fields}}`;
	if(type.kind === "primitive")
	{
		if(type.name === "string") return wrap(`.data = ${cString(value)}, .length = ${Buffer.byteLength(value)}`);
		assert.equal(type.name, "nat");
		const limbs = [];
		for(let n = BigInt(value); n; n >>= 32n) limbs.push(`${n & 0xffffffffn}u`);
		return wrap(limbs.length ? `.data = (const uint32_t[]){${limbs.join(", ")}}, .length = ${limbs.length}` : "0");
	}
	if(type.kind === "array" || type.kind === "list") return wrap(value.length ? `.data = (const ${copy(type.element).name}[]){${value.map(item => payload(type.element, item, copy)).join(", ")}}, .length = ${value.length}` : "0");
	if(type.kind === "record") return wrap(type.fields.map((field, i) => `.${c.fields[i].name} = ${payload(field.type, value[field.name], copy)}`).join(", "));
	if(type.kind === "variant")
	{
		const index = type.cases.findIndex(branch => Object.hasOwn(value, branch.name)), branch = type.cases[index];
		const fields = branch.fields.map((field, i) => `.${c.cases[index].fields[i].name} = ${payload(field.type, value[branch.name][field.name], copy)}`).join(", ");
		return wrap(`.kind = ${index}, .cases.${c.cases[index].name} = {${fields || "0"}}`);
	}
	if(type.kind === "option") return wrap(value === null ? "0" : `.has_value = 1, .value = ${payload(type.element, value.some, copy)}`);
	if(type.kind === "result") return wrap(Object.hasOwn(value, "ok") ? `.is_ok = 1, .ok = ${payload(type.arguments[0], value.ok, copy)}` : `.is_ok = 0, .error = ${payload(type.arguments[1], value.error, copy)}`);
	assert.equal(type.kind, "tuple");
	return wrap(type.arguments.map((part, i) => `.${c.fields[i].name} = ${payload(part, value[i], copy)}`).join(", "));
};

test("compiled production Fin walks report exact field, case, branch and nested element paths", async t => {
	const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const nested = { kind: "array", element: { kind: "option", element: { kind: "list", element: finRecordSignatures.shapeSize[0], abi: heap }, abi: heap }, abi: heap };
	const model = finRecordCompilerModel({}, { ...finRecordSignatures, nested: [nested, finRecordNat] });
	const surface = surfaceOf(model), copy = type => surface.copy(nativeCReference(type));
	const bounds = [], functions = [];
	for(const entry of model.exports.filter(item => item.refinements?.parameters[0]))
	{
		const type = entry.parameters[0].type, name = entry.name.split(".").at(-1);
		const walk = finRefinementWalk({ refinement: entry.refinements.parameters[0], type, value: "arg0", constant: `bound_${name}`, label: "arg0", copy, bounds, reject: message => `return ${message};` });
		functions.push(`const char *check_${name}(const ${copy(type).name} *arg0) {\n${walk.join("\n")}\n  ++entered; return NULL;\n}`);
	}
	const tile = digit => ({ digit, count: 19 });
	const circle = radius => ({ circle: { radius } });
	const cases = [
		["nestSum", { inner: tile(5), tag: 3 }, "arg0.inner.digit", "5"]
		, ["nestSum", { inner: tile(4), tag: 3 }, "arg0.tag", "3"]
		, ["nestSum", { inner: tile(4), tag: 2 }]
		, ["lateSum", { label: "heap data", items: [1, 2, 3], digit: 5 }, "arg0.digit", "5"]
		, ["slotCount", { maybe: null, count: 1 }]
		, ["slotCount", { maybe: { some: 0 }, count: 1 }, "arg0.maybe?", "0"]
		, ["gateOpen", { closed: {} }]
		, ["gateOpen", { never: { value: 0 } }, "arg0.never.value", "0"]
		, ["shapeSize", circle(10), "arg0.circle.radius", "10"]
		, ["shapeSize", { label: { text: "inactive Fin" } }]
		, ["maybeShape", null]
		, ["maybeShape", { some: circle(10) }, "arg0?.circle.radius", "10"]
		, ["tilePair", [tile(5), circle(10)], "arg0.0.digit", "5"]
		, ["tilePair", [tile(4), circle(10)], "arg0.1.circle.radius", "10"]
		, ["tileExcept", { ok: tile(5) }, "arg0.ok.digit", "5"]
		, ["tileExcept", { error: circle(10) }, "arg0.error.circle.radius", "10"]
		, ["nested", [null, { some: [{ label: { text: "ok" } }, circle(9), circle(10)] }], "arg0[1]?[2].circle.radius", "10"]
		, ["nested", [null, { some: [] }, { some: [circle(9)] }]]
	];
	for(const name of ["tiles", "tileList"])
	{
		cases.push([name, []], [name, [tile(0), tile(4)]]);
		for(const index of [0, 1, 2]) cases.push([name, [0, 1, 2].map(i => tile(i === index ? 5 : 4)), `arg0[${index}].digit`, "5"]);
	}
	const checks = cases.map(([name, value, path, bound], i) => {
		const type = model.exports.find(item => item.name === `Sample.${name}`).parameters[0].type;
		return `{
  ${copy(type).name} value = ${payload(type, value, copy)};
  unsigned before = entered;
  const char *message = check_${name}(&value);
  ${path ? `assert(message && strcmp(message, ${cString(`${path} is not below its Fin ${bound} bound`)}) == 0); assert(entered == before);` : "assert(message == NULL); assert(entered == before + 1);"}
  ++checks; /* case ${i}: ${name} */
}`;
	});
	const generated = generateCopiedNativeCalls(model, surface);
	const comparison = generated.match(/static inline int lb_fin_below\([\s\S]*?\n\}/u)?.[0];
	assert.ok(comparison);
	const source = `#include "finrecords.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static unsigned entered;
${comparison}
${bounds.join("\n")}
${functions.join("\n")}
int main(void) { unsigned checks = 0;
${checks.join("\n")}
printf("fin-diagnostic-walk-ok:%u\\n", checks);
}
`;
	const header = generateCBindingPackage(model.bindingIr)["include/finrecords.h"];
	assert.equal((await (await compile(t, source, { "finrecords.h": header }))()).stdout, `fin-diagnostic-walk-ok:${cases.length}\n`);
});

test("generated ordinary calls, leased closures and host replies include indexed diagnostics only when needed", () => {
	for(const model of [finRecordCompilerModel(), finCallbackCompilerModel(), finReplyCompilerModel("FinReplies")])
	{
		const source = generateNativePrimitiveC(model, initializer);
		assert.equal((source.match(/#include <stdio.h>/gu) ?? []).length, 1);
		assert.match(source, /static _Thread_local char lb_fin_(?:\w+)_message\[/u);
		assert.match(source, /(?:arg0|callback result)\[%zu\](?:\.digit)? is not below its Fin/u);
	}
	const reply = generateNativePrimitiveC(finReplyCompilerModel("FinReplies"), initializer);
	assert.match(reply, /callback result\[%zu\] is not below its Fin 3 bound/u);
	assert.match(reply, /callback result\.digit\? is not below its Fin 5 bound/u);
	const plain = finRecordShape("Plain", [["digit", finRecordNat]]);
	const unrefined = generateNativePrimitiveC(finRecordCompilerModel({}, { plainSum: [plain, finRecordNat] }), initializer);
	assert.doesNotMatch(unrefined, /stdio.h|snprintf|_Thread_local/u);
});
