/**
 * Replay a source-free C consumer against a fresh or retained release.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Compile using only two consumer files and the relocated installation prefix.
 *
 * @param options - Scratch root, installed prefix, consumer files, route label and process runner.
 */
export const exerciseInstalledCTask = async options => {
	const { root, prefix, fixture, route, run } = options;
	const env = { ...process.env, PKG_CONFIG_LIBDIR: join(prefix, "lib/pkgconfig"), PKG_CONFIG_PATH: "", LD_LIBRARY_PATH: "", LD_PRELOAD: "", LEAN_PATH: "", LEAN_SYSROOT: "" };
	const client = join(root, `client-${route}`);
	await mkdir(client);
	for(const f of ["consumer.c", "CMakeLists.txt"]) await copyFile(join(fixture, f), join(client, f));
	assert.deepEqual((await readdir(client)).sort(), ["CMakeLists.txt", "consumer.c"]);
	const flags = (await run("pkg-config", ["--cflags", "--libs", "pulse"], { env })).trim().split(/\s+/u);
	const app = join(client, "app"), cmake = process.env.LEAN_BRIDGE_C_TASK_CMAKE ?? "cmake", cmakeBuild = join(client, "cmake");
	await run("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "consumer.c", ...flags, "-pthread", "-ldl", "-o", app], { cwd: client, env });
	const deps = await run("ldd", [app], { env });
	for(const lib of ["liblbc_pulse.so", "liblean_bridge_native.so", "libleanshared.so"])
		assert.ok(deps.split("\n").some(line => line.trim().startsWith(`${lib} => ${prefix}/`)), `${lib} did not load from the installed prefix`);
	assert.equal((await run(app, [], { cwd: client, env })).trim(), "installed C tasks and demand-driven streams: ok");
	await run(cmake, ["-S", client, "-B", cmakeBuild, `-DCMAKE_PREFIX_PATH=${prefix}`], { cwd: client, env });
	await run(cmake, ["--build", cmakeBuild, "--parallel", "1"], { cwd: client, env });
	assert.equal((await run(join(cmakeBuild, "installed-task"), [], { cwd: client, env })).trim(), "installed C tasks and demand-driven streams: ok");
	return { cmake, app };
};
