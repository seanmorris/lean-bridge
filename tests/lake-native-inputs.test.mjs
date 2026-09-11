/**
 * Check C dependency parsing and the closed native compilation evidence contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { lakeNativeInputs, parseNativeDependencyFile, validateLakeNativeCompilation } from "../src/build/lake-native-inputs.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

test("C dependency rules preserve escaped filenames and remove only compiler line continuations", () => {
	assert.deepEqual(parseNativeDependencyFile("lean_bridge_native_input: /build/main.c \\\n /build/source\\ tree/header\\#1.h /build/cost$$.h /build/colon\\:x.h /build/main.c\n"), [
		"/build/main.c", "/build/source tree/header#1.h"
		, "/build/cost$.h", "/build/colon:x.h"
	]);
	assert.deepEqual(parseNativeDependencyFile("lean_bridge_native_input: a.c \\\r\n b.h\n"), ["a.c", "b.h"]);
	assert.deepEqual(parseNativeDependencyFile("lean_bridge_native_input: root/a\u00a0b.c root/c\u2003d.h\n"), ["root/a\u00a0b.c", "root/c\u2003d.h"]);
	for(const text of ["", "other: a.c", "lean_bridge_native_input:"
		, "lean_bridge_native_input: a.c\nother: b.h"
		, "lean_bridge_native_input: a$(bad).c"
		, "lean_bridge_native_input: a.c # comment"
		, "lean_bridge_native_input: a\\q.h"])
		assert.throws(() => parseNativeDependencyFile(text), { code: "lake-native-input-invalid" });
});

test("each captured C file compiles once even when several Lean modules refer to it", () => {
	const first = { path: "root/a.c" }, second = { path: "packages/p/b.c" };
	assert.deepEqual(lakeNativeInputs({ modules: [{ nativeInputs: [first, second] }, {}, { nativeInputs: [first] }] }), [second, first]);
});

const snapshotSha256 = "1".repeat(64), digest = "2".repeat(64);
const example = () => ({ schemaVersion: 1, profile: "native-library-v1"
	, snapshotSha256, flags: ["-O2", "-g0", "-fPIC", "-Werror=date-time"]
	, compiler: { bytes: 10, sha256: digest, version: "test compiler" }
	, objects: [{ source: "root/native.c", sourceSha256: digest
		, object: "0.o", bytes: 20, sha256: digest
		, inputs: [{ path: "snapshot/root/native.c", bytes: 5, sha256: digest }] }] });

test("C compilation metadata binds profile, compiler, objects, and the include closure", async () => {
	const expected = { snapshotSha256, profile: "native-library-v1" };
	validateLakeNativeCompilation(example(), expected);
	await assertJsonSchema("lake-native-compilation", example());
	for(const change of [
		value => { value.profile = "side-module-2"; }
		, value => { value.snapshotSha256 = "3".repeat(64); }
		, value => { value.flags.push("-I/unrecorded"); }
		, value => { value.extra = true; }
		, value => { value.compiler.version = ""; }
		, value => { value.objects = []; }
		, value => { value.objects[0].source = "../outside.c"; }
		, value => { value.objects[0].object = "../outside.o"; }
		, value => { value.objects[0].inputs[0].sha256 = "3".repeat(64); }
		, value => { value.objects[0].inputs.push(value.objects[0].inputs[0]); }
		, value => { value.objects[0].inputs[0].path = "system-0/../../outside.h"; }
	]) {
		const document = example();
		change(document);
		assert.throws(() => validateLakeNativeCompilation(document, expected), { code: "lake-native-input-invalid" });
	}
});
