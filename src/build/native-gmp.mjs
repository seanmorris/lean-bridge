/**
 * Build the pinned GMP dependency separately from the shared Lean adapter ABI.
 *
 * @file
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { gmpIdentity, gmpSource } from "../backends/c/gmp.mjs";
import { processBuildRunner } from "./process-runner.mjs";

/**
 * Stage a relocatable shared GMP library, headers and complete corresponding source.
 *
 * @param options - Producer workspace and command environment.
 * @param options.root - Adapter staging directory.
 * @param options.environment - Selected native compiler environment.
 * @param options.signal - Optional build cancellation.
 */
export const buildNativeGmp = async ({ root, environment = process.env, signal }) => {
	const scratch = join(root, "gmp-build"), source = join(scratch, "gmp-6.3.0"), build = join(scratch, "build");
	await mkdir(build, { recursive: true });
	const archive = await gmpSource();
	await writeFile(join(scratch, "gmp.tar.xz"), archive, { flag: "wx" });
	const env = { ...environment, LC_ALL: "C", TZ: "UTC", SOURCE_DATE_EPOCH: "1" };
	const run = (command, args, cwd = build) => processBuildRunner.capture({ command, args, cwd, env, signal });
	const flags = ["--build=x86_64-pc-linux-gnu", "--host=x86_64-pc-linux-gnu"
		, "--enable-fat", "--enable-shared", "--disable-static"
		, "--disable-cxx", "--with-pic", "ABI=64"
		, `CC=${environment.CC ?? "cc"}`
		, `CFLAGS=-O2 -g0 -ffile-prefix-map=${scratch}=/build/gmp`
		, "LDFLAGS=-Wl,--build-id=none"];
	try
	{
		await run("tar", ["-xf", join(scratch, "gmp.tar.xz"), "-C", scratch]);
		await run("sh", [join(source, "configure"), ...flags]);
		await run("make", ["-j2"]);
		await run("make", ["-j2", "check"]);
		const files = { "include/gmp.h": join(build, "gmp.h"), "lib/libgmp.so.10": join(build, ".libs/libgmp.so.10.5.0") };
		for(const license of ["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"])
			files[`share/lean-bridge/licenses/GMP-${license}`] = join(source, license);
		const hashes = {};
		for(const [path, from] of Object.entries(files))
		{
			await mkdir(join(root, path.slice(0, path.lastIndexOf("/"))), { recursive: true });
			const bytes = path === "include/gmp.h"
				? Buffer.from("#if defined(__GNUC__)\n#pragma GCC system_header\n#endif\n" + (await readFile(from, "utf8")).replaceAll(scratch, "/build/gmp"))
				: await readFile(from);
			await writeFile(join(root, path), bytes);
			hashes[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		}
		await mkdir(join(root, "share/lean-bridge/sources"), { recursive: true });
		await writeFile(join(root, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"), archive);
		await writeFile(join(root, "share/lean-bridge/gmp.json"), canonicalJson({ ...gmpIdentity, files: hashes
			, compiler: (await run(environment.CC ?? "cc", ["--version"])).stdout.split("\n")[0]
			, configure: flags.map(flag => flag.replaceAll(scratch, "/build/gmp"))
			, checked: true }));
	} finally
	{ await rm(scratch, { recursive: true, force: true }); }
};
