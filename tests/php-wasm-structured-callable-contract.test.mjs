/**
 * Structured Zend callback ownership, admission and actual compiler checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { hasStructuredZendCallables } from "../src/backends/php/zend-callables.mjs";
import { copiedZendConversions } from "../src/backends/php/copied-zend-conversions.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { phpCallableSignatures } from "./helpers/php-callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("Zend admits all eight copied callback shapes at both integer widths", () => {
	for(const integerBits of [32, 64])
	{
		const ir = structuredCallableReviewedIr(), before = structuredClone(ir);
		const files = generateCopiedPhpZendAdapter(ir, { integerBits });
		const model = compileCopiedPhpModel(ir, { integerBits, structuredCallables: true, lists: true, variants: true });
		assert.deepEqual(ir, before);
		assert.deepEqual(files, generateCopiedPhpZendAdapter(before, { integerBits }));
		assert.equal(model.surface.functions.length, 26); assert.equal(model.surface.callbacks.size, 14);
		assert.equal(hasStructuredZendCallables(model), true);
		for(const shape of ["array", "list", "option", "result", "tuple", "record", "variant", "alias"])
			for(const action of ["call", "twice", "make"])
				assert.ok(files["src/Api.php"].includes(`function ${action}_${shape}(`));
		assert.doesNotMatch(files["src/Api.php"], /FFI|CData|json_encode|json_decode/u);
		assert.match(files["src/Api.php"], /function make_record\(mixed \$value0\): LeanClosure/u);
		const manifest = JSON.parse(files["copied-zend-manifest.json"]), c = files[`extension/${manifest.extension}.c`];
		assert.equal((c.match(/s->copy_buffers = 1;/gu) ?? []).length, 14);
		assert.equal((c.match(/s->copy_buffers = saved_copy_buffers;/gu) ?? []).length, 14);
		assert.equal((c.match(/if \(s->copy_buffers\)/gu) ?? []).length, 2);
		assert.match(c, /void \*data = lb_allocate\(s, out->length, 1\); if \(!data\) return 0;/u);
		assert.equal((c.match(/frame->success && !EG\(exception\) && !\*borrow->bailout/gu) ?? []).length, 14);
		assert.equal((c.match(/Zend call context exceeds the conversion limit/gu) ?? []).length, 40);
	}
});

test("primitive-only Zend packages keep their existing buffer and cleanup transport", () => {
	const ir = callableReviewedIr(phpCallableSignatures);
	const model = compileCopiedPhpModel(ir, { integerBits: 32 });
	assert.equal(hasStructuredZendCallables(model), false);
	const files = generateCopiedPhpZendAdapter(ir), manifest = JSON.parse(files["copied-zend-manifest.json"]);
	const c = files[`extension/${manifest.extension}.c`];
	assert.doesNotMatch(c, /copy_buffers|saved_copy_buffers/u);
	assert.match(c, /if \(out->length\) memcpy\(copy, out->data, out->length\); out->data = copy;/u);
});

test("shared Zend buffer converters do not require callable model metadata", () => {
	const copies = ["string", "bytes"].map((scalarName, index) => ({ scalarName, index, ctype: `test_${scalarName}` }));
	const model = { surface: { copies } };
	assert.doesNotMatch(copiedZendConversions(model), /copy_buffers/u);
	assert.equal((copiedZendConversions(model, { copyCallbackBuffers: true }).match(/if \(s->copy_buffers\)/gu) ?? []).length, 2);
});

test("Zend copied callbacks reject unowned nested identities, async delivery and recursive payloads", () => {
	for(const mutate of [
		ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
		, ir => { ir.types.find(type => type.callable).callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.callable).callable.resultMode = "promise"; }
		, ir => { const callback = ir.types.find(type => type.callable); callback.callable.result.type = { kind: "named", id: callback.id }; }
		, ir => { ir.types.find(type => type.kind === "record").fields[0].type = { kind: "named", id: ir.types.find(type => type.callable).id }; }
	]) {
		const ir = structuredCallableReviewedIr(); mutate(ir);
		assert.throws(() => generateCopiedPhpZendAdapter(ir));
	}
	assert.throws(() => generateCopiedPhpZendAdapter(structuredCallableReviewedIr({ recursive: true })), /acyclic/u);
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("structured Zend PHP and C pass their real parsers", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-structured-syntax-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateCopiedPhpZendAdapter(structuredCallableReviewedIr());
	for(const [path, source] of Object.entries(files))
	{
		await saveLakeFile(root, path, source);
		if(path.endsWith(".php")) await runCopied(php, ["-n", "-l", path], root);
	}
	const emcc = resolve(".toolchains/emsdk-php-wasm/upstream/emscripten/emcc"), sdk = resolve("build/php-wasm-sdk/php8.4-src");
	if(existsSync(emcc) && existsSync(sdk))
	{
		const manifest = JSON.parse(files["copied-zend-manifest.json"]);
		await runCopied(emcc, ["-fsyntax-only", "-Wall", "-Wextra", "-Werror"
			, "-Wno-unused-function", "-Wno-unused-parameter", "-Wno-type-limits"
			, ...[sdk, ...["Zend", "main", "TSRM", "ext"].map(path => join(sdk, path)), join(root, "include")].flatMap(path => ["-I", path])
			, `extension/${manifest.extension}.c`], root, process.env);
	}
});
