/**
 * Build ordinary, reviewed and independent stream-only NuGet releases for real managed await.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { generateSyncWire } from "../../src/backends/c/sync-wire.mjs";
import { generateDotnetTasks } from "../../src/backends/dotnet/sync-io.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, build = env.LEAN_BRIDGE_DOTNET_TASK_BUILD;
const parse = async p => JSON.parse(await readFile(p, "utf8"));
const scalars = "unit bool uint8 int8 uint16 int16 uint32 int32 uint64 int64 usize isize char string bytes nat int float32 float64".split(" ");
test("NuGet task signatures use managed awaitables only for genuine Lean delivery", async () => {
	const t = { kind: "primitive", name: "uint32" };
	const e = { name: "wire", declaration: "Example.wire", effect: "pure", delivery: "task", parameters: [{ type: t }], result: t };
	const api = { component: { id: "example@1", name: "Example" }
		, declarations: [{ source: { declaration: e.declaration }, resultMode: "promise", parameters: [{ name: "event" }] }] };
	// A keyword parameter and a method named Wire must not shadow generated code.
	const wire = generateSyncWire("lbc_example", [e], { tasks: true });
	const gen = options => generateDotnetTasks({ wire, api, evidence: null, ...options });
	const { files } = await gen();
	assert.match(files["Api.cs"], /Task<uint> Wire\(uint @event, global::System.Threading.CancellationToken cancellationToken = default\)/u);
	assert.match(files["Api.cs"], /global::LeanBridge.Example.Wire.Port0/u);
	assert.doesNotMatch(files["Api.cs"], /DllImport|stackalloc|Task\.FromResult/u);
	await assert.rejects(gen({ wire: { ...wire, wait: null } }), /requires real native delivery/u);
	await assert.rejects(gen({ wire: { ...wire, methods: [{ ...wire.methods[0], callbacks: [[0, "unit", "unit"]] }] } }), /callback contract/u);
	await assert.rejects(gen({ api: { ...api, declarations: [{ ...api.declarations[0], resultMode: "value" }] } }), /Invalid/u);
});
test("build .NET tasks and an independent stream-only peer on both author routes", { skip: !build, timeout: 3_600_000 }, async t => {
	const root = resolve(build);
	for(const route of env.LEAN_BRIDGE_DOTNET_TASK_ROUTE ? [env.LEAN_BRIDGE_DOTNET_TASK_ROUTE] : ["ordinary", "reviewed", "peer"])
	{
		assert.ok(["ordinary", "reviewed", "peer"].includes(route));
		const dir = join(root, route), src = join(dir, "source"), peer = route === "peer";
		const input = resolve("tests/fixtures", peer ? "python-lean-stream-only" : "c-lean-tasks");
		const config = await parse(join(input, "lean-bridge.exports.json"));
		await mkdir(src, { recursive: true });
		for(const f of ["lean-toolchain", peer ? "Signals.lean" : "Pulse.lean"])
			await copyFile(join(input, f), join(src, f), constants.COPYFILE_EXCL);
		if(!peer)
		{
			await copyFile(resolve("tests/fixtures/ruby-task-lab/RubyTasks.lean"), join(src, "RubyTasks.lean"), constants.COPYFILE_EXCL);
			config.modules.push("RubyTasks");
			const extra = [...scalars.map(s => "RubyTasks.rt_" + s), "RubyTasks.wide", "RubyTasks.terminal"];
			config.exports.push(...extra, "RubyTasks.direct", "RubyTasks.identity", "RubyTasks.base"); config.taskExports.push(...extra);
			config.taskIOErrors = ["RubyTasks.terminal"];
		}
		if(route === "reviewed")
		{
			await copyFile(join(root, "ordinary/handoff/binding-ir.json"), join(src, "public.binding-ir.json"), constants.COPYFILE_EXCL);
			delete config.exports;
		}
		config.targets = { nuget: { name: peer ? "Acme.Signals" : "Acme.Pulse", version: "1.0.0" } };
		await writeFile(join(src, "lakefile.toml"), `name="${peer ? "signals" : "pulse"}"\nversion="1.0.0"\n`
			+ config.modules.map(m => `[[lean_lib]]\nname="${m}"\n`).join(""), { flag: "wx" });
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config), { flag: "wx" });
		await buildCanonicalProject({ projectRoot: src, outputRoot: join(dir, "handoff"), targets: ["nuget"], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		const ir = await parse(join(dir, "handoff/binding-ir.json"));
		if(route === "reviewed") assert.deepEqual(ir, await parse(join(src, "public.binding-ir.json")));
		assert.ok(ir.declarations.some(d => d.resultMode === "async-iterator"));
		assert.equal(ir.declarations.some(d => d.resultMode === "promise"), !peer);
		t.diagnostic("built " + route + " NuGet task package");
	}
});
