/**
 * Build the checksummed Perl ABI test matrix. No registry writes.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256, canonicalJson } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";

export const perlSourcePins = Object.freeze({
	"5.36.3": "f2a1ad88116391a176262dd42dfc52ef22afb40f4c0e9810f15d561e6f1c726a"
	, "5.38.2": "a0a31534451eb7b83c7d6594a497543a54d488bc90ca00f5e34762577f40655e"
});

/**
 * Compile one pinned interpreter with its own headers and core build modules.
 *
 * @param root0 - Named inputs for this native build or packaging operation.
 * @param root0.outputRoot - New output directory; existing output must not be overwritten.
 * @param root0.version - Pinned interpreter version or CPAN decimal release version.
 * @param root0.threaded - Whether to enable Perl interpreter threads.
 * @param root0.jobs - Maximum parallel compiler jobs.
 */
export async function buildPerlToolchain({ outputRoot, version, threaded, jobs = 4 })
{
	if(!perlSourcePins[version] || typeof threaded !== "boolean" || !Number.isSafeInteger(jobs) || jobs < 1) throw new TypeError("invalid Perl toolchain selection");
	const output = resolve(outputRoot), prefix = join(output, `${version}-${threaded ? "threaded" : "unthreaded"}`);
	await mkdir(output, { recursive: true });
	const receipt = { schemaVersion: 1, version, threaded, sourceSha256: perlSourcePins[version] };
	try
	{
		if(await readFile(join(prefix, "lean-bridge-toolchain.json"), "utf8") !== canonicalJson(receipt)) throw new Error("Perl toolchain cache identity mismatch");
		return join(prefix, "bin/perl");
	} catch(error)
	{ if(error.code !== "ENOENT") throw error; }
	const temporary = await mkdtemp(join(output, ".perl-build-"));
	const run = (command, args, cwd = temporary) => processBuildRunner.capture({ command, args, cwd, timeoutMs: 900_000, maxOutputBytes: 16 * 1024 * 1024 });
	try
	{
		const archive = join(temporary, "source.tar.gz");
		await run("curl", ["--fail", "--location", "--retry", "3", "--output", archive, `https://www.cpan.org/src/5.0/perl-${version}.tar.gz`]);
		if(sha256(await readFile(archive)) !== receipt.sourceSha256) throw new Error("Perl source checksum mismatch");
		await run("tar", ["-xzf", archive]);
		const source = join(temporary, `perl-${version}`);
		await run("sh", ["Configure", "-des", `-Dprefix=${prefix}`, "-Dman1dir=none", "-Dman3dir=none", "-Duse64bitint", threaded ? "-Dusethreads" : "-Uusethreads"], source);
		await run("make", [`-j${jobs}`], source);
		await run("make", ["install"], source);
		await run(join(prefix, "bin/perl"), ["-MExtUtils::CBuilder", "-MExtUtils::ParseXS", "-MJSON::PP", "-MMath::BigInt", "-e", "print $^V"]);
		await writeFile(join(prefix, "lean-bridge-toolchain.json"), canonicalJson(receipt));
		return join(prefix, "bin/perl");
	} finally
	{ await rm(temporary, { recursive: true, force: true }); }
}

if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
{
	const version = process.argv[2], mode = process.argv[3];
	if(!Object.hasOwn(perlSourcePins, version) || !["threaded", "unthreaded"].includes(mode)) throw new Error("Usage: node scripts/build-perl-toolchains.mjs 5.36.3|5.38.2 threaded|unthreaded [output]");
	process.stdout.write(`${await buildPerlToolchain({ version, threaded: mode === "threaded", outputRoot: process.argv[4] ?? ".toolchains/perl" })}\n`);
}
