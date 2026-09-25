/**
 * Native PHP structured callable generation and independent Zend admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compilePhpPackageModel, generatePhpBindingPackage, renderPhpPackageLayout } from "../src/backends/php/generate.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("native PHP admits all eight acyclic copied callback shapes without changing the input contract", () => {
	const ir = structuredCallableReviewedIr(), before = structuredClone(ir);
	const model = compilePhpPackageModel(ir), files = renderPhpPackageLayout(model);
	assert.deepEqual(ir, before);
	assert.equal(model.copied.surface.functions.length, 26);
	assert.equal(model.copied.surface.callbacks.size, 14);
	assert.deepEqual(files, generatePhpBindingPackage(structuredClone(ir)));
	for(const shape of ["array", "list", "option", "result", "tuple", "record", "variant", "alias"])
		for(const action of ["call", "twice", "make"])
			assert.ok(files["src/Api.php"].includes(`function ${action}_${shape}(`), `${action}_${shape}`);
	assert.match(files["src/Api.php"], /callable\(list<Some<string>\|null>\): list<Some<string>\|null>/u);
	assert.match(files["src/Api.php"], /function make_record\(mixed \$value0\): LeanClosure/u);
	assert.doesNotMatch(files["src/Api.php"], /FFI|CData|json_encode|json_decode/u);
	assert.match(files["README.md"], /callback inputs and replies are independent copies/u);
	assert.doesNotMatch(files["README.md"], /Compound callbacks,|List callback payloads remain unsupported|No async or compound callables/u);
});

test("native PHP copied callbacks retain lease, effect, field-identity and recursive restrictions", () => {
	for(const mutate of [
		ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
		, ir => { ir.types.find(type => type.callable).callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.callable).callable.resultMode = "promise"; }
		, ir => { const callback = ir.types.find(type => type.callable); callback.callable.result.type = { kind: "named", id: callback.id }; }
		, ir => { ir.types.find(type => type.kind === "record").fields[0].type = { kind: "named", id: ir.types.find(type => type.callable).id }; }
	]) {
		const ir = structuredCallableReviewedIr(); mutate(ir);
		assert.throws(() => compilePhpPackageModel(ir));
	}
	assert.throws(() => compilePhpPackageModel(structuredCallableReviewedIr({ recursive: true })), /acyclic/u);
	assert.throws(() => compilePhpPackageModel(structuredCallableReviewedIr(), { integerBits: 32 }), /PHP-Wasm/u);
});

test("native PHP admission does not enable structured replies in either Zend width", () => {
	for(const integerBits of [32, 64])
		assert.throws(() => generateCopiedPhpZendAdapter(structuredCallableReviewedIr(), { integerBits }), /copied primitive/u);
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("native PHP structured public classes and scoped trampolines pass the actual PHP parser", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-structured-syntax-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generatePhpBindingPackage(structuredCallableReviewedIr());
	for(const [path, source] of Object.entries(files))
	{
		await saveLakeFile(root, path, source);
		if(path.endsWith(".php")) await runCopied(php, ["-n", "-l", path], root);
	}
	assert.match(files["src/Internal/Native.php"], /foreach \(\$frame->ids as \$id\) unset\(self::\$contexts\[\$id\]\)/u);
	assert.match(files["src/Internal/Native.php"], /\$scope->close\(\)/u);
});
