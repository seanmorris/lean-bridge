/**
 * Original installed owned and copied CPAN packages share the real native broker.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, rename, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { projectCpanPackages } from "../../src/build/cpan-projection.mjs";
import { projectOwnedPerl } from "../../src/build/owned-perl-projection.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const specifications = [
	{ name: "owned_one", module: "OwnedOne", owned: true, value: 44 }
	, { name: "owned_two", module: "OwnedTwo", owned: true, value: 45 }
	, { name: "copied_graph", module: "CopiedGraph", graph: true, value: 41 }
	, { name: "peer", module: "Peer", value: 42 }
];
const explain = error => { error.message += `: ${JSON.stringify(error.details ?? {})}`; throw error; };

/**
 * Compile independent component packages, remove authors, and exercise load order.
 *
 * @param directory - Fresh test-owned temporary directory.
 * @param diagnostic - Progress callback for compiler operations.
 */
export const checkOwnedPerlCoexistence = async (directory, diagnostic = () => {}) => {
	const perls = perlGraphCommands(), releases = [];
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const environment = { ...process.env, LEAN_BRIDGE_PERLS: JSON.stringify(perls) };
	const runtimeRoot = join(directory, "native-runtime"), handoff = join(directory, "handoff");
	await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix }).catch(explain);
	let reproduced;
	for(const [index, spec] of specifications.entries())
	for(let iteration = 0; iteration < (index === 0 ? 2 : 1); ++iteration)
	{
		const { name, module, owned = false, graph = false, value } = spec;
		const author = join(directory, `author-${name}-${iteration}`), project = join(author, "source"), working = join(author, "release");
		const nativeRoot = join(working, "native/component");
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
` : graph ? `inductive V where
  | done (value : UInt32)
  | next (value : V)
structure Parcel where
  node : V
def echo (value : Parcel) : Parcel := value
` : ""}def value : UInt32 := ${value}
end ${module}
`;
		const settings = { module: `LeanBridge::${module}`, version: "0.003" };
		await saveLakeFile(project, `${module}.lean`, source);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${module}"\n`);
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: [module]
			, exports: [...owned ? ["ticket", "read", "through"] : graph ? ["echo"] : [], "value"].map(name => `${module}.${name}`)
			, ...owned ? { resources: [`${module}.Ticket`]
				, ownedAggregates: { ownership: "lease", disposal: "required", fallback: "queued-finalizer", cycles: "reject" } } : {}
			, targets: { cpan: settings }
		}));
		const before = await lakeInputState(project);
		diagnostic(`building ${module}, independent producer ${iteration + 1}`);
		await buildNativeComponent({
			projectRoot: project, outputRoot: nativeRoot
			, runtimeRoot, leanPrefix, targets: owned ? ["c"] : ["cpan"]
			, copiedGraphs: !owned, ownedGraphs: owned, ownedHostCallbacks: owned
		}).catch(explain);
		const options = { working, nativeRoot, runtimeRoot, leanPrefix, settings, environment };
		const built = await (owned ? projectOwnedPerl(options) : projectCpanPackages(options)).catch(explain);
		assert.deepEqual(await lakeInputState(project), before);
		const prepared = await readVerifiedCpanPackage(join(working, "packages/component"));
		if(iteration)
		{
			const changed = Object.keys(prepared.manifest.files).filter(path =>
				prepared.manifest.files[path] !== releases[0].files[path]);
			assert.deepEqual(changed, [], "CPAN files differ between independent producer builds");
			assert.deepEqual(built, releases[0].built);
			assert.deepEqual(prepared.manifest.files, releases[0].files);
			for(const pkg of built.packages)
				assert.deepEqual(await readFile(join(working, "archives", pkg.archive)), await readFile(join(handoff, "0", pkg.archive)));
			reproduced = { independentNativeCompilation: true, sourceSha256: sha256(source), packages: built.packages };
		}
		else
		{
			await cp(join(working, "archives"), join(handoff, String(index)), { recursive: true });
			releases.push({ built, module, sourceSha256: sha256(source), files: prepared.manifest.files });
		}
		await rm(author, { recursive: true, force: true });
	}
	await rm(runtimeRoot, { recursive: true, force: true });
	for(const release of releases.slice(1))
		assert.deepEqual(release.built.packages[0], releases[0].built.packages[0]);
	const source = await readFile("tests/fixtures/structured-types/owned-perl-coexistence.pl", "utf8");
	const observations = [];
	for(const [index, perl] of perls.entries())
	{
		const consumer = join(directory, `consumer-${index}`), prefix = join(consumer, "installed"), tools = join(consumer, "tools");
		await mkdir(tools, { recursive: true });
		for(const command of ["make", "tar", "gzip", "sh", "cp", "mv", "rm"
			, "chmod", "mkdir", "touch", "true"])
			await symlink(`/usr/bin/${command}`, join(tools, command));
		for(const [which, release] of releases.entries())
		for(const pkg of release.built.packages.slice(which ? 1 : 0))
		{
			const archive = join(handoff, String(which), pkg.archive);
			assert.equal(sha256(await readFile(archive)), pkg.sha256);
			await installCpanArchive({
				archive, workingRoot: consumer, prefix, perl, mode: "prebuilt-only"
				, environment: { ...copiedCleanEnvironment, PATH: tools }
			}).catch(explain);
		}
		const relocated = join(consumer, "relocated"); await rename(prefix, relocated);
		await saveLakeFile(consumer, "consumer.pl", source);
		for(const order of ["owned-first", "second-owned-first", "graph-first", "peer-first"])
		{
			const result = await runCopied(perl, ["consumer.pl", order], consumer
				, { ...copiedCleanEnvironment, PERL5LIB: join(relocated, "lib/perl5") });
			assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
			assert.equal(observed.order, order); assert.equal(observed.callbacks, 32);
			assert.equal(observed.foreignRejections, 64); assert.ok(observed.checks > 300);
			assert.equal(observed.snapshot.live_identities, 0);
			assert.equal(observed.snapshot.runtime_init_runs, 1);
			for(const paths of Object.values(observed.mappings))
			{
				assert.equal(paths.length, 1);
				assert.ok(paths[0].startsWith(relocated + "/"));
			}
			observations.push({ perl, observed }); diagnostic(JSON.stringify({ perl, order, checks: observed.checks }));
		}
		await rm(consumer, { recursive: true, force: true });
	}
	return { releases, reproduced, observations, sourceSha256: sha256(source)
		, producerRemoved: true, relocated: true, compilerFreeInstall: true };
};
