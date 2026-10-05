/**
 * Build the owned CPAN author guide and run its unmodified installed example.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { installCpanArchive } from "../src/release/cpan-install.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";

const explain = error => { error.message += ": " + JSON.stringify(error.details ?? {}); throw error; };
const block = (section, language) => {
	const match = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"));
	assert.ok(match, language + " documentation block"); return match[1] + "\n";
};

for(const transferredInputs of [false, true]) test(`owned CPAN ${transferredInputs ? "consuming examples" : "author and consumer guides"} work in a combined C/Perl release`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1200000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-perl-docs-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const authorGuide = await readFile("docs/publish/cpan.md", "utf8");
	const consumerGuide = await readFile("docs/consume/perl.md", "utf8");
	const authorSection = authorGuide.split("## Export resource-containing values\n")[1].split("\n## ")[0];
	const consumerSection = consumerGuide.split(transferredInputs ? "### Consuming inputs\n" : "### Resource-containing values\n")[1].split("\n## ")[0];
	const lean = block(authorSection, "lean");
	let config = block(authorSection, "json");
	if(transferredInputs)
	{
		const contractSection = authorGuide.split("## Transfer input ownership\n")[1].split("\n## ")[0];
		config = canonicalJson({ ...JSON.parse(config), contracts: JSON.parse(block(contractSection, "json")) });
	}
	const example = block(consumerSection, "perl");
	const author = join(directory, "author"), project = join(author, "project");
	const producer = join(author, "release"), handoff = join(directory, "handoff");
	await saveLakeFile(project, "Owned.lean", lean);
	await saveLakeFile(project, "lean-bridge.exports.json", config);
	await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(project, "lakefile.toml", 'name = "owned-aggregates"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Owned"\n');
	const before = await lakeInputState(project), perls = perlGraphCommands();
	const environment = { ...process.env, LEAN_BRIDGE_PERLS: JSON.stringify(perls)
		, LEAN_BRIDGE_LEAN_PREFIX: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2") };
	const cli = resolve("scripts/lean-bridge.mjs");
	const invocation = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "build", "--project", project, "--output", producer, "--target", "c", "--target", "cpan", "--json"]
		, cwd: directory, env: environment, timeoutMs: 600000 }).catch(explain);
	const response = JSON.parse(invocation.stdout);
	assert.equal(response.status, "ok");
	assert.deepEqual(response.result.targets, ["c", "cpan"]);
	assert.deepEqual(await lakeInputState(project), before);
	const model = JSON.parse(await readFile(join(producer, "native/component/model.json"), "utf8"));
	assert.ok(model.ownedGraph.hostCallbacks); assert.equal("moduleName" in model, false);
	assert.equal(Boolean(model.ownedGraph.inputTransfers), transferredInputs);
	const cpan = response.result.projections.find(projection => projection.ecosystem === "cpan");
	assert.ok(cpan);
	const receipt = await copyPackageSetHandoff(producer, handoff);
	assert.deepEqual([...new Set(receipt.packages.map(pkg => pkg.target))], ["c", "cpan"]);
	assert.equal(receipt.profiles.length, 1);
	await rm(author, { recursive: true, force: true });
	const verification = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"]
		, cwd: directory, env: copiedCleanEnvironment }).catch(explain);
	assert.equal(JSON.parse(verification.stdout).result.verificationType, "local-package-set");
	const observations = [];
	for(const [index, perl] of perls.entries()) for(const mode of ["prebuilt-only", "build-xs"])
	{
		const consumer = join(directory, "consumer-" + index + "-" + mode);
		const prefix = join(consumer, "installed"), toolRoot = join(consumer, "tools");
		await mkdir(toolRoot, { recursive: true });
		for(const command of ["make", "tar", "gzip", "sh", "cp", "mv", "rm"
			, "chmod", "mkdir", "touch", "true"
			, ...mode === "build-xs" ? ["cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld"] : []])
			await symlink("/usr/bin/" + command, join(toolRoot, command));
		const installEnv = { ...copiedCleanEnvironment, PATH: toolRoot
			, ...mode === "build-xs" ? { CC: "/usr/bin/cc", LD: "/usr/bin/cc" } : {} };
		for(const pkg of cpan.packages)
			await installCpanArchive({ archive: join(handoff, "archives", pkg.archive)
				, workingRoot: consumer, prefix, perl, mode
				, environment: installEnv }).catch(explain);
		const relocated = join(consumer, "relocated");
		await rename(prefix, relocated);
		await saveLakeFile(consumer, "owned.pl", example);
		const observed = await runCopied(perl, ["owned.pl"], consumer
			, { ...copiedCleanEnvironment, PERL5LIB: join(relocated, "lib/perl5") });
		assert.equal(observed.stderr, ""); assert.equal(observed.stdout, transferredInputs ? "consumed\n42\n42\n" : "42\n42\n");
		observations.push({ perl, mode, stdout: observed.stdout, stderr: observed.stderr });
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile(transferredInputs ? "build/owned-perl-transfer-packaging" : "build/owned-perl-package", "documentation.json", canonicalJson({
		schemaVersion: 1, planNode: 1219, cliIntegrated: true
		, mixedTargets: ["c", "cpan"], transferredInputs
		, producerRemoved: true, sourceUnchanged: true, relocated: true
		, sourceHashes: { lean: sha256(lean), config: sha256(config), example: sha256(example) }
		, cliBuild: response, packageSetReceipt: receipt, observations
	}));
	t.diagnostic(observations.length + " installed documentation examples passed");
});
