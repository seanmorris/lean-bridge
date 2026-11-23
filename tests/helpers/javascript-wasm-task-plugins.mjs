/** @file Compile and pack separate pthread Wasm components without linking either into the runtime. */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const threadedPluginNames = ["@example/lean-task-producer", "@example/lean-task-peer"];

/**
 * Compile each component from its own Lean module and return the required
 * runtime exports plus independently installable package archives.
 *
 * @param options - Prepared pinned compiler, build directory and local command runner.
 */
export const buildTaskPlugins = async options => {
	const {lean, emcc, root, core, command, npmConfig} = options;
	const source = resolve("tests/fixtures/javascript-wasm-task-components");
	await command(lean, ["-j1", "-R", source, "-c", join(root, "TaskPeer.c"), join(source, "TaskPeer.lean")]);
	const required = new Set(), archives = [];
	for(const [index, module] of ["ThreadProbe", "TaskPeer"].entries())
	{
		const name = threadedPluginNames[index], dir = join(root, module);
		await mkdir(dir);
		const symbols = index ? ["lean_bridge_task_peer_map"] : ["gate", "watch", "ready", "signal", "temp_io", "start"].map(s => "lean_bridge_probe_" + s);
		symbols.push("initialize_" + module);
		const inputs = [join(root, module + ".c")];
		if(index) inputs.push(join(source, "peer-worker.c"));
		const flags = ["-O2", "-g0", "-fPIC", "-pthread", "-fwasm-exceptions"
			, "-I", join(core, "include")
			, "-DLEAN_EMSCRIPTEN", "-DLEAN_MULTI_THREAD"
			, "-sSIDE_MODULE=2", "-Wl,--no-entry", "-Wl,--fatal-warnings"];
		const artifact = join(dir, "component.wasm");
		await command(emcc, [...flags, ...symbols.map(s => "-Wl,--export=" + s), ...inputs, "-o", artifact]);
		const binary = await WebAssembly.compile(await readFile(artifact));
		const exported = new Set(WebAssembly.Module.exports(binary).map(s => s.name));
		for(const s of symbols) assert.ok(exported.has(s), "missing side export " + s);
		for(const s of WebAssembly.Module.imports(binary))
		{
			if(exported.has(s.name)) continue; // A DSO can relocate its own functions or globals.
			if((s.module === "env" && s.kind === "function") || s.module === "GOT.mem" || s.module === "GOT.func")
				required.add("_" + s.name);
		}
		await copyFile(join(source, "package-entry.mjs"), join(dir, "index.mjs"));
		await writeFile(join(dir, "package.json"), JSON.stringify({name, version: "0.0.0", private: true, type: "module", exports: "./index.mjs"}));
		const [{filename}] = JSON.parse((await command("npm", ["pack", "--json", ...npmConfig], dir)).stdout);
		archives.push(join(dir, filename));
	}
	const flags = ["-DLEAN_BRIDGE_TASK_PLUGINS", "-I", source
		, "-sMAIN_MODULE=2", "-sEXPORTED_RUNTIME_METHODS=PThread,FS"
		, "-sEXPORTED_FUNCTIONS=" + JSON.stringify([...required].sort())];
	return {archives, flags};
};
