/**
 * Resolve real Lake prerequisites and execute only their captured pure tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, chmod, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { prepareLakeDependencySnapshot, writeLakeDependencySnapshot } from "../src/build/lake-dependency-snapshot.mjs";
import { prepareLakeGeneratorPrerequisites, readLakeGeneratorRecipes, validateLakeGeneratorSelection, validateLakeGeneratorPrerequisiteReceipt } from "../src/build/lake-generator-prerequisites.mjs";
import { resolveGeneratedLakeWorkspace } from "../src/build/lake-generated-workspace.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { lakeGeneratorPrerequisiteFixture as fixture } from "./helpers/lake-generator.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const enabled = process.env.LEAN_BRIDGE_LAKE_GENERATOR_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const errorText = error => `${error.message}\n${JSON.stringify(error.details)}`;

for(const variant of ["shop", "telemetry"]) test(`${variant} selects a Lake prerequisite and produces identical relocated outputs`, { skip: !enabled }, async t => {
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
		first = await prepareLakeGeneratorPrerequisites({ snapshot: context.snapshot, modules: [context.names.root], leanPrefix });
		t.after(first.dispose);
		second = await prepareLakeGeneratorPrerequisites({ snapshot: secondSnapshot, modules: [context.names.root], leanPrefix });
		t.after(second.dispose);
	} catch(error)
	{ throw new Error(errorText(error), { cause: error }); }
	assert.deepEqual(first.document, second.document);
	assert.equal(first.sha256, second.sha256);
	assert.equal(JSON.stringify(first.document).includes(context.directory), false);
	assert.deepEqual(first.document.selection.generators.map(generator => generator.key), ["root/table"]);
	assert.deepEqual(first.results[0].document.definition, context.definition);
	assert.equal(Object.isFrozen(first.document.selection.generators[0].modules[0]), true);
	await assertJsonSchema("lake-generator-prerequisite-receipt", first.document);
	const snapshotRoot = join(context.directory, "catalog");
	await writeLakeDependencySnapshot({ snapshot: context.snapshot, outputRoot: snapshotRoot });
	const catalog = await readLakeGeneratorRecipes({ snapshot: context.snapshot, snapshotRoot });
	const validate = (document, digest = sha256(canonicalJson(document))) => validateLakeGeneratorPrerequisiteReceipt(document, { snapshot: context.snapshot, modules: [context.names.root], catalog, expectedSha256: digest });
	assert.equal(validate(first.document, first.sha256), true);
	assert.throws(() => validate(first.document, "0".repeat(64)), /expected identity/);
	for(const change of [
		document => { document.requestedModules = ["Other"]; }
		, document => { document.configurations = []; }
		, document => { document.snapshotSha256 = "0".repeat(64); }
		, document => { document.leanCompilerSha256 = "0".repeat(64); }
		, document => { document.lakeLibrarySha256 = "invalid"; }
		, document => { document.generators = []; }
		, document => { document.generators[0].sha256 = "0".repeat(64); }
		, document => { document.generators[0].key = "root/unused"; }
		, document => { document.selection.generators[0].module = "Other"; }
		, document => { document.selection.generators[0].modules.reverse(); }
		, document => { document.selection.generators[0].modules[0].package = "absent"; }
		, document => { document.selection.generators[0].modules[0].path = "root/absent.lean"; }
		, document => { document.selection.generators[0].modules[0].nativeInputs = []; }
		, document => { document.selection.generators[0].externalImports.push("Unused"); }
		, document => { document.selection.generators.push(document.selection.generators[0]); }
		, document => { document.selection.packages[0].configFile = "root/absent.lean"; }
		, document => { document.selection.leanVersion = "0.0.0"; }
		, document => { document.command = "sh"; }
	]) {
		const document = structuredClone(first.document);
		change(document);
		assert.throws(() => validate(document), { code: "invalid-lake-generator-selection" });
	}
	assert.deepEqual(validateLakeGeneratorSelection({ snapshot: context.snapshot, recipes: catalog.recipes, selection: first.document.selection }).map(entry => entry.key), ["root/table"]);
	const expected = variant === "shop" ? "17" : "29";
	const consumerRoot = join(context.directory, "consumer"), generatedRoot = join(first.results[0].outputRoot, "root/generated");
	await saveLakeFile(consumerRoot, "Consumer.lean", "import Generated\ndef main : IO Unit := IO.println Generated.value\n");
	await processBuildRunner.capture({ command: join(leanPrefix, "bin/lean")
		, args: ["-R", generatedRoot, "-o", join(consumerRoot, "Generated.olean"), "Generated.lean"]
		, cwd: generatedRoot });
	const result = await processBuildRunner.capture({ command: join(leanPrefix, "bin/lean")
		, args: ["--run", join(consumerRoot, "Consumer.lean")]
		, cwd: consumerRoot, env: { ...process.env, LEAN_PATH: consumerRoot } });
	assert.equal(result.stdout.trim(), expected);
	await saveLakeFile(consumerRoot, "consumer.c", '#include "generated.h"\n#include <stdio.h>\nint main(void) { printf("%u", GENERATED_VALUE); }\n');
	await processBuildRunner.capture({ command: "cc", args: ["-I", join(first.results[0].outputRoot, "root/native"), join(consumerRoot, "consumer.c"), "-o", join(consumerRoot, "consumer")] });
	assert.equal((await processBuildRunner.capture({ command: join(consumerRoot, "consumer"), args: [] })).stdout, expected);
	assert.deepEqual(await lakeInputState(join(context.directory, "detached")), before);
	assert.deepEqual(await lakeInputState(join(context.directory, "detached-relocated")), relocatedBefore);
	await assert.rejects(access(join(context.directory, "detached/project/hook-ran")), { code: "ENOENT" });
	t.diagnostic(JSON.stringify({ variant, snapshot: context.snapshot.sha256, receipt: first.sha256, generator: first.results[0].sha256 }));
	const generated = join(first.results[0].outputRoot, "root/generated/Generated.lean");
	await chmod(generated, 0o644);
	await writeFile(generated, "changed output\n");
	await assert.rejects(first.verify, { code: "lake-generator-drift" });
	const owned = first.results.map(result => dirname(result.outputRoot));
	await first.dispose();
	await first.dispose();
	for(const root of owned) await assert.rejects(access(root), { code: "ENOENT" });
});

test("Lake generator selection rejects undeclared, unowned and cyclic prerequisites", { skip: !enabled }, async t => {
	const cases = [
		["no recipe", context => { context.configuration.generators = []; }, /Unsupported Lake build target|No captured generator recipe/]
		, ["no prerequisite", context => { context.lakefile = context.lakefile.replace("  needs := #[.packageTarget .anonymous `table]", ""); }, /requires a selected Lake prerequisite/]
		, ["absent target", context => { context.configuration.generators[0].name = "missing"; }, /Unsupported Lake build target|No captured generator recipe/]
		, ["unlisted target", context => { context.lakefile += "target extra : Unit := pure (Job.pure ())\n"; }, /Unsupported Lake build target/]
		, ["facet", context => { context.lakefile = context.lakefile.replace(".packageTarget .anonymous `table]", ".facet (.packageTarget .anonymous `table) `olean]"); }, /unfaceted package target/]
		, ["tool cycle", context => { context.lakefile = context.lakefile.replace('lean_lib TableGenerator where\n  srcDir := "tools"', 'lean_lib TableGenerator where\n  srcDir := "tools"\n  needs := #[.packageTarget .anonymous `table]'); }, /depends on generation or native inputs/]
		, ["wrong tool owner", context => { context.configuration.generators[0].module = context.names.local; }, /belongs to another package/]
		, ["missing tool import", context => saveLakeFile(context.root, "tools/TableGenerator.lean", "import Uncaptured\n"), /Uncaptured|unknown module prefix/]
		, ["output collision", context => { context.configuration.generators[0].outputs[0].path = `${context.names.root}.lean`; }, /collides with a captured source/]
		, ["missing input", context => { context.configuration.generators[0].inputs[0].path = "absent.txt"; }, /input is not captured/]
		, ["input_file instead of custom target", context => { context.lakefile = context.lakefile.replace(/target table pkg : Unit := do\n(?: {2}.*\n){2}/, 'input_file table where\n  path := "data/value.txt"\n'); }, /requires a custom Lake target/]
		, ["transitive non-dependency", context => { context.lakefile = context.lakefile.replace(".packageTarget .anonymous `table]", ".packageTarget `Units `table]"); }, /not a direct declared dependency/]
		, ["unknown package", context => { context.lakefile = context.lakefile.replace(".packageTarget .anonymous `table]", ".packageTarget `Absent `table]"); }, /Missing generator package/]
		, ["package prerequisite cycle", context => { context.lakefile = context.lakefile.replace('  version := v!"1.0.0"', '  version := v!"1.0.0"\n  extraDepTargets := #[`table]'); }, /depends on generation or native inputs/]
		, ["tool native prerequisite"
			, async context => {
			context.lakefile = context.lakefile.replace("lean_lib GeneratorSupport", 'input_file nativeTool where\n  path := "native/tool.c"\nlean_lib GeneratorSupport').replace('lean_lib TableGenerator where\n  srcDir := "tools"', 'lean_lib TableGenerator where\n  srcDir := "tools"\n  moreLinkObjs := #[{ key := .packageTarget .anonymous `nativeTool }]');
			await saveLakeFile(context.root, "native/tool.c", "int unused(void) { return 1; }\n");
			}
			, /depends on generation or native inputs/]
	];
	for(const [label, change, pattern] of cases)
		await t.test(label, async t => {
			const context = await fixture(t);
			await change(context);
			await saveLakeFile(context.root, "lakefile.lean", context.lakefile);
			await saveLakeFile(context.root, "lean-bridge.exports.json", JSON.stringify(context.configuration));
			const snapshot = await prepareLakeDependencySnapshot({ projectRoot: context.root, includeProject: true });
			const before = await lakeInputState(context.workspace);
			await assert.rejects(() => prepareLakeGeneratorPrerequisites({ snapshot, modules: [context.names.root], leanPrefix }), error => {
				assert.match(errorText(error), pattern);
				return true;
			});
			assert.deepEqual(await lakeInputState(context.workspace), before);
		});
});

test("a selected dependency library owns its generator and ignores import order", { skip: !enabled }, async t => {
	const context = await fixture(t), { root, local, recipe, configuration, names } = context;
	const rootLake = context.lakefile.replace(/target table pkg : Unit := do\n(?: {2}.*\n){2}/, "")
		.replace('lean_lib GeneratorSupport where\n  srcDir := "tools"\nlean_lib TableGenerator where\n  srcDir := "tools"\nlean_lib Generated where\n  srcDir := "generated"\n', "")
		.replace("  needs := #[.packageTarget .anonymous `table]", "  extraDepTargets := #[]");
	configuration.generators = configuration.generators.filter(recipe => recipe.name === "unused");
	await saveLakeFile(root, "lean-bridge.exports.json", JSON.stringify(configuration));
	await saveLakeFile(root, "lakefile.lean", rootLake);
	const localToml = await readFile(join(local, "lakefile.toml"), "utf8");
	const revision = context.manifest.packages[1].rev;
	await rm(join(local, "lakefile.toml"));
	await saveLakeFile(local, "lakefile.lean", `import Lake
open Lake DSL
package ${names.local} where
  version := v!"1.0.0"
require ${names.remote} from git "https://example.invalid/locked/${names.remote}.git" @ "${revision}"
target table pkg : Unit := do
  IO.FS.writeFile (pkg.dir / "hook-ran") "dependency hook ran"
  pure (Job.pure ())
lean_lib GeneratorSupport where
  srcDir := "tools"
lean_lib TableGenerator where
  srcDir := "tools"
lean_lib Generated where
  srcDir := "generated"
lean_lib ${names.local} where
  extraDepTargets := #[\`table]
`);
	assert.ok(localToml.includes(revision));
	await saveLakeFile(local, "lean-bridge.exports.json", JSON.stringify({ schemaVersion: 1, generators: [recipe] }));
	for(const path of ["tools/GeneratorSupport.lean", "tools/TableGenerator.lean", "data/value.txt"])
		await saveLakeFile(local, path, await readFile(join(root, path)));
	context.manifest.packages[0].configFile = "lakefile.lean";
	await context.lock();
	const snapshot = await prepareLakeDependencySnapshot({ projectRoot: root, includeProject: true });
	const before = await lakeInputState(context.workspace);
	let result;
	try
	{ result = await prepareLakeGeneratorPrerequisites({ snapshot, modules: [names.root], leanPrefix }); }
	catch(error)
	{ throw new Error(errorText(error), { cause: error }); }
	t.after(result.dispose);
	assert.deepEqual(result.document.selection.generators.map(entry => [entry.key, entry.package]), [[`packages/${names.local}/table`, names.local]]);
	assert.equal(await readFile(join(result.results[0].outputRoot, `packages/${names.local}/generated/Generated.lean`), "utf8"), "def Generated.value : UInt32 := 17\n");
	const resolved = await resolveGeneratedLakeWorkspace({ snapshot
		, modules: [names.root], prerequisites: result
		, expectedPrerequisitesSha256: result.sha256, leanPrefix });
	t.after(resolved.dispose);
	const generated = resolved.document.result.resolution.modules.find(module => module.module === "Generated");
	assert.equal(generated.path, `packages/${names.local}/generated/Generated.lean`);
	assert.deepEqual(generated.source.origin, { kind: "generated", generator: `packages/${names.local}/table`, receiptSha256: result.results[0].sha256 });
	await resolved.verify();
	for(const pkg of ["root", `packages/${names.local}`])
		await assert.rejects(access(join(resolved.workspaceRoot, pkg, ".lake")), { code: "ENOENT" });
	const extra = join(resolved.workspaceRoot, `packages/${names.local}/.lake`);
	await mkdir(extra);
	await assert.rejects(resolved.verify, /Unexpected or symlinked generated workspace directory/);
	await rm(extra, { recursive: true });
	await resolved.verify();
	assert.deepEqual(await lakeInputState(context.workspace), before);
});

test("an unselected library does not execute its generator", { skip: !enabled }, async t => {
	const context = await fixture(t);
	await saveLakeFile(context.root, "lakefile.lean", `${context.lakefile}lean_lib Plain\n`);
	await saveLakeFile(context.root, "Plain.lean", "def Plain.value : UInt32 := 3\n");
	const snapshot = await prepareLakeDependencySnapshot({ projectRoot: context.root, includeProject: true });
	const result = await prepareLakeGeneratorPrerequisites({ snapshot, modules: ["Plain"], leanPrefix });
	t.after(result.dispose);
	assert.deepEqual(result.document.selection.generators, []);
	assert.deepEqual(result.results, []);
});
