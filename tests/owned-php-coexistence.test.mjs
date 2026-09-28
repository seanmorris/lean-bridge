/**
 * Independent reproducible PHP builds and mixed installed package load orders.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { projectOwnedPhp } from "../src/build/owned-php-projection.mjs";
import { projectNativeCFamily } from "../src/build/native-c-projection.mjs";
import { installOwnedPhpArchive, ownedPhpInventory } from "./helpers/owned-php-installed.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const specifications = [
	{ name: "owned-one", module: "OwnedOne", owned: true, value: 44 }
	, { name: "owned-two", module: "OwnedTwo", owned: true, value: 45 }
	, { name: "copied-graph", module: "CopiedGraph", owned: false, value: 41 }
];
const explain = error => { error.message += `: ${JSON.stringify(error.details ?? {})}`; throw error; };

test("original owned and copied Composer packages coexist with reproducible native bytes", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-php-coexist-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const environment = nativeFixtureEnvironment([]), leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const runtimeRoot = join(directory, "native-runtime"), handoff = join(directory, "handoff");
	await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix }).catch(explain);
	const releases = []; let reproduced;
	for(const [index, spec] of specifications.entries())
	for(let iteration = 0; iteration < (index === 0 ? 2 : 1); ++iteration)
	{
		const { name, module, owned, value } = spec;
		const author = join(directory, `author-${index}-${iteration}`), project = join(author, "source"), working = join(author, "release");
		const nativeRoot = join(working, "native/component"), settings = { name: `lean-bridge/${name}`, version: "1.0.0" };
		const source = `namespace ${module}
${owned ? `structure Ticket where
  serial : Nat
  label : String
structure Parcel where
  ticket : Ticket
  bytes : ByteArray
def ticket (serial : Nat) : Ticket := ⟨serial, "owned"⟩
def read (value : Ticket) : Nat := value.serial
def through (value : Parcel) (callback : Parcel → Parcel) : Parcel := callback value
` : `inductive Node where
  | done (value : UInt32)
  | next (next : Node)
def echo (value : Node) : Node := value
`}def value : UInt32 := ${value}
end ${module}
`;
		await saveLakeFile(project, `${module}.lean`, source);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${module}"\n`);
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: [module]
			, exports: [...owned ? ["ticket", "read", "through"] : ["echo"], "value"].map(name => `${module}.${name}`)
			, ...owned ? { resources: [`${module}.Ticket`]
				, ownedAggregates: { ownership: "lease", disposal: "required", fallback: "queued-finalizer", cycles: "reject" } } : {}
			, targets: { "php-native": settings } }));
		const before = await lakeInputState(project);
		t.diagnostic(`building ${module}, independent producer ${iteration + 1}`);
		await buildNativeComponent({ projectRoot: project, outputRoot: nativeRoot
			, runtimeRoot, leanPrefix, targets: owned ? ["c"] : ["php-native"]
			, ownedGraphs: owned, ownedHostCallbacks: owned
			, copiedGraphs: !owned }).catch(explain);
		const options = { working, nativeRoot, runtimeRoot, leanPrefix, settings, environment };
		const built = owned ? await projectOwnedPhp(options).catch(explain)
			: (await projectNativeCFamily({ ...options, targets: ["php-native"], settings: { "php-native": settings } }).catch(explain))[0];
		assert.deepEqual(await lakeInputState(project), before);
		const files = await ownedPhpInventory(join(working, "packages/php-native/composer"));
		const pkg = built.packages[0];
		if(iteration)
		{
			assert.deepEqual(files, releases[0].files, "independent compiler builds changed installed bytes");
			assert.deepEqual(built, releases[0].built);
			assert.deepEqual(await readFile(join(working, "archives", pkg.archive)), await readFile(releases[0].archive));
			reproduced = { independentNativeCompilation: true, sourceSha256: sha256(source), pkg };
		}
		else
		{
			await cp(join(working, "archives"), join(handoff, String(index)), { recursive: true });
			releases.push({ owned, built, pkg, files, archive: join(handoff, String(index), pkg.archive) });
		}
		await rm(author, { recursive: true, force: true });
		await assert.rejects(access(author), { code: "ENOENT" });
	}
	await rm(runtimeRoot, { recursive: true, force: true });
	await assert.rejects(access(runtimeRoot), { code: "ENOENT" });
	const installed = await installOwnedPhpArchive({ root: join(directory, "consumer")
		, archive: releases[0].archive, pkg: releases[0].pkg
		, additional: releases.slice(1), environment });
	await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const source = await readFile("tests/fixtures/structured-types/owned-php-coexistence.php", "utf8");
	await saveLakeFile(installed.deployment, "consumer.php", source);
	const inventory = await ownedPhpInventory(installed.deployment), observations = [];
	for(const order of ["one,two,graph", "two,graph,one", "graph,one,two", "graph,two,one"])
	{
		const result = await runCopied(installed.php, [...installed.runtimeOptions, "consumer.php", order], installed.deployment, installed.environment);
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		assert.equal(observed.callbacks, 32); assert.equal(observed.foreignRejections, 64);
		assert.equal(observed.runtimeInitializations, 1); assert.equal(observed.componentInitializations, 3);
		assert.equal(observed.liveIdentities, 0); assert.ok(observed.checks > 250);
		assert.deepEqual(await ownedPhpInventory(installed.deployment), inventory);
		observations.push({ order, observed }); t.diagnostic(`${order}: ${observed.checks} checks`);
	}
	await saveLakeFile("build/owned-php-packaging", "coexistence.json", canonicalJson({ schemaVersion: 1
		, planNode: 1219, compiledLean: true, installedPackage: true
		, sourceFreeInstallation: true, sourceFreeRelocatedExecution: true
		, handoffRemoved: true, reproduced, releases, observations, inventory
		, consumerSha256: sha256(source), installation: installed.evidence }));
});
