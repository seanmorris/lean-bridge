/**
 * Install native handoffs and exercise the same effects from four languages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { sha256 } from "../../src/capsule/node.mjs";
import { checkEffectHandoff } from "./native-effect-packages.mjs";

const exec = promisify(execFile), clients = resolve("tests/fixtures/native-effect-clients");
/**
 * Run an installed-client tool and preserve its diagnostics on failure.
 *
 * @param cmd - Executable to launch.
 * @param args - Command arguments.
 * @param cwd - Isolated working directory.
 * @param env - Consumer environment.
 * @param timeout - Maximum duration in milliseconds.
 */
const run = async (cmd, args, cwd, env, timeout = 600_000) => {
	try
	{ return (await exec(cmd, args, { cwd, env, timeout, maxBuffer: 4 << 20 })).stdout.trim(); }
	catch(e)
	{
		const termination = e.signal ? `Terminated by ${e.signal} (wall-clock limit ${timeout} ms)` : null;
		throw new Error([e.message, termination, e.stdout, e.stderr].filter(Boolean).join("\n"), { cause: e });
	}
};
const ext = { c: "c", cpp: "cpp", pypi: "py", cargo: "rs", rubygems: "rb" };
export { run as runNativeTool };
/**
 * Run independent installed consumers with the producer toolchain off their runtime path.
 *
 * @param work - Disposable parent for this run.
 * @param releases - Original package handoffs.
 * @param target - Native language to exercise.
 * @param env - Installation tools and offline package cache.
 * @param sample - Installed package coordinates, client directory and receipt checks for this fixture.
 */
export const runEffectConsumers = async (work, releases, target, env, sample = {}) => {
	const client = join(sample.clients ?? clients, "consumer." + ext[target]);
	const reports = [];
	let ordinary;
	for(const route of sample.routes ?? ["ordinary", "reviewed"])
	{
		const handoff = join(releases, target, route, "handoff");
		const { report, receipt, api } = await (sample.check ?? checkEffectHandoff)(handoff, ordinary); ordinary ??= api;
		const component = receipt.packages.find(p => p.role === "component");
		const build = await mkdtemp(join(work, "install-")), app = await mkdtemp(join(work, "deployed-"));
		const bin = join(app, "client"), isolated = { PATH: "/unavailable", LANG: "C", LEAN_NUM_THREADS: "1", LEAN_BRIDGE_EFFECT_BOOT: "from-app", TMPDIR: app };
		const cmakeClient = sample.cmakeProject ? join(app, "client-cmake") : null;
		let installed;
		try
		{
			if(target === "pypi")
			{
				const py = env.LEAN_BRIDGE_PYTHON ?? "python3", python = await run(py, ["-c", "import sys; print(sys.executable)"], build, env);
				const prefix = join(app, "site");
				const args = ["-m", "pip", "--disable-pip-version-check", "install", "--no-index", "--no-cache-dir", "--only-binary", ":all:", "--find-links", join(handoff, "archives"), "--target", prefix, component.name + "==" + component.version];
				await run(python, args, build, env);
				await copyFile(client, bin); isolated.PYTHONPATH = prefix;
				await writeFile(join(app, "state"), "open");
				await run(python, ["-S", "-B", bin], app, isolated, 45_000);
			}
			else if(target === "rubygems")
			{
				const ruby = await run(env.LEAN_BRIDGE_RUBY ?? "ruby", ["--disable-gems", "-rrbconfig", "-e", "print RbConfig.ruby"], build, env);
				const dest = join(build, "gems"), moved = join(app, "installed");
				const archive = join(handoff, component.artifacts[0].path);
				await run(ruby, ["--disable-gems", "-rrubygems/gem_runner", "-e", "Gem::GemRunner.new.run(ARGV)", "--", "install", "--local", "--no-document", "--ignore-dependencies", archive], build, {...env, GEM_HOME: dest, GEM_PATH: dest, GEMRC: "/dev/null"});
				await rename(dest, moved);
				const isolatedGem = {...isolated, LANG: "C.UTF-8", GEM_PATH: moved, GEM_HOME: moved, GEMRC: "/dev/null"};
				const installedDir = await run(ruby, ["--disable-gems", "-rrubygems", "-e", "print Gem::Specification.find_by_name(ARGV.fetch(0)).full_gem_path", component.name], app, isolatedGem);
				assert.ok(installedDir.startsWith(join(moved, "gems") + "/"));
				installed = await sample.inspectPackage?.(target, installedDir, component);
				await copyFile(client, join(app, "client.rb")); await rm(build, {recursive: true});
				await writeFile(join(app, "state"), "open");
				await run(ruby, ["--disable-gems", "-rrubygems", "client.rb"], app, isolatedGem, 45_000);
			}
			else
			{
				const unpack = async p => {
					const dir = join(build, p.role); await mkdir(dir);
					await run("tar", ["-xzf", join(handoff, p.artifacts[0].path), "--strip-components=1", "-C", dir], build, env);
					return dir;
				};
				const prefix = await unpack(component);
				installed = await sample.inspectPackage?.(target, prefix, component);
				if(target === "cargo")
				{
					const runtime = receipt.packages.find(p => p.role === "runtime"), lib = await unpack(runtime);
					await mkdir(join(build, "src")); await copyFile(client, join(build, "src/main.rs"));
					await writeFile(join(build, "Cargo.toml"), `[package]\nname="installed-effects-client"\nversion="0.1.0"\nedition="2021"\n[dependencies]\n${JSON.stringify(component.name)}={path=${JSON.stringify(prefix)}}\n[patch.crates-io]\n${runtime.name}={path=${JSON.stringify(lib)}}\n`);
					const cargo = env.LEAN_BRIDGE_CARGO ?? "cargo", rust = { ...env, RUSTC: env.LEAN_BRIDGE_RUSTC ?? "rustc", CARGO_TARGET_DIR: join(build, "target"), CARGO_NET_OFFLINE: "true" };
					await run(cargo, ["generate-lockfile", "--offline"], build, rust);
					if(sample.checkCargoGraph)
					{
						const graph = JSON.parse(await run(cargo, ["metadata", "--locked", "--offline", "--format-version", "1"], build, rust));
						installed = { ...installed, ...sample.checkCargoGraph(graph, runtime) };
					}
					await run(cargo, ["build", "--locked", "--offline", "-j1"], build, rust);
					// Both directories belong to this disposable workspace. Move the
					// executable; its embedded runtime need not occupy disk twice.
					await rename(join(build, "target/debug/installed-effects-client"), bin);
				}
				else
				{
					const pc = { ...env, PKG_CONFIG_PATH: "", PKG_CONFIG_LIBDIR: join(prefix, "lib/pkgconfig") };
					const flags = (await run("pkg-config", ["--cflags", "--libs", component.name], build, pc)).split(/\s+/u);
					const cpp = target === "cpp";
					await run(cpp ? env.CXX ?? "c++" : env.CC ?? "cc", [cpp ? "-std=c++20" : "-std=c11", "-Wall", "-Wextra", "-Werror", client, ...flags, ...cpp ? [] : ["-pthread"], "-ldl", "-o", bin], build, env);
					if(cmakeClient)
					{
						const cmake = env.LEAN_BRIDGE_CMAKE ?? env.LEAN_BRIDGE_C_TASK_CMAKE ?? "cmake";
						await copyFile(sample.cmakeProject, join(build, "CMakeLists.txt"));
						await copyFile(client, join(build, cpp ? "main.cpp" : "main.c"));
						await run(cmake, ["-S", ".", "-B", "cmake-out", "-DCMAKE_PREFIX_PATH=" + prefix], build, env);
						await run(cmake, ["--build", "cmake-out", "--parallel", "1"], build, env);
						await rename(join(build, "cmake-out/client"), cmakeClient);
					}
					await rename(prefix, join(app, "installed")); isolated.LD_LIBRARY_PATH = join(app, "installed/lib");
				}
				// The executable cannot rely on the Cargo tree / build prefix or producer tools.
				await rm(build, { recursive: true }); await writeFile(join(app, "state"), "open");
				await run(bin, [], app, isolated, target === "cargo" ? sample.rustClientTimeoutMs ?? 45_000 : 45_000);
				if(cmakeClient)
				{
					assert.equal(await readFile(join(app, "state"), "utf8"), "closed");
					await writeFile(join(app, "state"), "open");
					await run(cmakeClient, [], app, isolated, 45_000);
				}
			}
			assert.equal(await readFile(join(app, "state"), "utf8"), "closed");
			reports.push({ target, route, ...report, consumerSha256: sha256(await readFile(client)), ...installed ? { installed } : {} });
		}
		finally
		{ await rm(build, { recursive: true, force: true }); await rm(app, { recursive: true, force: true }); }
	}
	return reports;
};
