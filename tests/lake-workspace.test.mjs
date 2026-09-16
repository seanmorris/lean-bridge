/**
 * Resolve locked dependency closures using the real pinned Lean/Lake compiler.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, cp, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { captureLockedLakeProject, resolveLockedLakeWorkspace, validateLockedLakeResolution } from "../src/build/lake-workspace.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { stageCpanPackage, archiveCpanPackage } from "../src/release/cpan-package.mjs";
import { compileCpanXsVariant } from "../src/build/perl-xs.mjs";
import { installCpanArchive } from "../scripts/test-perl-package-consumer.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileLakeNativeInputs } from "../src/build/lake-native-inputs.mjs";
import { writeLakeDependencySnapshot } from "../src/build/lake-dependency-snapshot.mjs";
import { customLakeRoot, elaboratedLakeApi, lakeGit, lakeInputState, lakeWorkspaceFixture, nativeLakeInput, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertArchiveBytesEqual } from "./helpers/archive-bytes.mjs";

const enabled = process.env.LEAN_BRIDGE_LAKE_WORKSPACE_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const perl = process.env.LEAN_BRIDGE_TEST_PERL ?? "/usr/bin/perl";
const floor = process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38";
const errorText = error => `${error.message}\n${JSON.stringify(error.details)}`;
const capture = async root => captureLockedLakeProject({ projectRoot: root, inputs: (await analyzeLeanProject(root)).inputs });
const resolve = async (t, snapshot, modules) => {
	let result;
	try
	{ result = await resolveLockedLakeWorkspace({ snapshot, modules, leanPrefix }); }
	catch(error)
	{ throw new Error(errorText(error), { cause: error }); }
	t.after(result.dispose);
	return result;
};

for(const variant of ["shop", "telemetry"])
	test(`Lake resolves ${variant}'s locked transitive imports offline and without source writes`, { skip: !enabled }, async t => {
		const context = await lakeWorkspaceFixture(t, variant);
		const before = await lakeInputState(context.workspace);
		const snapshot = await capture(context.root);
		assert.equal(snapshot.document.schemaVersion, 2);
		const result = await resolve(t, snapshot, [context.names.root]);
		assert.deepEqual(result.document.modules.map(module => module.module), [context.names.remote, context.names.local, context.names.root]);
		assert.deepEqual(result.document.externalImports, ["Init"]);
		assert.equal(JSON.stringify(result.document).includes(context.directory), false);
		assert.equal(await readFile(join(result.sourceRoot, `${context.names.remote}.lean`), "utf8"), await readFile(join(context.cached, `lib/${context.names.remote}.lean`), "utf8"));
		assert.deepEqual(await lakeInputState(context.workspace), before);
		await cp(context.workspace, join(context.directory, "relocated"), { recursive: true });
		const relocated = await capture(join(context.directory, "relocated/project"));
		assert.deepEqual(relocated, snapshot);
		const second = await resolve(t, relocated, [context.names.root]);
		assert.deepEqual(second.document, result.document);
		assert.equal(second.sha256, result.sha256);
	});

test("Lake evaluates captured Lean configurations as well as TOML", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await rm(join(context.root, "lakefile.toml"));
	await saveLakeFile(context.root, "lakefile.lean", 'import Lake\nopen Lake DSL\npackage shop where\n  version := v!"1.0.0"\nrequire Catalog from "../local"\nlean_lib Shop\n');
	const result = await resolve(t, await capture(context.root), [context.names.root]);
	assert.equal(result.document.packages.find(pkg => pkg.name === "shop").configFile, "root/lakefile.lean");
});

test("Lake resolves nested root modules and same-package imports from a custom library directory", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await customLakeRoot(context);
	await saveLakeFile(context.root, "lean-src/Shop/Api.lean", "import Shop.Internal\nnamespace Shop\ndef quote (value : UInt32) : UInt32 := Shop.helper value\nend Shop\n");
	await saveLakeFile(context.root, "lean-src/Shop/Internal.lean", "import Catalog\ndef Shop.helper (value : UInt32) : UInt32 := Catalog.quote value + 1\n");
	await saveLakeFile(context.root, "lean-bridge.exports.json", JSON.stringify({ schemaVersion: 1, modules: ["Shop.Api"], exports: ["Shop.quote"] }));
	const result = await resolve(t, await capture(context.root), ["Shop.Api"]);
	assert.deepEqual(result.document.modules.map(module => [module.module, module.path]), [
		["Units", "packages/Units/lib/Units.lean"]
		, ["Catalog", "packages/Catalog/Catalog.lean"]
		, ["Shop.Internal", "root/lean-src/Shop/Internal.lean"]
		, ["Shop.Api", "root/lean-src/Shop/Api.lean"]
	]);
});

test("Lake resolves pinned Git subdirectory packages from the complete captured checkout", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await cp(context.cached, join(context.directory, "remote-copy"), { recursive: true });
	await cp(join(context.directory, "remote-copy"), join(context.cached, "nested"), { recursive: true, filter: path => !path.includes(".git") });
	await rm(join(context.cached, "lakefile.toml"));
	await rename(join(context.cached, "lib"), join(context.cached, "sibling-library"));
	await saveLakeFile(context.cached, "nested/lakefile.toml", 'name = "Units"\n[[lean_lib]]\nname = "Units"\nsrcDir = "../sibling-library"\n');
	await lakeGit(context.cached, "add", ".");
	await lakeGit(context.cached, "commit", "--quiet", "-m", "Subdirectory package");
	context.manifest.packages[1].rev = await lakeGit(context.cached, "rev-parse", "HEAD");
	context.manifest.packages[1].subDir = "nested";
	await context.lock();
	const result = await resolve(t, await capture(context.root), [context.names.root]);
	assert.equal(result.document.modules[0].path, "packages/Units/sibling-library/Units.lean");
});

test("Lake refuses to invent missing pins, even when the lock's package list is empty", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	context.manifest.packages = [];
	await context.lock();
	await assert.rejects(() => capture(context.root).then(snapshot => resolve(t, snapshot, [context.names.root])), /missing manifest/);
});

test("Lake rejects root Git configuration drift instead of overriding the lock silently", { skip: !enabled }, async t => {
	for(const [label, fields] of [
		["url", 'git = "https://example.invalid/changed.git"']
		, ["revision", 'git = "https://example.invalid/locked/Units.git"\nrev = "changed"']
		, ["subdirectory", 'git = "https://example.invalid/locked/Units.git"\nsubDir = "changed"']
	])
		await t.test(label, async t => {
			const context = await lakeWorkspaceFixture(t);
			const rev = label === "revision" ? "" : `\nrev = "${context.manifest.packages[1].inputRev}"`;
			await saveLakeFile(context.root, "lakefile.toml", `${await readFile(join(context.root, "lakefile.toml"), "utf8")}\n[[require]]\nname = "Units"\n${fields}${rev}\n`);
			await assert.rejects(() => capture(context.root).then(snapshot => resolve(t, snapshot, [context.names.root])), /manifest out of date|subdirectory changed/);
		});
});

test("Lake rejects native build targets without running their bodies", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await rm(join(context.root, "lakefile.toml"));
	await saveLakeFile(context.root, "lakefile.lean", 'import Lake\nopen Lake DSL\npackage shop\nrequire Catalog from "../local"\nlean_lib Shop\ntarget native pkg : Unit := do\n  IO.FS.writeFile (pkg.dir / "hook-ran") "ran"\n  pure (Job.pure ())\n');
	await assert.rejects(() => capture(context.root).then(snapshot => resolve(t, snapshot, [context.names.root])), /Unsupported Lake build target/);
	await assert.rejects(() => readFile(join(context.root, "hook-ran")), { code: "ENOENT" });
});

test("Lake authenticates declared C inputs and rejects undeclared, prebuilt and escaped targets", { skip: !enabled }, async t => {
	for(const variant of ["valid", "missing-target", "missing-file", "prebuilt", "escaped", "facet"])
		await t.test(variant, async t => {
			const context = await lakeWorkspaceFixture(t);
			const path = variant === "prebuilt" ? "native.a" : "native.c";
			await saveLakeFile(context.root, "native.c", "int input(void) { return 1; }\n");
			await saveLakeFile(context.root, "native.a", "prebuilt\n");
			if(variant === "escaped") await saveLakeFile(context.local, "native.c", "int input(void) { return 1; }\n");
			const declarationPath = variant === "escaped" ? "../packages/Catalog/native.c" : variant === "missing-file" ? "absent.c" : path;
			const target = variant === "missing-target" ? "absent" : variant === "facet" ? "native:default" : "native";
			await saveLakeFile(context.root, "lakefile.toml", `name = "shop"\n[[require]]\nname = "Catalog"\npath = "../local"\n[[input_file]]\nname = "native"\npath = "${declarationPath}"\n[[lean_lib]]\nname = "Shop"\nmoreLinkObjs = ["${target}"]\n`);
			const snapshot = await capture(context.root);
			if(variant !== "valid")
			{
				await assert.rejects(() => resolve(t, snapshot, ["Shop"]), /input_file target|does not exist|no such file|prebuilt object|owning package|native input key/);
				return;
			}
			const { document } = await resolve(t, snapshot, ["Shop"]);
			assert.equal(document.schemaVersion, 2);
			assert.equal(document.modules.at(-1).nativeInputs[0].path, "root/native.c");
			assert.equal(validateLockedLakeResolution({ snapshot, resolution: document, modules: ["Shop"] }), true);
			for(const change of [
				value => { value.modules.at(-1).nativeInputs[0].source.sha256 = "0".repeat(64); }
				, value => { value.modules.at(-1).nativeInputs[0].package = "Catalog"; }
				, value => { value.modules.at(-1).nativeInputs[0].path = "root/native.a"; }
				, value => { value.modules.at(-1).nativeInputs = []; }
				, value => { value.schemaVersion = 1; }
			]) {
				const resolution = structuredClone(document);
				change(resolution);
				assert.throws(() => validateLockedLakeResolution({ snapshot, resolution, modules: ["Shop"] }), { code: "invalid-lake-resolution" });
			}
		});
});

test("Lake rejects incomplete, stale and unsupported build inputs", { skip: !enabled }, async t => {
	const cases = [
		["missing transitive pin", async context => { context.manifest.packages.pop(); await context.lock(); }, /not in manifest/]
		, ["root local path drift"
			, async context => {
			await saveLakeFile(context.root, "lakefile.toml", (await readFile(join(context.root, "lakefile.toml"), "utf8")).replace("../local", "../changed"));
			}
		, /local dependency path changed/]
		, ["missing source", context => rm(join(context.local, "Catalog.lean")), /no such file|does not exist/]
		, ["uncaptured source directory"
			, async context => {
			await saveLakeFile(context.local, "lakefile.toml", `${await readFile(join(context.local, "lakefile.toml"), "utf8")}\nsrcDir = "../../outside"\n`);
			}
		, /no such file|does not exist|escaped/]
		, ["module import cycle", context => saveLakeFile(context.local, "Catalog.lean", "import Shop\n"), /Cyclic Lake module imports/]
		, ["undeclared import", context => saveLakeFile(context.local, "Catalog.lean", "import Absent\n"), /unknown module|does not exist|object file/]
		, ["overlapping library ownership"
			, async context => {
			await saveLakeFile(context.local, "lakefile.toml", `${await readFile(join(context.local, "lakefile.toml"), "utf8")}\n[[lean_lib]]\nname = "Overlap"\nroots = ["Catalog"]\n`);
			}
		, /Ambiguous Lake library ownership/]
		, ["compiler module shadowing"
			, async context => {
			await saveLakeFile(context.local, "lakefile.toml", `${await readFile(join(context.local, "lakefile.toml"), "utf8")}\n[[lean_lib]]\nname = "Init"\n`);
			await saveLakeFile(context.local, "Init.lean", "prelude\n");
			}
		, /shadows a compiler-library module/]
		, ...["moreLeanArgs = [\"-DautoImplicit=false\"]"
			, "moreLeancArgs = [\"-g\"]", "moreLinkArgs = [\"-lcustom\"]"
			, "backend = \"llvm\"", "buildType = \"debug\""].map(option => [option
			, async context => {
			await saveLakeFile(context.local, "lakefile.toml", `${option}\n${await readFile(join(context.local, "lakefile.toml"), "utf8")}`);
			}
		, /Unsupported Lake native targets or compiler options/])
		, ["package prerequisites"
			, async context => {
			await saveLakeFile(context.local, "lakefile.toml", `extraDepTargets = ["native"]\n${await readFile(join(context.local, "lakefile.toml"), "utf8")}`);
			}
		, /Unsupported Lake package build prerequisites/]
		, ...["precompileModules = true", "allowImportAll = true"
			, "extraDepTargets = [\"native\"]"
			, "needs = [\"native\"]"].map(option => [option
			, async context => {
			await saveLakeFile(context.local, "lakefile.toml", `${await readFile(join(context.local, "lakefile.toml"), "utf8")}\n${option}\n`);
			}
		, /Unsupported Lake library build prerequisites/])
	];
	for(const [name, change, expected] of cases)
		await t.test(name, async t => {
			const context = await lakeWorkspaceFixture(t);
			await change(context);
			const before = await lakeInputState(context.workspace);
			const snapshot = await capture(context.root);
			await assert.rejects(() => resolve(t, snapshot, [context.names.root]), error => {
				assert.match(errorText(error), expected);
				return true;
			});
			assert.deepEqual(await lakeInputState(context.workspace), before);
		});
});

test("locked native builds relocate identically and run through installed Perl packages", { skip: !enabled, timeout: 300_000 }, async t => {
	const first = await lakeWorkspaceFixture(t);
	const runtimeRoot = join(first.directory, "runtime");
	await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
	const runtimePackage = join(first.directory, "runtime-package");
	await stageCpanPackage({ outputRoot: runtimePackage, runtimeRoot, leanPrefix, glibcMinimumVersion: floor });
	await compileCpanXsVariant({ packageRoot: runtimePackage, perl });
	const runtimeArchive = await archiveCpanPackage({ packageRoot: runtimePackage, outputRoot: join(first.directory, "archives") });
	const buildRuntime = await installCpanArchive({ archive: runtimeArchive.path
		, workingRoot: first.directory
		, prefix: join(first.directory, "build-runtime")
		, perl, mode: "prebuilt-only" });
	for(const context of [first, await lakeWorkspaceFixture(t, "telemetry")])
		await t.test(context.names.root, async () => {
			const rootPath = await customLakeRoot(context);
			await nativeLakeInput(context);
			await elaboratedLakeApi(context, rootPath);
			const before = await lakeInputState(context.workspace);
			await cp(context.workspace, join(context.directory, "relocated"), { recursive: true });
			const outputs = [];
			for(const [label, projectRoot] of [["left", context.root], ["right", join(context.directory, "relocated/project")]])
			{
				const outputRoot = join(context.directory, label);
				let built;
				try
				{ built = await buildNativeComponent({ projectRoot, outputRoot, runtimeRoot, leanPrefix }); }
				catch(error)
				{ throw new Error(errorText(error), { cause: error }); }
				const packageRoot = join(context.directory, `${label}-package`);
				await stageCpanPackage({ outputRoot: packageRoot, runtimeRoot, runtimePackageRoot: runtimePackage, componentRoot: outputRoot, leanPrefix, version: "1.000", glibcMinimumVersion: floor });
				await compileCpanXsVariant({ packageRoot, perl, environment: { ...process.env, PERL5LIB: buildRuntime.perl5lib } });
				const archive = await archiveCpanPackage({ packageRoot, outputRoot: join(context.directory, `${label}-archives`) });
				outputs.push({ built, archive, packageRoot });
			}
			const [{ built, archive }, right] = outputs;
			assert.deepEqual(right.built.receipt, built.receipt);
			const leftManifest = JSON.parse(await readFile(join(outputs[0].packageRoot, "lean-bridge-package.json"), "utf8"));
			for(const variant of leftManifest.prebuilt)
			{
				const path = `prebuilt/${variant.abiKey}/receipt.json`;
				assert.deepEqual(JSON.parse(await readFile(join(right.packageRoot, path), "utf8")),
					JSON.parse(await readFile(join(outputs[0].packageRoot, path), "utf8")));
			}
			assert.deepEqual(JSON.parse(await readFile(join(right.packageRoot, "lean-bridge-package.json"), "utf8")), leftManifest);
			assertArchiveBytesEqual(await readFile(right.archive.path), await readFile(archive.path));
			const { sourceIdentity } = built.receipt;
			const dependencies = sourceIdentity.lakeDependencies;
			assert.equal(dependencies.snapshotSha256, sha256(canonicalJson(dependencies.snapshot)));
			assert.equal(dependencies.resolutionSha256, sha256(canonicalJson(dependencies.resolution)));
			assert.equal(dependencies.resolution.modules.at(-1).path, `root/${rootPath}`);
			assert.equal(built.receipt.nativeCompilation.objects.length, 1);
			assert.ok(built.receipt.nativeCompilation.objects[0].inputs.some(input => input.path === `snapshot/packages/${context.names.remote}/native code/factor.h`));
			assert.deepEqual(sourceIdentity.modules.map(item => item.module), [context.names.remote, context.names.local, context.names.root]);
			assert.ok(sourceIdentity.modules.every(item => /^[0-9a-f]{64}$/.test(item.interface.sha256)));
			assert.deepEqual(built.model.exports.map(item => item.name), [`${context.names.root}.${context.names.operation}`]);
			t.diagnostic(canonicalJson({ project: context.names.root
				, snapshotSha256: dependencies.snapshotSha256
				, resolutionSha256: dependencies.resolutionSha256
				, nativeLibrarySha256: built.receipt.nativeLibrary.sha256
				, archiveSha256: sha256(await readFile(archive.path)) }));
			const prefix = join(context.directory, "installed");
			for(const path of [runtimeArchive.path, archive.path])
				await installCpanArchive({ archive: path, workingRoot: context.directory, prefix, perl, mode: "prebuilt-only" });
			const result = await processBuildRunner.capture({ command: perl
				, args: [`-MLeanBridge::${context.names.root}`, "-e", `print LeanBridge::${context.names.root}::${context.names.operation}(3)`]
				, cwd: context.directory
				, env: { ...process.env, PERL5LIB: join(prefix, "lib/perl5") } });
			assert.equal(result.stdout, context.names.root === "Shop" ? "12" : "15");
			assert.deepEqual(await lakeInputState(context.workspace), before);
		});
	await t.test("dependency drift during C compilation rejects the output", async t => {
		const context = await lakeWorkspaceFixture(t);
		const wrapper = join(context.directory, "mutating-cc.mjs");
		await saveLakeFile(context.directory, "mutating-cc.mjs", `#!/usr/bin/env node\nimport { writeFileSync } from "node:fs";\nimport { spawnSync } from "node:child_process";\nif (process.argv.includes("-c")) writeFileSync(${JSON.stringify(join(context.local, "Catalog.lean"))}, "def Catalog.changed : Nat := 99\\n");\nconst result = spawnSync("cc", process.argv.slice(2), { stdio: "inherit" });\nprocess.exit(result.status ?? 1);\n`);
		await chmod(wrapper, 0o755);
		const outputRoot = join(context.directory, "rejected");
		await assert.rejects(() => buildNativeComponent({ projectRoot: context.root, outputRoot, runtimeRoot, leanPrefix, cc: wrapper }), /Lake dependency sources changed during compilation/);
		await assert.rejects(() => readFile(join(outputRoot, "native-component.json")), { code: "ENOENT" });
	});
	await t.test("declared C inputs do not authorize unreviewed foreign implementations", async t => {
		const context = await lakeWorkspaceFixture(t);
		await nativeLakeInput(context, true);
		const outputRoot = join(context.directory, "rejected-foreign");
		await assert.rejects(() => buildNativeComponent({ projectRoot: context.root, outputRoot, runtimeRoot, leanPrefix }),
			error => /reviewed unsafe, partial or foreign implementation contract/.test(errorText(error)));
		await assert.rejects(() => readFile(join(outputRoot, "native-component.json")), { code: "ENOENT" });
	});
});

test("Lake resolves read-only author source files without creating their build caches", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	for(const { path, sha256: digest } of await lakeInputState(context.workspace))
		if(digest !== null) await chmod(join(context.workspace, path), 0o444);
	const before = await lakeInputState(context.workspace);
	await resolve(t, await capture(context.root), [context.names.root]);
	assert.deepEqual(await lakeInputState(context.workspace), before);
});

test("C include closure checks run before compilation and detect later input/object drift", { skip: !enabled }, async t => {
	for(const variant of ["success", "outside-header", "header-drift", "extra-header", "object-drift", "compiler-drift", "environment", "date-macro"])
		await t.test(variant, async t => {
			const context = await lakeWorkspaceFixture(t);
			const header = variant === "outside-header" ? join(context.directory, "outside.h") : "local header.h";
			await saveLakeFile(context.directory, "outside.h", "#define FACTOR 17\n");
			await saveLakeFile(context.root, "native/local header.h", "#define FACTOR 7\n");
			await saveLakeFile(context.root, "native/main.c", variant === "date-macro" ? 'const char *build_date = __DATE__;\n' : `#include "${header}"\n#include <stdint.h>\nuint32_t call(uint32_t x) { return FACTOR * x; }\n`);
			const snapshot = await capture(context.root);
			const snapshotRoot = join(context.directory, "captured");
			await writeLakeDependencySnapshot({ snapshot, outputRoot: snapshotRoot });
			const input = { path: "root/native/main.c", source: snapshot.document.rootInputs.find(file => file.path === "native/main.c") };
			const compiler = variant === "compiler-drift" ? join(context.directory, "cc-wrapper") : "cc";
			if(variant === "compiler-drift")
			{
				await saveLakeFile(context.directory, "cc-wrapper", '#!/bin/sh\nexec cc "$@"\n');
				await chmod(compiler, 0o755);
			}
			let compiles = 0;
			const runner = { capture: async options => {
				if(variant === "environment")
					for(const key of ["CPATH", "C_INCLUDE_PATH", "CFLAGS", "CCC_OVERRIDE_OPTIONS"]) assert.equal(Object.hasOwn(options.env, key), false);
				if(options.args.includes("-c"))
				{
					compiles++;
					if(variant === "header-drift") await saveLakeFile(snapshotRoot, "root/native/local header.h", "#define FACTOR 8\n");
				}
				const result = await processBuildRunner.capture(options);
				if(variant === "compiler-drift" && options.args.includes("-c")) await saveLakeFile(context.directory, "cc-wrapper", "changed compiler\n");
				return result;
			} };
			if(variant === "extra-header") await saveLakeFile(snapshotRoot, "root/native/extra.h", "unrecorded");
			const run = () => compileLakeNativeInputs({ snapshot, snapshotRoot
				, inputs: [input], outputRoot: join(context.directory, "objects")
				, compiler, profile: "native-library-v1", runner
				, environment: { ...process.env, ...(variant === "environment" ? { CPATH: "/unrecorded", C_INCLUDE_PATH: "/unrecorded", CFLAGS: "-DFACTOR=99", CCC_OVERRIDE_OPTIONS: "+-DFACTOR=99" } : {}) } });
			if(["outside-header", "header-drift", "extra-header", "compiler-drift", "date-macro"].includes(variant))
			{
				await assert.rejects(run, error => /outside its captured|changed during compilation|captured input|snapshot|date-time/i.test(errorText(error)));
				if(variant === "outside-header" || variant === "extra-header") assert.equal(compiles, 0);
				await assert.rejects(() => readFile(join(context.directory, "objects/0.o")), { code: "ENOENT" });
				return;
			}
			const result = await run();
			assert.ok(result.document.objects[0].inputs.some(file => file.path === "snapshot/root/native/local header.h"));
			assert.equal(JSON.stringify(result.document).includes(context.directory), false);
			if(variant === "object-drift")
			{
				await saveLakeFile(context.directory, "objects/0.o", "changed object");
				await assert.rejects(result.verify, { code: "lake-source-drift" });
			}
			else
			{
				await saveLakeFile(context.directory, "driver.c", '#include <stdint.h>\n#include <stdio.h>\nextern uint32_t call(uint32_t);\nint main(void) { printf("%u", call(6)); }\n');
				await processBuildRunner.capture({ command: "cc", args: [join(context.directory, "driver.c"), ...result.objects, "-o", join(context.directory, "driver")] });
				assert.equal((await processBuildRunner.capture({ command: join(context.directory, "driver"), args: [] })).stdout, "42");
				await result.verify();
			}
		});
});
