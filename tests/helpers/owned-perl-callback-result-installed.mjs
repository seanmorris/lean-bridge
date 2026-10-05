/**
 * Install one verified CPAN handoff without consumer-side compilers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Execute public callback APIs twice after removing the handoff and build tools.
 *
 * @param options - Test-owned root, verified archive bytes and consumer text.
 * @param options.directory - Parent directory owned by the smoke test.
 * @param options.archives - Verified runtime and component archive bytes.
 * @param options.perls - Absolute paths to the selected Perl interpreters.
 * @param options.source - Public API consumer text.
 * @param options.diagnostic - Progress callback for each completed installation.
 */
export const runInstalledPerlCallbackResults = async ({ directory, archives, perls, source, diagnostic }) => {
	const observations = [];
	for(const [index, perl] of perls.entries())
	{
		const consumer = join(directory, `callback-consumer-${index}`);
		const staging = join(consumer, "handoff"), prefix = join(consumer, "installed"), tools = join(consumer, "tools");
		await mkdir(tools, { recursive: true });
		for(const command of ["make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir", "touch", "true"])
			await symlink(`/usr/bin/${command}`, join(tools, command));
		const installs = [];
		for(const archive of archives)
		{
			assert.equal(sha256(archive.bytes), archive.sha256);
			await saveLakeFile(staging, archive.archive, archive.bytes);
			installs.push(await installCpanArchive({
				archive: join(staging, archive.archive), workingRoot: consumer
				, prefix, perl, mode: "prebuilt-only"
				, environment: { ...copiedCleanEnvironment, PATH: tools }
			}));
		}
		await rm(staging, { recursive: true }); await assert.rejects(access(staging), { code: "ENOENT" });
		await rm(tools, { recursive: true }); await assert.rejects(access(tools), { code: "ENOENT" });
		const relocated = join(consumer, "relocated"); await rename(prefix, relocated);
		const installedPaths = await nativeArtifactPaths(relocated);
		const receipts = [];
		for(const name of ["Runtime", "OwnedProbe"])
		{
			const paths = installedPaths.filter(path => path.endsWith(`/LeanBridge/${name}/install-receipt.json`));
			assert.equal(paths.length, 1, `${name} has one ABI-specific install receipt`);
			const receipt = JSON.parse(await readFile(join(relocated, paths[0]), "utf8"));
			assert.equal(receipt.operation, "prebuilt-xs"); receipts.push(receipt);
			const binaries = installedPaths.filter(path => path.endsWith(`/auto/LeanBridge/${name}/${name}.so`));
			assert.equal(binaries.length, 1, `${name} has one installed XS image`);
			assert.equal(sha256(await readFile(join(relocated, binaries[0]))), receipt.outputSha256);
		}
		assert.deepEqual(receipts[0].abi, receipts[1].abi);
		await saveLakeFile(consumer, "consumer.pl", source);
		const executions = [];
		for(let repeat = 0; repeat < 2; repeat++)
		{
			const execution = await runCopied(perl, ["consumer.pl"], consumer, {
				...copiedCleanEnvironment, PERL5LIB: join(relocated, "lib/perl5")
			});
			assert.equal(execution.code, 0); assert.equal(execution.stderr, "");
			const observation = JSON.parse(execution.stdout);
			assert.deepEqual(observation, { checks: 79, phases: { native: 25, host: 23, combined: 29 } });
			executions.push({ ...execution, observation });
		}
		assert.deepEqual(executions[0].observation, executions[1].observation);
		observations.push({ perl, mode: "prebuilt-only", installs, receipts, executions });
		diagnostic(JSON.stringify({ perl, mode: "prebuilt-only", executions: executions.length, observation: executions[0].observation }));
		await rm(consumer, { recursive: true });
	}
	return observations;
};
