/**
 * Exercise real NuGet restores of synchronous IO and task releases with an
 * independent peer. Both profiles use the same receipt, relocation and tamper checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { appendFile, copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { generateSyncWire } from "../../src/backends/c/sync-wire.mjs";
import { generateDotnetIO, generateDotnetTasks } from "../../src/backends/dotnet/sync-io.mjs";
import { dotnetComponentAssembly } from "../../src/backends/dotnet/copied-model.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { checkDotnetCallbackContract } from "./dotnet-callback-installed.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, journal = resolve("tests/fixtures/native-sync-io");
const parse = async p => JSON.parse(await readFile(p, "utf8"));
const scalars = "unit bool uint8 int8 uint16 int16 uint32 int32 uint64 int64 usize isize float32 float64 char string bytes nat int".split(" ");
const build = env.LEAN_BRIDGE_DOTNET_IO_BUILD;
test("NuGet IO exposes typed synchronous methods, rejects name collisions and ships its private sources", async () => {
	const t = { kind: "primitive", name: "uint32" }, result = { kind: "apply", constructor: "result", arguments: [t, t] };
	const e = { name: "choose", declaration: "Test.choose", effect: "EIO", parameters: [{ type: t }], result, error: result };
	const api = { component: { id: "net-project@1.0.0", name: "net-project" }, declarations: [{ source: { declaration: e.declaration }, resultMode: "value", parameters: [{ name: "event" }] }] };
	const wire = generateSyncWire("lbc_test", [e]);
	const gen = options => generateDotnetIO({ api, wire, evidence: null, ...options });
	const { assembly, files } = await gen(); assert.equal(assembly, "LeanBridge.NetProject");
	assert.equal(dotnetComponentAssembly(api.component), assembly);
	assert.equal(dotnetComponentAssembly({ id: "acme/lab-tools@2.0.0", name: "Custom display name" }), "LeanBridge.LabTools");
	assert.match(files["Api.cs"], /public static Result<uint, uint> Choose\(uint @event\)/u);
	assert.doesNotMatch(files["Api.cs"], /Task|DllImport|delegate\*|stackalloc/u);
	assert.match(files["Calls.cs"], /finally \{ clear\(output\); \}/u);
	const shadow = await gen({ wire: { ...wire, methods: [{ ...wire.methods[0], name: "wire" }] } });
	assert.match(shadow.files["Api.cs"], / Wire\(uint @event\) => global::LeanBridge\.NetProject\.Wire\.Call0/u);
	await assert.rejects(gen({ wire: { ...wire, wait: {} } }), /synchronous copied values/u);
	await assert.rejects(gen({ wire: { ...wire, methods: [...wire.methods, { ...wire.methods[0], name: "choose_" }] } }), /colliding/u);
	for(const path of ["package.json", "config/cli-package.v1.json", "nix/perl-engine-source-boundary.json"])
	{
		const manifest = await parse(path), included = manifest.files ?? manifest.includedFiles;
		for(const f of ["src/backends/dotnet/sync-io.mjs", "src/backends/dotnet/sync-wire.cs", "src/backends/dotnet/task-callbacks.cs", "src/backends/dotnet/task-delivery.cs", "src/backends/dotnet/task-loop.cs", "src/backends/dotnet/resource-contract.cs", "src/backends/dotnet/resource-wire.cs", "src/release/dotnet-io-package.mjs"]) assert.ok(included.includes(f), path + ": " + f);
	}
});
test("NuGet authenticates the synchronous iterator payload, phase and private operations", async () => {
	const scalar = name => ({kind: "primitive", name});
	const t = scalar("uint32"), text = scalar("string"), protocol = {open: "Lab.read", next: "Lab.next", close: "Lab.close"};
	const entry = {name: "read", declaration: protocol.open
		, delivery: "iterator", protocol, effect: "EIO"
		, parameters: [], result: t, error: text, stepError: t};
	const ids = ["error:EIO.Lab.read", "error:Step.Lab.read"];
	const api = {component: {id: "cursor-lab@1.0.0", name: "Lab"}, types: []
		, errors: ids.map((id,i) => ({id, category: "domain", payload: i ? t : text}))
		, declarations: [{name: "read"
		, source: {declaration: protocol.open
		, extensions: {
			"lean-lang.org/effect": "EIO"
			, "lean-bridge.dev/pull-effect": "EIO"
			, "lean-bridge.dev/pull-protocol": protocol}}
			, resultMode: "iterator"
			, result: {type: t, ownership: "copy"}
			, parameters: []
			, effects: []
			, failure: {unexpected: "poison-runtime", errors: ids}}]};
	const wire = generateSyncWire("lbc_test", [entry]), [method] = wire.methods;
	const gen = changes => generateDotnetIO({api, wire: {...wire, methods: [{...method,...changes}]}, evidence: null});
	const {files} = await gen({});
	assert.match(files["Api.cs"], /LeanCursor<uint> Read\(/u);
	for(const mutation of [{stepDeclaration: protocol.close}
		, {tagBytes: 2}, {result: "uint16"}
		, {terminal: method.error}
		, {names: {...method.names, next: method.names.close}}])
		await assert.rejects(gen(mutation), /Unverified .NET immediate pull/u);
});
test("NuGet checks OS grants, real task factories and concrete resource declarations", {
	skip: !env.LEAN_BRIDGE_DOTNET_IO_POLICY, timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "nuget-io-policy-")); t.after(() => rm(root, { recursive: true, force: true }));
	const src = join(root, "source"), out = join(root, "release"); await mkdir(src);
	for(const f of ["Journal.lean", "lean-toolchain", "lakefile.toml"]) await copyFile(join(journal, f), join(src, f));
	const refusals = [[{}, /requires nativeEffects "filesystem"/u]
		, [{ taskExports: ["Journal.store"], nativeEffects: ["filesystem"] }, /requires a real Lean Task/u]
		, [{ resources: ["Journal.echo"], nativeEffects: ["filesystem"] }, /resource must be a public concrete application type: Journal.echo/u]];
	for(const [extra, error] of refusals)
	{
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson({ schemaVersion: 1, modules: ["Journal"], exports: ["Journal.store"], nativeEffects: [], ...extra }));
		await assert.rejects(buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: ["nuget"], environment: env }), e => {
			assert.match([e.message, e.details?.stdout, e.details?.stderr].join("\n"), error); return true;
		});
		await assert.rejects(lstat(out), { code: "ENOENT" });
	}
});
test("build ordinary and reviewed .NET IO packages and an independent peer", { skip: !build, timeout: 3_600_000 }, async t => {
	const root = resolve(build);
	const routes = env.LEAN_BRIDGE_DOTNET_IO_ROUTE ? [env.LEAN_BRIDGE_DOTNET_IO_ROUTE] : ["ordinary", "reviewed", "peer"];
	for(const route of routes)
	{
		assert.ok(["ordinary", "reviewed", "peer"].includes(route));
		const dir = join(root, route), src = join(dir, "source"), peer = route === "peer";
		await mkdir(src, { recursive: true });
		const copy = (from, to) => copyFile(from, join(src, to), constants.COPYFILE_EXCL);
		await copy(join(journal, "lean-toolchain"), "lean-toolchain");
		const config = await parse(join(journal, "lean-bridge.exports.json"));
		if(peer)
		{
			await writeFile(join(src, "Clock.lean"), "namespace Clock\ndef read : BaseIO UInt32 := pure 71\nend Clock\n", { flag: "wx" });
			config.modules = ["Clock"]; config.exports = ["Clock.read"]; config.nativeEffects = [];
		}
		else
		{
			await copy(join(journal, "Journal.lean"), "Journal.lean");
			await copy(resolve("tests/fixtures/ruby-sync-io/RubyIO.lean"), "RubyIO.lean");
			config.modules.push("RubyIO"); config.exports.push(...scalars.map(n => "RubyIO.rt_" + n), "RubyIO.nested");
		}
		config.targets = { nuget: { name: peer ? "Acme.Clock" : "Acme.Journal", version: "1.2.0-rc.1" } };
		if(route === "reviewed")
		{
			await copy(join(root, "ordinary/handoff/binding-ir.json"), "public.binding-ir.json"); delete config.exports;
		}
		await writeFile(join(src, "lakefile.toml"), `name="${peer ? "clock" : "journal"}"\nversion="1.0.0"\n`
			+ config.modules.map(m => `[[lean_lib]]\nname="${m}"\n`).join(""), { flag: "wx" });
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config), { flag: "wx" });
		await buildCanonicalProject({ projectRoot: src, outputRoot: join(dir, "handoff"), targets: ["nuget"], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		if(route === "reviewed") assert.deepEqual(await parse(join(src, "public.binding-ir.json")), await parse(join(dir, "handoff/binding-ir.json")));
		t.diagnostic("built " + route + " package");
	}
});

const appFiles = ["Program.cs", "Audit.cs"], fixture = resolve("tests/fixtures/dotnet-sync-io");
const handoff = async (releases, route, tasks, callbacks) => {
	const dir = join(releases, route, "handoff");
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	await assertJsonSchema("package-set-receipt", receipt);
	const api = await parse(join(dir, "binding-ir.json")), evidence = await parse(join(dir, "host-export-evidence.json"));
	const [p] = receipt.packages, [archive] = p.artifacts;
	assert.equal(p.profile, tasks ? "native-dotnet-task-v1" : "native-dotnet-io-v1"); assert.equal(p.target, "nuget"); assert.equal(p.runtimeDelivery, "embedded");
	const pair = callbacks ? ["Acme.Feedback", "Acme.Relay"] : tasks ? ["Acme.Pulse", "Acme.Signals"] : ["Acme.Journal", "Acme.Clock"];
	assert.equal(p.name, pair[Number(route === "peer")]);
	assert.equal(p.version, tasks ? "1.0.0" : "1.2.0-rc.1");
	if(tasks)
	{
		assert.equal(api.declarations.some(d => d.resultMode === "async-iterator"), !callbacks || route === "peer");
		assert.equal(api.declarations.some(d => d.resultMode === "promise"), Boolean(callbacks) || route !== "peer");
	}
	else assert.ok(api.declarations.every(d => d.resultMode === "value" && !d.effects.includes("async")));
	assert.equal(hashBindingIr(api), receipt.profiles[0].bindingIrSha256); assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256);
	assert.equal(Boolean(evidence.reviewedSourceSha256), route === "reviewed");
	if(callbacks) checkDotnetCallbackContract(api, evidence, route === "peer");
	else if(route !== "peer")
	{
		const name = tasks ? "RubyTasks.wide" : "Journal.choose", choose = api.declarations.find(d => d.source.declaration === name);
		assert.equal(choose.source.extensions["lean-lang.org/effect"], "EIO");
		assert.deepEqual(api.errors.find(e => e.id === choose.failure.errors[0]).payload, choose.result.type);
		assert.equal(api.declarations.find(d => d.source.declaration === (tasks ? "Pulse.ioTask" : "Journal.store")).source.extensions["lean-lang.org/effect"], "IO");
		const review = doc => reconcileHostExports({ ...evidence, ir: null, component: api.component, review: { source: canonicalJson(doc) } });
		assert.deepEqual(review(api).api, api);
		const fake = structuredClone(api);
		fake.declarations.find(d => d.source.declaration === name).result.type = { kind: "primitive", name: "bool" };
		assert.throws(() => review(fake), /Reviewed API differs/u);
	}
	const proof = { route, name: p.name, version: p.version, profile: p.profile
		, archive, receiptSha256: result.receiptSha256
		, bindingIrSha256: hashBindingIr(api), runtimeIdentity: p.runtimeIdentity
		, sourceTreeSha256: evidence.sourceTreeSha256
		, reviewedSourceSha256: evidence.reviewedSourceSha256 };
	return { dir, proof, api, evidence };
};
const checkInstalled = async (t, { tasks, callbacks, prefix, capture, replay }) => {
	const root = resolve(replay ?? capture), peer = await handoff(root, "peer", tasks, callbacks);
	const work = await mkdtemp(join(tmpdir(), "installed-nuget-io-")); t.after(() => rm(work, { recursive: true, force: true }));
	const dotnet = await run("which", [env.LEAN_BRIDGE_DOTNET ?? "dotnet"], work, env);
	const clients = {}, rows = [];
	const clientFile = file => join(replay ? root : tasks && file === "Program.cs" ? resolve("tests/fixtures", callbacks ? "dotnet-retained-tasks" : "dotnet-tasks") : fixture, file);
	for(const file of appFiles) clients[file] = sha256(await readFile(clientFile(file)));
	for(const route of ["ordinary", "reviewed"])
	{
		const primary = await handoff(root, route, tasks, callbacks), pkgs = [primary, peer], scratch = join(work, route);
		const feed = join(scratch, "feed"), project = join(scratch, "project"), cache = join(scratch, "packages");
		const stage = join(scratch, "output"), moved = join(scratch, "relocated"); await mkdir(feed, { recursive: true }); await mkdir(project);
		assert.equal(peer.proof.runtimeIdentity, primary.proof.runtimeIdentity);
		for(const p of pkgs) await copyFile(join(p.dir, p.proof.archive.path), join(feed, basename(p.proof.archive.path)), constants.COPYFILE_EXCL);
		for(const file of appFiles) await copyFile(clientFile(file), join(project, file), constants.COPYFILE_EXCL);
		await writeFile(join(project, "NuGet.Config"), "<configuration><packageSources><clear /></packageSources></configuration>");
		await writeFile(join(project, "Client.csproj"), `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup>${pkgs.map(p => `<PackageReference Include="${p.proof.name}" Version="[${p.proof.version}]" />`).join("")}</ItemGroup></Project>`);
		const install = { ...env, DOTNET_CLI_HOME: join(scratch, "cli"), NUGET_PACKAGES: cache, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", MSBUILDDISABLENODEREUSE: "1" };
		const sdk = (await run(dotnet, ["--list-sdks"], project, install)).split("\n").map(s => /^(8\.0\.\d+) \[/u.exec(s)?.[1]).filter(Boolean).sort((a, b) => Number(a.split(".")[2]) - Number(b.split(".")[2])).at(-1);
		assert.ok(sdk);
		await writeFile(join(project, "global.json"), canonicalJson({ sdk: { version: sdk, rollForward: "disable", allowPrerelease: false } }));
		await run(dotnet, ["restore", "Client.csproj", "--source", feed, "--configfile", "NuGet.Config", "--disable-parallel", "/p:NuGetAudit=false"], project, install, 300_000);
		const assets = await parse(join(project, "obj/project.assets.json")), installed = [];
		for(const p of pkgs)
		{
			const asset = assets.libraries[p.proof.name + "/" + p.proof.version]; assert.equal(asset.type, "package");
			const dir = join(cache, asset.path), inner = await parse(join(dir, "lean-bridge/package-receipt.json"));
			const bytes = await readFile(join(dir, basename(p.proof.archive.path).toLowerCase())); assert.equal(sha256(bytes), p.proof.archive.sha256);
			assert.equal(inner.bindingIrSha256, p.proof.bindingIrSha256); assert.equal(inner.runtimeIdentity, p.proof.runtimeIdentity);
			assert.equal(inner.sourceTreeSha256, p.proof.sourceTreeSha256); assert.equal(inner.profile, p.proof.profile);
			const assembly = dotnetComponentAssembly(p.api.component); assert.equal(inner.assembly, assembly); assert.equal(inner.namespace, assembly);
			const dll = `lib/net8.0/${assembly}.dll`;
			for(const [path, file] of Object.entries(inner.files).filter(([path]) => /^(lib|runtimes|lean-bridge)\//u.test(path)))
			{
				const b = await readFile(join(dir, path)); assert.equal(b.length, file.bytes); assert.equal(sha256(b), file.sha256);
			}
			const source = await readFile(join(dir, "lean-bridge/dotnet/src", assembly, "Api.cs"), "utf8");
			assert.doesNotMatch(source, /DllImport|delegate\*|stackalloc/u);
			assert.equal(/\bTask\b/u.test(source), tasks && (Boolean(callbacks) || p !== peer));
			assert.equal(source.includes("IAsyncEnumerable<"), tasks && (!callbacks || p === peer));
			assert.equal(source.includes("global::System.Func<"), Boolean(callbacks));
			const nativeLibrary = "liblbc_" + p.proof.name.toLowerCase().replaceAll(".", "_") + ".so";
			const nativeSha256 = inner.files["runtimes/linux-x64/native/" + nativeLibrary].sha256;
			if(!replay)
			{
				const libraries = Object.fromEntries(Object.entries(inner.files).filter(([f]) => f.startsWith("runtimes/linux-x64/native/")).map(([f, v]) => [basename(f), v.sha256]));
				const { entries, api } = reconcileHostExports({ ...p.evidence, ir: null, component: p.api.component });
				assert.deepEqual(api, p.api);
				const wire = generateSyncWire(nativeLibrary.slice(3, -3), entries, { tasks });
				const generated = await (tasks ? generateDotnetTasks : generateDotnetIO)({ api, wire, evidence: { libraries, library: nativeLibrary, componentId: api.component.id, componentReceiptSha256: inner.componentIdentity, runtimeIdentity: inner.runtimeIdentity } });
				for(const [f, bytes] of Object.entries(generated.files)) assert.equal(sha256(bytes), inner.files["lean-bridge/dotnet/src/" + assembly + "/" + f].sha256);
			}
			installed.push({ ...p.proof, assembly, assemblySha256: inner.files[dll].sha256, sdk: inner.sdk, nativeLibrary, nativeSha256 });
		}
		await run(dotnet, ["build", "Client.csproj", "-c", "Release", "--no-restore", "--disable-build-servers", "-m:1", "/p:UseSharedCompilation=false", "-o", stage], project, install, 300_000);
		await rename(stage, moved);
		for(const p of installed) assert.equal(sha256(await readFile(join(moved, p.assembly + ".dll"))), p.assemblySha256);
		const parked = tasks && !callbacks && (!replay || env.LEAN_BRIDGE_DOTNET_PARKED_PULL === "1");
		const parkedApp = join(scratch, "parked-consumer"), parkedClient = resolve("tests/fixtures/dotnet-tasks/Parked.cs");
		if(parked)
		{
			if(replay)
			{
				const pin = await parse(resolve("docs/evidence/dotnet-tasks-20261122.json"));
				assert.equal(sha256(await readFile(join(root, "acceptance.json"))), pin.acceptanceSha256);
				assert.deepEqual(installed, pin.installed.rows.find(row => row.route === route).installed);
				assert.deepEqual(clients, pin.installed.clients);
			}
			// Never overwrite the archived source or use regenerated assemblies.
			await copyFile(parkedClient, join(project, "Program.cs"));
			await run(dotnet, ["build", "Client.csproj", "-c", "Release", "--no-restore", "--no-incremental", "--disable-build-servers", "-m:1", "/p:UseSharedCompilation=false", "-o", parkedApp], project, install, 300_000);
			for(const p of installed) assert.equal(sha256(await readFile(join(parkedApp, p.assembly + ".dll"))), p.assemblySha256);
		}
		await rm(feed, { recursive: true }); await rm(cache, { recursive: true }); await rm(project, { recursive: true });
		const withoutTools = { PATH: "/unavailable", LANG: "C.UTF-8", DOTNET_NOLOGO: "1", DOTNET_EnableDiagnostics: "0", DOTNET_PROCESSOR_COUNT: "1", LEAN_NUM_THREADS: "1", TMPDIR: scratch };
		if(parked)
		{
			const observations = [];
			for(const order of ["pulse-first", "peer-first"])
			{
				const output = await run(dotnet, [join(parkedApp, "Client.dll"), order], scratch, withoutTools, 120_000);
				assert.equal(output, order + ": parked token cancellation finalized before disposal; disposal woke a second blocked pull; no late items or live owners");
				observations.push(output);
			}
			const out = resolve(env.LEAN_BRIDGE_DOTNET_PARKED_PULL_OUTPUT ?? "build/dotnet-parked-pull");
			await mkdir(out, {recursive: true});
			await writeFile(join(out, route + ".json"), canonicalJson({route, installed, observations, consumerSha256: sha256(await readFile(parkedClient)), observerSha256: clients["Audit.cs"]}));
		}
		const calls = [];
		for(const order of [callbacks ? "feedback-first" : tasks ? "pulse-first" : "journal-first", "peer-first"])
		{
			const output = await run(dotnet, [join(moved, "Client.dll"), order], scratch, withoutTools, 120_000);
			assert.equal(output, order + (callbacks ? ": 19 retained carriers, nested owner reentry, exception identity, revocation, cancellation and shared trap; 2 components, 0 live identities" : tasks ? ": 19 scalars, genuine await, cancellation, pull backpressure, disposal and retirement; shared owner, 2 components, 0 live identities" : ": 19 scalars, nested EIO/Except, IO order, validation, retirement; 1 runtime, 2 components, 0 live identities"));
			calls.push(output);
		}
		const native = installed[0], nested = join(moved, "runtimes/linux-x64/native", native.nativeLibrary);
		const path = await lstat(nested).then(() => nested, e => { if(e.code !== "ENOENT") throw e; return join(moved, native.nativeLibrary); });
		assert.equal(sha256(await readFile(path)), native.nativeSha256);
		await appendFile(path, Buffer.from([0]));
		assert.equal(await run(dotnet, [join(moved, "Client.dll"), "corrupt"], scratch, withoutTools), "tampered native library rejected");
		rows.push({ route, installed, calls }); t.diagnostic(route + " offline consumers and tamper check passed");
	}
	assert.equal(rows[0].installed[0].bindingIrSha256, rows[1].installed[0].bindingIrSha256);
	assert.notEqual(rows[0].installed[0].archive.sha256, rows[1].installed[0].archive.sha256);
	const report = { schemaVersion: 1, clients, rows }, path = join(root, "acceptance.json");
	if(replay)
	{
		const bytes = await readFile(path); assert.deepEqual(report, JSON.parse(bytes));
		if(env[prefix + "EXPECTED"])
		{
			const pin = await parse(resolve(env[prefix + "EXPECTED"])); assert.equal(sha256(bytes), pin.acceptanceSha256); assert.deepEqual(report, pin.installed);
		}
	}
	else
	{
		for(const file of appFiles) await copyFile(clientFile(file), join(root, file), constants.COPYFILE_EXCL);
		await writeFile(path, canonicalJson(report), { flag: "wx" });
	}
};
const profiles = [{ tasks: false, prefix: "LEAN_BRIDGE_DOTNET_IO_" }
	, { tasks: true, prefix: "LEAN_BRIDGE_DOTNET_TASK_" }
	, { tasks: true, callbacks: true, prefix: "LEAN_BRIDGE_DOTNET_CALLBACK_" }];
for(const { tasks, callbacks, prefix } of profiles)
{
	const capture = env[prefix + "CAPTURE"], replay = env[prefix + "REPLAY"];
	test("relocated offline NuGet clients run both exact " + (callbacks ? "retained callback" : tasks ? "task" : "IO") + " packages in both orders"
		, { skip: !capture && !replay, timeout: 3_600_000 }, t => checkInstalled(t, { tasks, callbacks, prefix, capture, replay }));
}
