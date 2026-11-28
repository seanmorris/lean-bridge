/** @file Exercise a relocated, offline CPAN install without its Lean producer or an event loop. */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

/**
 * Run the original runtime and component distributions from an install for each selected ABI.
 *
 * @param dir - Disposable route directory.
 * @param fixture - Standalone Perl client source.
 * @param output - Verified package-set root.
 * @param receipt - Original runtime and component archive coordinates.
 */
export const exercisePerlCursors = async (dir, fixture, output, receipt) => {
	const pkg = role => receipt.packages.find(p => p.role === role);
	assert.equal(pkg("component").name, "LeanBridge-Dials");
	assert.equal(pkg("runtime").name, "LeanBridge-Runtime");
	for(const executable of JSON.parse(process.env.LEAN_BRIDGE_PERLS ?? '["perl"]'))
	{
		const perl = await run(executable, ["-MCwd", "-e", "print Cwd::abs_path($^X)"], dir, process.env);
		const work = await mkdtemp(join(dir, "install-")), at = join(work, "prefix"), moved = join(work, "app");
		try
		{
			await mkdir(at);
			const install = (role, lib = "") => installCpanArchive({archive: join(output, pkg(role).artifacts[0].path),
				workingRoot: work, prefix: join(at, role), perl, mode: "prebuilt-only", environment: {...process.env, PERL5LIB: lib}});
			const rt = await install("runtime"); await install("component", rt.perl5lib);
			await rename(at, moved);
			const env = {PATH: "/no-build-tools", LANG: "C", LEAN_NUM_THREADS: "1", TMPDIR: work,
				PERL5LIB: ["component", "runtime"].map(n => join(moved, n, "lib/perl5")).join(":")};
			for(const mode of ["iterate", "shutdown", "fork"])
			{
				await writeFile(join(work, "state"), "open");
				const result = await run(perl, [join(fixture, "consumer.pl"), mode], work, env, 45_000);
				assert.equal(result, mode + " passed");
				assert.equal(await readFile(join(work, "state"), "utf8"), "closed");
			}
		} finally { await rm(work, {recursive: true, force: true}); }
	}
};
