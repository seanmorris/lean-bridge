/**
 * Compile the receiver author example and execute the exact installed Perl guide.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { installCpanArchive } from "../src/release/cpan-install.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";

const block = (source, heading, language) => {
	const sections = source.split(heading + "\n"); assert.equal(sections.length, 2);
	const section = sections[1].split(/^#{1,3} /mu)[0];
	const blocks = [...section.matchAll(new RegExp("^```" + language + "\\n([^]*?)^```", "gmu"))];
	assert.equal(blocks.length, 1); return blocks[0][1];
};

test("Perl receiver author and consumer guides run from an installed C/CPAN release", {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_RECEIVER_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-receiver-docs-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const authorGuide = await readFile("docs/publish/cpan.md", "utf8");
	const consumerGuide = await readFile("docs/consume/perl.md", "utf8");
	const lean = block(authorGuide, "## Export resource-containing values", "lean");
	const base = JSON.parse(block(authorGuide, "## Export resource-containing values", "json"));
	const contracts = JSON.parse(block(authorGuide, "## Export methods and properties", "json"));
	const config = canonicalJson({ ...base, contracts });
	const example = block(consumerGuide, "### Methods and properties", "perl");
	const author = join(directory, "author"), project = join(author, "project");
	const producer = join(author, "release"), handoff = join(directory, "handoff");
	await saveLakeFile(project, "Owned.lean", lean);
	await saveLakeFile(project, "lean-bridge.exports.json", config);
	await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(project, "lakefile.toml", 'name = "owned-aggregates"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Owned"\n');
	const before = await lakeInputState(project), perls = perlGraphCommands();
	const environment = { ...nativeFixtureEnvironment(["perl"]), LEAN_BRIDGE_PERLS: JSON.stringify(perls) };
	const cli = resolve("scripts/lean-bridge.mjs");
	const buildStarted = performance.now();
	const invocation = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "build", "--project", project, "--output", producer, "--target", "c", "--target", "cpan", "--json"]
		, cwd: directory, env: environment, timeoutMs: 1200000 })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	t.diagnostic(`Four-ABI C/CPAN documentation build completed in ${Math.round(performance.now() - buildStarted)} ms`);
	const response = JSON.parse(invocation.stdout); assert.equal(response.status, "ok");
	assert.deepEqual(response.result.targets, ["c", "cpan"]);
	assert.deepEqual(await lakeInputState(project), before);
	const model = JSON.parse(await readFile(join(producer, "native/component/model.json"), "utf8"));
	assert.equal(model.ownedGraph.receiverExports.exports.length, 2);
	assert.equal(model.ownedGraph.resultAnchors.exports.length, 1);
	assert.equal(model.ownedGraph.inputTransfers, undefined);
	const cpan = response.result.projections.find(projection => projection.ecosystem === "cpan");
	const receipt = await copyPackageSetHandoff(producer, handoff);
	assert.deepEqual([...new Set(receipt.packages.map(pkg => pkg.target))], ["c", "cpan"]);
	assert.equal(receipt.profiles.length, 1);
	const archives = await Promise.all(cpan.packages.map(async pkg => ({ ...pkg, bytes: await readFile(join(handoff, "archives", pkg.archive)) })));
	await rm(author, { recursive: true }); await rm(handoff, { recursive: true });
	for(const path of [author, handoff]) await assert.rejects(access(path), { code: "ENOENT" });
	const observations = [];
	for(const [index, perl] of perls.entries()) for(const mode of ["prebuilt-only", "build-xs"])
	{
		const consumer = join(directory, `consumer-${index}-${mode}`), staging = join(consumer, "handoff");
		const prefix = join(consumer, "installed"), tools = join(consumer, "tools");
		await mkdir(tools, { recursive: true });
		for(const command of ["make", "tar", "gzip", "sh", "cp", "mv", "rm"
			, "chmod", "mkdir", "touch", "true"
			, ...mode === "build-xs" ? ["cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld"] : []])
			await symlink(`/usr/bin/${command}`, join(tools, command));
		const installEnv = { ...copiedCleanEnvironment, PATH: tools
			, ...mode === "build-xs" ? { CC: "/usr/bin/cc", LD: "/usr/bin/cc" } : {} };
		for(const archive of archives)
		{
			assert.equal(sha256(archive.bytes), archive.sha256);
			await saveLakeFile(staging, archive.archive, archive.bytes);
			await installCpanArchive({ archive: join(staging, archive.archive)
				, workingRoot: consumer, prefix, perl, mode, environment: installEnv });
		}
		await rm(staging, { recursive: true }); await rm(tools, { recursive: true });
		const relocated = join(consumer, "relocated"); await rename(prefix, relocated);
		await saveLakeFile(consumer, "members.pl", example);
		const observed = await runCopied(perl, ["members.pl"], consumer
			, { ...copiedCleanEnvironment, PERL5LIB: join(relocated, "lib/perl5") });
		assert.equal(observed.stderr, ""); assert.equal(observed.stdout, "42\nexpired\n42\n");
		observations.push({ perl, mode, stdout: observed.stdout, stderr: observed.stderr });
		await rm(consumer, { recursive: true });
	}
	await saveLakeFile("build/owned-perl-receiver-core", "documentation.json", canonicalJson({
		schemaVersion: 1, actualLean: true, installedPackage: true
		, cliIntegrated: true
		, mixedTargets: ["c", "cpan"], anchoredResults: true, consumingInputs: false
		, producerRemoved: true, handoffRemoved: true, sourceUnchanged: true
		, relocated: true, observations
		, sourceHashes: { lean: sha256(lean), config: sha256(config), example: sha256(example) }
		, cliBuild: response, packageSetReceipt: receipt
	}));
});
