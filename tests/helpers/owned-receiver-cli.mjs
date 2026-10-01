/**
 * Install and exercise the real CLI independently of author checkout imports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

/**
 * Give each source path its own installed CLI, inputs and independently rebuilt outputs.
 *
 * @param t - Test-owned lifetime and cleanup hooks.
 * @param options - Independent author fixture and required compiler profiles.
 */
export const prepareOwnedReceiverCli = async (t, options) => {
	const { label, configuration, reviewedIr, source, profiles } = options;
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-${label}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const author = join(directory, "author"), project = join(directory, "source");
	const output = join(directory, "producer"), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	const candidate = await buildCliNpmPackage({ outputRoot: join(directory, "cli") });
	await saveLakeFile(author, "package.json", canonicalJson({ private: true }));
	await processBuildRunner.capture({ command: "npm", args: ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", candidate.archive], cwd: author });
	const cliRoot = join(author, "node_modules", candidate.report.package.name);
	for(const file of candidate.report.files)
	{
		const bytes = await readFile(join(cliRoot, file.path));
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
	}
	await rm(candidate.output, { recursive: true });
	const cli = join(author, "node_modules/.bin/lean-bridge");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + source);
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(configuration));
	if(reviewedIr) await saveLakeFile(project, "api.binding-ir.json", canonicalJson(reviewedIr));
	const before = await lakeInputState(project), targets = Object.keys(configuration.targets);
	const environment = { ...nativeFixtureEnvironment(profiles), ...options.environment };
	for(const name of ["NODE_PATH", "NODE_OPTIONS"]) delete environment[name];
	const builds = [];
	const build = async destination => {
		const result = await processBuildRunner.capture({ command: process.execPath
			, args: [cli, "build", "--project", project, ...targets.flatMap(target => ["--target", target]), "--output", destination, "--json"]
			, cwd: directory, env: environment, timeoutMs: 900000 })
			.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
		const response = JSON.parse(result.stdout); assert.equal(response.status, "ok");
		assert.deepEqual([...response.result.targets].sort(), [...targets].sort());
		assert.deepEqual(await lakeInputState(project), before); builds.push(response);
		return JSON.parse(await readFile(join(destination, "native-release.json"), "utf8"));
	};
	const removeAuthor = async () => {
		await rm(project, { recursive: true }); await rm(output, { recursive: true });
		for(const path of [project, output]) await assert.rejects(access(path), { code: "ENOENT" });
		const verified = JSON.parse((await runCopied(process.execPath, [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"], directory)).stdout);
		assert.equal(verified.status, "ok"); assert.equal(verified.result.verificationType, "local-package-set");
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
		return verified;
	};
	return { directory, author, project, output, handoff, consumer, environment
		, cli: candidate.report, builds, build, removeAuthor
		, cliInstallation: { offline: true, filesVerified: candidate.report.files.length, sourceRemoved: true } };
};
