/**
 * Install prepared CPAN archives into a fresh prefix and run the generated API.
 *
 * @file
 */
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { processBuildRunner } from "../build/process-runner.mjs";

/**
  Install one prepared archive into an isolated Perl library and run its load test.

 * @param root0 - Named inputs for this operation.
 * @param root0.archive - Prepared CPAN archive path.
 * @param root0.workingRoot - Task-owned temporary extraction root.
 * @param root0.prefix - Isolated Perl installation prefix.
 * @param root0.perl - Selected Perl executable.
 * @param root0.mode - Prebuilt selection or XS-only build policy.
 * @param root0.environment - Environment passed to child processes.
 */
export const installCpanArchive = async ({ archive, workingRoot, prefix, perl = "perl", mode = "auto", environment = process.env }) => {
	const working = resolve(workingRoot), target = resolve(prefix);
	await mkdir(working, { recursive: true });
	const directory = await mkdtemp(join(working, ".cpan-install-"));
	const env = { ...environment, LEAN_BRIDGE_PERL_INSTALL_MODE: mode
		, PERL5LIB: [join(target, "lib/perl5"), environment.PERL5LIB].filter(Boolean).join(":") };
	const run = (command, args, cwd) => processBuildRunner.capture({ command, args, cwd, env });
	try
	{
		await run("tar", ["-xzf", resolve(archive), "-C", directory], working);
		const entries = await readdir(directory);
		if(entries.length !== 1) throw new Error("CPAN archive must have one distribution root");
		const packageRoot = join(directory, entries[0]);
		await run(perl, ["Makefile.PL", `INSTALL_BASE=${target}`], packageRoot);
		await run("make", ["test", "install"], packageRoot);
		return { prefix: target, perl5lib: env.PERL5LIB, mode, archive: basename(archive) };
	} finally
	{ await rm(directory, { recursive: true, force: true }); }
};
