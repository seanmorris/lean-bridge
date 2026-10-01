/**
 * Offline prebuilt and XS-only installation with runtime-only relocated consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { inspectOwnedPerlInstalledAssets } from "./owned-perl-installed-assets.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Runtime sees only the relocated prefix and public consumer, with no producer.
 *
 * @param options - Fresh scratch root, authenticated archives and public probe.
 * @param options.directory - Test-owned parent for consumer installations.
 * @param options.archives - Prepared runtime/component bytes and their receipts.
 * @param options.perls - Absolute selected interpreter executables.
 * @param options.owned - Verified private native asset identities.
 * @param options.source - Public installed-package consumer script.
 * @param options.diagnostic - Test progress observer.
 * @param options.expectedChecks - Exact count for a resource-only consumer.
 */
export const runInstalledPerlReceivers = async ({ directory, archives, perls, owned, source, diagnostic, expectedChecks }) => {
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
		await rm(staging, { recursive: true }); await assert.rejects(access(staging), { code: "ENOENT" });
		await rm(tools, { recursive: true });
		const relocated = join(consumer, "relocated"); await rename(prefix, relocated);
		await saveLakeFile(consumer, "consumer.pl", source);
		const runtimeEnv = { ...copiedCleanEnvironment, PERL5LIB: join(relocated, "lib/perl5") };
		let observed;
		for(let repeat = 0; repeat < 2; repeat++)
		{
			const execution = await runCopied(perl, ["consumer.pl", "--installed"], consumer, runtimeEnv);
			assert.equal(execution.stderr, ""); const actual = JSON.parse(execution.stdout);
			if(expectedChecks === undefined) assert.ok(actual.checks > 100);
			else assert.equal(actual.checks, expectedChecks);
			assert.equal(actual.brokerIdentities, 0);
			if(observed) assert.deepEqual(actual, observed); observed = actual;
		}
		const assets = await inspectOwnedPerlInstalledAssets({ consumer, prefix: relocated, perl, owned });
		observations.push({ perl, mode, runtimeOnlyRuns: 2, observed, assets });
		diagnostic(JSON.stringify({ perl, mode, checks: observed.checks, assetChecks: assets.observations.length }));
		await rm(consumer, { recursive: true });
	}
	return observations;
};
