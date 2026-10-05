/**
 * Compile complete relocated Lake closures after verified Lean/C generation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, chmod, cp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { prepareLakeDependencySnapshot, readLakeDependencySnapshot, verifyLakeDependencySnapshot, writeLakeDependencySnapshot } from "../src/build/lake-dependency-snapshot.mjs";
import { prepareLakeGeneratorPrerequisites } from "../src/build/lake-generator-prerequisites.mjs";
import { prepareGeneratedLakeWorkspace, resolveGeneratedLakeWorkspace, validateGeneratedLakeResolution, validateGeneratedLakeWorkspace } from "../src/build/lake-generated-workspace.mjs";
import { validateLockedLakeResolution } from "../src/build/lake-workspace.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { generatedLakeWorkspaceFixture as fixture } from "./helpers/lake-generator.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const enabled = process.env.LEAN_BRIDGE_LAKE_GENERATOR_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const errorText = error => `${error.message}\n${JSON.stringify(error.details)}`;
const owned = async () => (await readdir(tmpdir())).filter(name => new RegExp(`^lean-bridge-generated-(workspace|resolution)-${process.pid}-`).test(name)).sort();
const prepare = async (t, context) => {
	const args = { snapshot: context.snapshot, modules: [context.names.root], leanPrefix };
	let prerequisites;
	try
	{ prerequisites = await prepareLakeGeneratorPrerequisites(args); }
	catch(error)
	{ throw new Error(errorText(error), { cause: error }); }
	t.after(prerequisites.dispose);
	return { ...args, prerequisites, expectedPrerequisitesSha256: prerequisites.sha256 };
};
const resolveGenerated = async (t, args) => {
	try
	{
		const result = await resolveGeneratedLakeWorkspace(args);
		t.after(result.dispose);
		return result;
	} catch(error)
	{ throw new Error(errorText(error), { cause: error }); }
};

for(const variant of ["shop", "telemetry"]) test(`${variant} resolves and compiles generated Lean/C from detached relocated captures`, { skip: !enabled }, async t => {
	const context = await fixture(t, variant), before = await lakeInputState(context.workspace);
	const relocated = join(context.directory, "relocated");
	await cp(context.workspace, relocated, { recursive: true });
	const other = await prepareLakeDependencySnapshot({ projectRoot: join(relocated, "project"), includeProject: true });
	const otherBefore = await lakeInputState(relocated), transport = join(context.directory, "transport");
	await writeLakeDependencySnapshot({ snapshot: context.snapshot, outputRoot: transport });
	context.snapshot = await readLakeDependencySnapshot({ snapshotRoot: transport, expectedSha256: context.snapshot.sha256 });
	const captureJson = canonicalJson(context.snapshot.document);
	await rename(context.workspace, join(context.directory, "detached"));
	await rename(relocated, join(context.directory, "detached-other"));
	const firstArgs = await prepare(t, context), secondArgs = await prepare(t, { ...context, snapshot: other });
	const first = await resolveGenerated(t, firstArgs), second = await resolveGenerated(t, secondArgs);
	assert.deepEqual(first.document, second.document);
	assert.deepEqual(first.overlay, second.overlay);
	assert.equal(first.sha256, second.sha256);
	assert.equal(JSON.stringify(first.document).includes(context.directory), false);
	assert.equal(canonicalJson(context.snapshot.document), captureJson);
	await verifyLakeDependencySnapshot({ snapshot: context.snapshot, snapshotRoot: transport });
	await assert.rejects(() => verifyLakeDependencySnapshot({ snapshot: context.snapshot, snapshotRoot: first.workspaceRoot }), /differ from the prepared identity/);
	const resolution = first.document.result.resolution;
	assert.deepEqual(resolution.modules.map(module => module.module), ["Extra", "Generated", context.names.remote, context.names.local, context.names.root]);
	assert.equal(resolution.schemaVersion, 2);
	assert.deepEqual(resolution.modules[1].source.origin, { kind: "generated", generator: "root/table", receiptSha256: firstArgs.prerequisites.results[0].sha256 });
	assert.deepEqual(resolution.modules[0].source.origin, { kind: "captured", snapshotSha256: context.snapshot.sha256 });
	assert.equal(resolution.modules.at(-1).nativeInputs[0].source.origin.kind, "generated");
	assert.equal(Object.isFrozen(resolution.modules[1].source.origin), true);
	await assertJsonSchema("lake-generated-workspace", first.overlay);
	await assertJsonSchema("lake-generated-resolution", first.document);
	const validate = (document, expectedSha256 = sha256(canonicalJson(document))) => validateGeneratedLakeResolution(document, {
		snapshot: context.snapshot, modules: firstArgs.modules, catalog: first.catalog
		, prerequisites: firstArgs.prerequisites.document
		, expectedPrerequisitesSha256: firstArgs.expectedPrerequisitesSha256
		, overlay: first.overlay
		, expectedOverlaySha256: first.document.overlaySha256, expectedSha256
	});
	assert.equal(validate(first.document, first.sha256), true);
	assert.throws(() => validate(first.document, "0".repeat(64)), /authorized identity/);
	assert.throws(() => validateLockedLakeResolution({ snapshot: context.snapshot, modules: firstArgs.modules, resolution: first.document }), /Invalid recorded Lake resolution fields/);
	for(const change of [
		doc => { doc.result.generators = []; }
		, doc => { doc.result.generators.push("root/unused"); }
		, doc => { doc.result.resolution.modules[1].source.origin.kind = "captured"; }
		, doc => { doc.result.resolution.modules[1].source.sha256 = "0".repeat(64); }
		, doc => { doc.result.resolution.modules[1].source.origin.receiptSha256 = "0".repeat(64); }
		, doc => { doc.result.resolution.modules[1].source.origin.generator = "root/unused"; }
		, doc => { doc.result.resolution.modules[0].source.origin.snapshotSha256 = "0".repeat(64); }
		, doc => { doc.result.resolution.modules[1].path = "root/absent.lean"; }
		, doc => { doc.result.resolution.modules[1].package = context.names.local; }
		, doc => { doc.result.resolution.modules.at(-1).nativeInputs[0].source.origin.generator = "root/unused"; }
		, doc => { doc.result.resolution.modules.reverse(); }
		, doc => { doc.result.resolution.modules[0].imports.push(context.names.root); }
		, doc => { doc.result.resolution.externalImports.push("Unrelated"); }
		, doc => { doc.result.resolution.packages[0].dependencies = ["Absent"]; }
		, doc => { doc.result.resolution.leanCommit = "0".repeat(40); }
		, doc => { doc.result.resolution.modules[0].extra = "undeclared"; }
		, doc => { doc.resolverSha256 = "0".repeat(64); }
		, doc => { doc.overlaySha256 = "0".repeat(64); }
		, doc => { doc.prerequisitesSha256 = "0".repeat(64); }
	]) {
		const invalid = structuredClone(first.document); change(invalid);
		assert.throws(() => validate(invalid), undefined, String(change));
	}
	// Compile the entire resolved order into a separate directory. No author/cache paths.
	const consumer = join(context.directory, "consumer"), lean = join(leanPrefix, "bin/lean");
	await mkdir(consumer);
	const env = { PATH: join(leanPrefix, "bin"), LEAN_SYSROOT: leanPrefix, LEAN_PATH: consumer };
	for(const module of resolution.modules)
		await processBuildRunner.capture({ command: lean, args: ["-R", first.sourceRoot, "-o", join(consumer, `${module.module}.olean`), `${module.module}.lean`], cwd: first.sourceRoot, env });
	await saveLakeFile(consumer, "Consumer.lean", `import ${context.names.root}\ndef main : IO Unit := IO.println (${context.names.root}.${context.names.operation} 10)\n`);
	assert.equal((await processBuildRunner.capture({ command: lean, args: ["--run", join(consumer, "Consumer.lean")], cwd: consumer, env })).stdout.trim(), variant === "shop" ? "45" : "67");
	await saveLakeFile(consumer, "consumer.c", '#include <stdio.h>\nunsigned generated_value(void);\nint main(void) { printf("%u", generated_value()); }\n');
	await processBuildRunner.capture({ command: "cc", args: [join(first.workspaceRoot, "root/native/generated.c"), join(consumer, "consumer.c"), "-o", join(consumer, "consumer")] });
	assert.equal((await processBuildRunner.capture({ command: join(consumer, "consumer"), args: [] })).stdout, variant === "shop" ? "17" : "29");
	// Copied workspace verification remains valid after disposing its producer.
	await firstArgs.prerequisites.dispose();
	await first.verify(); await second.verify();
	assert.deepEqual(await lakeInputState(join(context.directory, "detached")), before);
	assert.deepEqual(await lakeInputState(join(context.directory, "detached-other")), otherBefore);
	t.diagnostic(JSON.stringify({ variant, snapshot: context.snapshot.sha256, prerequisites: firstArgs.expectedPrerequisitesSha256, overlay: first.document.overlaySha256, resolution: first.sha256 }));
	await chmod(join(first.sourceRoot, "Generated.lean"), 0o644);
	await writeFile(join(first.sourceRoot, "Generated.lean"), "changed\n");
	await assert.rejects(first.verify, /Source identity|Source bytes/);
	const paths = [dirname(first.sourceRoot), dirname(first.workspaceRoot)];
	await first.dispose(); await first.dispose();
	for(const path of paths) await assert.rejects(access(path), { code: "ENOENT" });
});

test("generated staging rejects false origins, drift, symlinks, extra files and cancellation", { skip: !enabled }, async t => {
	const context = await fixture(t), args = await prepare(t, context), initial = await owned();
	await assert.rejects(() => prepareGeneratedLakeWorkspace({ ...args, expectedPrerequisitesSha256: "0".repeat(64) }), /expected identity/);
	const overlay = await prepareGeneratedLakeWorkspace(args);
	t.after(overlay.dispose);
	const validate = (document, expectedSha256 = sha256(canonicalJson(document))) => validateGeneratedLakeWorkspace(document, {
		...args, prerequisites: args.prerequisites.document
		, catalog: overlay.catalog, expectedSha256
	});
	assert.equal(validate(overlay.document, overlay.sha256), true);
	assert.throws(() => validate(overlay.document, "0".repeat(64)), /expected identity/);
	for(const change of [
		doc => { doc.outputs.pop(); }
		, doc => { doc.outputs[0].path = "root/Shop.lean"; }
		, doc => { doc.outputs[0].generator = "root/unused"; }
		, doc => { doc.outputs[0].receiptSha256 = "0".repeat(64); }
		, doc => { doc.outputs[0].mode = 0o755; }
		, doc => { doc.snapshotSha256 = "0".repeat(64); }
		, doc => { doc.command = "sh"; }
	]) {
		const invalid = structuredClone(overlay.document); change(invalid);
		assert.throws(() => validate(invalid), /output origins/);
	}
	for(const path of ["root/generated/Generated.lean", "root/native/generated.c", "root/native/generated.h", "root/Shop.lean", "lake-dependency-snapshot.json"])
	{
		const full = join(overlay.workspaceRoot, path), original = await readFile(full);
		await chmod(full, 0o644); await writeFile(full, "changed\n");
		await assert.rejects(overlay.verify, /Source identity|Source bytes/);
		await writeFile(full, original); await chmod(full, 0o444);
		await overlay.verify();
	}
	const output = join(overlay.workspaceRoot, "root/generated/Generated.lean"), backup = join(context.directory, "generated-backup");
	await rename(output, backup); await symlink(backup, output);
	await assert.rejects(overlay.verify, /file type changed/);
	await rm(output); await rename(backup, output);
	const generatedDirectory = dirname(output), moved = join(context.directory, "generated-directory");
	await rename(generatedDirectory, moved); await symlink(moved, generatedDirectory);
	await assert.rejects(overlay.verify, /Unexpected generated workspace file/);
	await rm(generatedDirectory); await rename(moved, generatedDirectory);
	await mkdir(join(overlay.workspaceRoot, "extra"));
	await assert.rejects(overlay.verify, /Unexpected or symlinked/);
	await rm(join(overlay.workspaceRoot, "extra"), { recursive: true });
	await writeFile(join(overlay.workspaceRoot, "root/extra.lean"), "");
	await assert.rejects(overlay.verify, /Unexpected generated workspace file/);
	await rm(join(overlay.workspaceRoot, "root/extra.lean"));
	await chmod(output, 0o555);
	await assert.rejects(overlay.verify, /mode changed/);
	await chmod(output, 0o444);
	await overlay.verify();
	await overlay.dispose();
	const signal = AbortSignal.abort(new Error("cancelled staging"));
	await assert.rejects(() => resolveGeneratedLakeWorkspace({ ...args, signal }), /cancelled staging/);
	const controller = new AbortController();
	const cancelling = { ...args.prerequisites, verify: async () => { controller.abort(new Error("cancelled during staging")); } };
	await assert.rejects(() => prepareGeneratedLakeWorkspace({ ...args, prerequisites: cancelling, signal: controller.signal }), /cancelled during staging/);
	assert.deepEqual(await owned(), initial);
});

test("generated imports cannot add prerequisites, disappear, or form cycles", { skip: !enabled }, async t => {
	const cases = [
		["new prerequisite", async context => { context.lakefile = context.lakefile.replace("lean_lib Extra\n", "lean_lib Extra where\n  needs := #[.packageTarget .anonymous `unused]\n"); }, /changed the selected Lake prerequisites/]
		, ["cycle", async context => { context.tool = context.tool.replace("import Extra\\n", `import ${context.names.root}\\n`); }, /Cyclic Lake module imports/]
		, ["missing import", async context => { context.tool = context.tool.replace("import Extra\\n", "import MissingGeneratedDependency\\n"); }, /MissingGeneratedDependency|unknown module prefix/]
		, ["missing generated producer"
			, async context => {
			context.lakefile = context.lakefile.replace("lean_lib Extra\n", 'lean_lib Extra\nlean_lib Unused where\n  srcDir := "generated"\n');
			context.tool = context.tool.replace("import Extra\\n", "import Unused\\n");
			}
			, /no such file|does not exist|uncaptured input|Uncaptured/]
	];
	for(const [label, change, pattern] of cases) await t.test(label, async t => {
		const context = await fixture(t); await change(context);
		await saveLakeFile(context.root, "tools/TableGenerator.lean", context.tool);
		await saveLakeFile(context.root, "lakefile.lean", context.lakefile);
		context.snapshot = await prepareLakeDependencySnapshot({ projectRoot: context.root, includeProject: true });
		const args = await prepare(t, context), initial = await owned();
		await assert.rejects(() => resolveGeneratedLakeWorkspace(args), error => pattern.test(errorText(error)));
		assert.deepEqual(await owned(), initial);
		await args.prerequisites.verify();
	});
});

test("unselected native outputs stay absent and selected C inputs require their producer", { skip: !enabled }, async t => {
	const context = await fixture(t);
	await saveLakeFile(context.root, "lakefile.lean", `${context.lakefile}lean_lib Plain\n`);
	await saveLakeFile(context.root, "Plain.lean", "def Plain.value : UInt32 := 3\n");
	context.snapshot = await prepareLakeDependencySnapshot({ projectRoot: context.root, includeProject: true });
	const args = await prepare(t, { ...context, names: { ...context.names, root: "Plain" } });
	const result = await resolveGenerated(t, args);
	assert.deepEqual(result.overlay.outputs, []);
	assert.deepEqual(result.document.result.generators, []);
	assert.deepEqual(result.document.result.resolution.modules.map(module => module.module), ["Plain"]);
	await assert.rejects(access(join(result.workspaceRoot, "root/native/generated.c")), { code: "ENOENT" });
	await result.verify();
	await saveLakeFile(context.root, "lakefile.lean", context.lakefile.replace("  needs := #[.packageTarget .anonymous `table]\n", ""));
	await saveLakeFile(context.root, "Shop.lean", "def Shop.quote (value : UInt32) : UInt32 := value\n");
	const snapshot = await prepareLakeDependencySnapshot({ projectRoot: context.root, includeProject: true });
	await assert.rejects(() => prepareLakeGeneratorPrerequisites({ snapshot, modules: ["Shop"], leanPrefix }), error => /native input requires a selected Lake prerequisite/.test(errorText(error)));
});
