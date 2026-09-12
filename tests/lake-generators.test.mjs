/**
 * Compile pure Lean generators from captured sources without touching author files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, chmod, cp, lstat, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { prepareLakeDependencySnapshot } from "../src/build/lake-dependency-snapshot.mjs";
import { runLakeGenerator, validateLakeGeneratorReceipt } from "../src/build/lake-generators.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { lakeGeneratorFixture as fixture } from "./helpers/lake-generator.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const enabled = process.env.LEAN_BRIDGE_LAKE_GENERATOR_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const errorText = error => `${error.message}\n${JSON.stringify(error.details)}`;

for(const variant of ["shop", "telemetry"]) test(`${variant} generates identical relocated Lean/header outputs and compiles them`, { skip: !enabled }, async t => {
	const context = await fixture(t, variant), before = await lakeInputState(context.workspace);
	const relocated = join(context.directory, "relocated");
	await cp(context.workspace, relocated, { recursive: true });
	const secondSnapshot = await prepareLakeDependencySnapshot({ projectRoot: join(relocated, "project"), includeProject: true });
	const relocatedBefore = await lakeInputState(relocated);
	await rename(context.workspace, join(context.directory, "detached"));
	await rename(relocated, join(context.directory, "detached-relocated"));
	let first, second;
	try
	{
		first = await runLakeGenerator({ snapshot: context.snapshot, definition: context.definition, leanPrefix });
		t.after(first.dispose);
		second = await runLakeGenerator({ snapshot: secondSnapshot, definition: context.definition, leanPrefix });
		t.after(second.dispose);
	} catch(error)
	{ throw new Error(errorText(error), { cause: error }); }
	assert.deepEqual(first.document, second.document);
	assert.equal(validateLakeGeneratorReceipt(first.document, { snapshot: context.snapshot, definition: context.definition }), true);
	await assertJsonSchema("lake-generator-receipt", first.document);
	assert.equal(Object.isFrozen(first.document.outputs[0]), true);
	assert.ok(first.document.artifacts.some(file => file.path === "TableGenerator.olean"));
	assert.equal(first.sha256, second.sha256);
	t.diagnostic(JSON.stringify({ variant, snapshot: context.snapshot.sha256, receipt: first.sha256, outputs: first.document.outputs }));
	assert.equal(JSON.stringify(first.document).includes(context.directory), false);
	const expected = variant === "shop" ? "17" : "29";
	assert.equal(await readFile(join(first.outputRoot, "root/generated/Generated.lean"), "utf8"), `def Generated.value : UInt32 := ${expected}\n`);
	const consumerRoot = join(context.directory, "consumer");
	await saveLakeFile(consumerRoot, "Consumer.lean", "import Generated\ndef main : IO Unit := IO.println Generated.value\n");
	const generatedRoot = join(first.outputRoot, "root/generated");
	await processBuildRunner.capture({ command: join(leanPrefix, "bin/lean")
		, args: ["-R", generatedRoot, "-o", join(consumerRoot, "Generated.olean"), "Generated.lean"]
		, cwd: generatedRoot });
	const result = await processBuildRunner.capture({ command: join(leanPrefix, "bin/lean")
		, args: ["--run", join(consumerRoot, "Consumer.lean")]
		, cwd: consumerRoot
		, env: { ...process.env, LEAN_PATH: consumerRoot } });
	assert.equal(result.stdout.trim(), expected);
	await saveLakeFile(consumerRoot, "consumer.c", '#include "generated.h"\n#include <stdio.h>\nint main(void) { printf("%u", GENERATED_VALUE); }\n');
	await processBuildRunner.capture({ command: "cc", args: ["-I", join(first.outputRoot, "root/native"), join(consumerRoot, "consumer.c"), "-o", join(consumerRoot, "consumer")] });
	assert.equal((await processBuildRunner.capture({ command: join(consumerRoot, "consumer"), args: [] })).stdout, expected);
	assert.deepEqual(await lakeInputState(join(context.directory, "detached")), before);
	assert.deepEqual(await lakeInputState(join(context.directory, "detached-relocated")), relocatedBefore);
	for(const change of [
		document => { document.snapshotSha256 = "0".repeat(64); }
		, document => { document.definition.arguments = ["changed"]; }
		, document => { document.driverSha256 = "0".repeat(64); }
		, document => { document.inputs[0].source.sha256 = "0".repeat(64); }
		, document => { document.outputs[0].path = "root/Extra.lean"; }
		, document => { document.artifacts[0].path = "../escape.ir"; }
		, document => { document.modules[0].interface.sha256 = "0".repeat(64); }
		, document => { document.artifacts.push(document.artifacts[0]); }
		, document => { document.outputs[0].mode = 493; }
		, document => { document.compiler.libraries.files = 0; }
		, document => { document.compiler.version = "Lean (version 0.0.0, test)"; }
		, document => { document.checker.command = "sh"; }
		, document => { document.requestSha256 = "invalid"; }
	]) {
		const document = structuredClone(first.document);
		change(document);
		assert.throws(() => validateLakeGeneratorReceipt(document, { snapshot: context.snapshot, definition: context.definition }), { code: "invalid-lake-generator" });
	}
	const working = dirname(first.outputRoot);
	for(const path of ["source/TableGenerator.lean", "olean/TableGenerator.olean", "input.json", "check.json", "source/LeanBridgeGeneratorMain.lean", `output/${first.document.outputs[0].path}`])
	{
		const target = join(working, path), original = await readFile(target), mode = (await lstat(target)).mode & 0o777;
		await chmod(target, 0o644);
		await writeFile(target, "changed file\n");
		await assert.rejects(first.verify, { code: "lake-generator-drift" });
		await writeFile(target, original);
		await chmod(target, mode);
	}
	for(const path of ["olean/TableGenerator.ir", "output/root/native/undeclared.h"])
	{
		await saveLakeFile(working, path, "undeclared file\n");
		await assert.rejects(first.verify, { code: "lake-generator-drift" });
		await rm(join(working, path));
	}
	await symlink(join(working, "input.json"), join(first.outputRoot, "linked.h"));
	await assert.rejects(first.verify, /regular files without symlinks/);
	await rm(join(first.outputRoot, "linked.h"));
	await first.dispose();
	await assert.rejects(access(working), { code: "ENOENT" });
});

test("fresh generator checking rejects unreviewed implementations and invalid declarations", { skip: !enabled }, async t => {
	// Lean kernel-checks a nonrecursive `partial def` as an ordinary definition.
	// The partial case must recurse to test the elaborated implementation gate.
	const cases = [
		["unsafe", "unsafe def TableGenerator.generate (_ : Array (String × String)) (_ : Array String) : Except String (Array (String × String)) := .ok #[]\n", /reviewed unsafe|unsafe or partial/]
		, ["foreign", '@[extern "unreviewed"]\nopaque TableGenerator.generate (_ : Array (String × String)) (_ : Array String) : Except String (Array (String × String))\n', /foreign implementation contract/]
		, ["sorry", "def TableGenerator.generate (_ : Array (String × String)) (_ : Array String) : Except String (Array (String × String)) := by sorry\n", /depends on sorry/]
		, ["IO", "def TableGenerator.generate (_ : Array (String × String)) (_ : Array String) : IO (Array (String × String)) := pure #[]\n", /type mismatch|Type mismatch/]
		, ["recursive partial", "partial def TableGenerator.generate (inputs : Array (String × String)) (args : Array String) : Except String (Array (String × String)) := if args.isEmpty then .ok #[] else TableGenerator.generate inputs args.pop\n", /partial or foreign implementation contract/]
		, ["implemented_by", "def TableGenerator.fast (_ : Array (String × String)) (_ : Array String) : Except String (Array (String × String)) := .ok #[]\n@[implemented_by TableGenerator.fast]\ndef TableGenerator.generate (_ : Array (String × String)) (_ : Array String) : Except String (Array (String × String)) := .ok #[]\n", /foreign implementation contract/]
		, ["axiom", "axiom TableGenerator.generate : Array (String × String) → Array String → Except String (Array (String × String))\n", /not an executable definition/]
		, ["protected", "protected def TableGenerator.generate (_ : Array (String × String)) (_ : Array String) : Except String (Array (String × String)) := .ok #[]\n", /nonpublic export/]
		, ["transitive foreign", 'import GeneratorSupport\n@[extern "unreviewed"]\nopaque TableGenerator.foreign : String → String\ndef TableGenerator.generate (_ : Array (String × String)) (_ : Array String) : Except String (Array (String × String)) := .ok #[("lean", TableGenerator.foreign "bad"), ("header", "")]\n', /foreign implementation contract/]
		, ["undeclared results", 'def TableGenerator.generate (_ : Array (String × String)) (_ : Array String) : Except String (Array (String × String)) := .ok #[("unexpected", "bad")]\n', /differ from the declared outputs/]
	];
	for(const [label, source, pattern] of cases)
		await t.test(label, async t => {
			const context = await fixture(t);
			await saveLakeFile(context.root, "tools/TableGenerator.lean", source);
			const snapshot = await prepareLakeDependencySnapshot({ projectRoot: context.root, includeProject: true });
			let working;
			const runner = { capture: options => { working = dirname(options.cwd); return processBuildRunner.capture(options); } };
			await assert.rejects(() => runLakeGenerator({ snapshot, definition: context.definition, leanPrefix, runner }), error => pattern.test(errorText(error)));
			assert.ok(working);
			await assert.rejects(access(working), { code: "ENOENT" });
		});
});

test("generator checking refuses compiler-owned declarations", { skip: !enabled }, async t => {
	const context = await fixture(t);
	context.definition.declaration = "Array.size";
	await assert.rejects(() => runLakeGenerator({ snapshot: context.snapshot, definition: context.definition, leanPrefix }), error => /outside selected modules/.test(errorText(error)));
});

test("generator cancellation removes staging and subprocesses receive a closed environment", { skip: !enabled }, async t => {
	const context = await fixture(t), controller = new AbortController();
	let working;
	const runner = { capture: options => {
		working = dirname(options.cwd);
		assert.deepEqual(Object.keys(options.env).sort(), ["LANG", "LC_ALL", "LEAN_PATH", "LEAN_SRC_PATH", "LEAN_SYSROOT", "PATH"]);
		controller.abort(new Error("generator test cancellation"));
		return processBuildRunner.capture(options);
	} };
	await assert.rejects(() => runLakeGenerator({ snapshot: context.snapshot, definition: context.definition, leanPrefix, runner, signal: controller.signal }), { code: "build-cancelled" });
	await assert.rejects(access(working), { code: "ENOENT" });
});

test("generator rejects interface drift before releasing output and removes staging", { skip: !enabled }, async t => {
	const context = await fixture(t);
	let working;
	const runner = { capture: async options => {
		working = dirname(options.cwd);
		const result = await processBuildRunner.capture(options);
		if(options.args[0] === "--run" && options.args[1].endsWith("LeanBridgeGeneratorMain.lean"))
			await writeFile(join(working, "olean/TableGenerator.olean"), "changed after execution\n");
		return result;
	} };
	await assert.rejects(() => runLakeGenerator({ snapshot: context.snapshot, definition: context.definition, leanPrefix, runner }), { code: "lake-generator-drift" });
	await assert.rejects(access(working), { code: "ENOENT" });
});
