/**
 * Exercise independently installed .NET resource-bearing IO and task packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { appendFile, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { generateSyncWire } from "../../src/backends/c/sync-wire.mjs";
import { generateDotnetIO, generateDotnetTasks } from "../../src/backends/dotnet/sync-io.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { prepareLeaseProject, verifyLeaseModel } from "./native-lease-project.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const exec = promisify(execFile);
// NuGet normalizes .nuspec filenames and need not unpack OPC metadata.
// Check those bytes in the exact restored archive, not a guessed cache path.
const installedFile = async (dir, archive, name, path) => {
	if(path.startsWith("lib/") || path.startsWith("lean-bridge/") || path.startsWith("runtimes/")) return readFile(join(dir, path));
	assert.ok([name + ".nuspec", "README.md", "_rels/.rels", "[Content_Types].xml"].includes(path));
	const entry = path === "[Content_Types].xml" ? "\\[Content_Types\\].xml" : path;
	return (await exec("unzip", ["-p", archive, entry], { encoding: "buffer", maxBuffer: 1 << 20 })).stdout;
};
const json = async f => JSON.parse(await readFile(f, "utf8"));
const build = env.LEAN_BRIDGE_DOTNET_LEASE_BUILD;
test("NuGet uses source-named resource types and unambiguous private CLR accessors", async () => {
	const types = ["Ticket", "Dispose", "DisposeResource", "Action"].map((name, i) => {
		const lean = "Shared." + name, hash = String(i + 1).repeat(64);
		return { id: "lean:" + lean
			, kind: "resource"
			, host: null
			, resource: { kindId: "resource:" + lean + "/" + hash }
			, source: { declaration: lean, extensions: { "lean-bridge.dev/resource-identity": hash } } };
	});
	const entries = types.map((r, i) => ({ name: "make_" + i, declaration: "Lab.make" + i, parameters: [], effect: "IO", result: { kind: "named", id: r.id } }));
	const api = { component: { id: "resource-lab@1.0.0", name: "Lab" }
		, types
		, errors: []
		, declarations: entries.map(e => ({ source: { declaration: e.declaration }
			, parameters: []
			, resultMode: "value"
			, result: { type: e.result, ownership: "lease", lifetime: { scope: "explicit", anchor: null } } })) };
	const wire = generateSyncWire("lbc_lab", entries, { resources: types });
	const hash = "a".repeat(64), ledger = "liblb_task_resources_" + hash + ".so", library = "liblbc_lab.so";
	const evidence = { library
		, ledgerId: hash
		, runtimeIdentity: hash
		, componentId: api.component.id
		, componentReceiptSha256: hash
		, libraries: Object.fromEntries([library, ledger, "liblean_bridge_native.so", "libleanshared.so"].map(n => [n, hash])) };
	const { contracts, files } = await generateDotnetIO({ api, wire, evidence });
	for(const [i, name] of ["Ticket", "_Dispose", "DisposeResource", "_Action"].entries())
	{
		assert.ok(files["Api.cs"].includes("global::LeanBridge.Resources.@Shared.@" + name + " Make" + i));
		assert.ok(Object.values(contracts).some(source => source.includes("public sealed class @" + name + " : IDisposable")));
	}
	assert.doesNotMatch(files["Api.cs"], /UnsafeAccessor|NativeLibrary|stackalloc/u);
	await assert.rejects(generateDotnetIO({ api, wire, evidence: { ...evidence, ledgerId: null } }), /resource kind or ledger/u);
	// The same nominal kind at the wrong stage is not the declared failure.
	const typed = { ...entries[0], effect: "EIO", error: entries[0].result };
	const failureWire = generateSyncWire("lbc_lab", [typed], { resources: types });
	const factory = "error:EIO." + typed.declaration, step = "error:AsyncStep." + typed.declaration;
	const checked = id => ({ ...api
		, errors: [factory, step].map(i => ({id: i, payload: typed.error}))
		, declarations: [{ ...api.declarations[0], failure: {errors: [id]} }] });
	await generateDotnetIO({api: checked(factory), wire: failureWire, evidence});
	await assert.rejects(generateDotnetIO({api: checked(step), wire: failureWire, evidence}), /resource error stage/u);
	const shifted = {...failureWire, methods: failureWire.methods.map(m => ({...m, terminal: m.error, error: null}))};
	await assert.rejects(generateDotnetIO({api: checked(factory), wire: shifted, evidence}), /resource error stage/u);
});
test("build .NET resource IO and task handoffs from ordinary and compiler-reviewed Lean", { skip: !build, timeout: 3_600_000 }, async t => {
	const root = resolve(build);
	for(const route of env.LEAN_BRIDGE_DOTNET_LEASE_ROUTE ? [env.LEAN_BRIDGE_DOTNET_LEASE_ROUTE] : ["ordinary", "reviewed", "lookalike"])
	{
		assert.ok(["ordinary", "reviewed", "lookalike"].includes(route));
		for(const role of route === "lookalike" ? ["desk"] : ["desk", "depot"])
		{
			const { src, dir } = await prepareLeaseProject(root, route, role, "nuget"), outputRoot = join(dir, "handoff");
			// Different enclosing checkouts must not stamp their revisions into a
			// shared nominal DLL. Give each producer a real, distinct git HEAD.
			await run("git", ["init", "--quiet", "--initial-branch=fixture"], dir, env);
			await run("git", ["-c", "user.name=NuGet fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "--quiet", "-m", route + "/" + role], dir, env);
			const producerHead = await run("git", ["rev-parse", "HEAD"], dir, env);
			assert.match(producerHead, /^[0-9a-f]{40}$/u);
			await writeFile(join(dir, "producer-context.json"), canonicalJson({ producerHead }), { flag: "wx" });
			await buildCanonicalProject({ projectRoot: src, outputRoot, targets: ["nuget"], environment: env })
				.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
			if(route === "reviewed") assert.deepEqual(await json(join(src, "public.binding-ir.json")), await json(join(outputRoot, "binding-ir.json")));
			t.diagnostic("built " + route + "/" + role);
		}
	}
});

const inspect = async (root, route, role) => {
	const dir = join(root, route, role, "handoff"), task = role === "depot";
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	const [pkg] = receipt.packages, [archive] = pkg.artifacts, api = await json(join(dir, "binding-ir.json"));
	const evidence = await json(join(dir, "host-export-evidence.json")), { nominal, entries } = verifyLeaseModel(api, evidence, task);
	const { producerHead } = await json(join(root, route, role, "producer-context.json")); assert.match(producerHead, /^[a-f0-9]{40}$/u);
	assert.equal(pkg.profile, task ? "native-dotnet-task-v1" : "native-dotnet-io-v1"); assert.equal(pkg.runtimeDelivery, "embedded");
	assert.equal(pkg.name, "Acme." + (task ? "Depot" : route === "lookalike" ? "OtherDesk" : "Desk")); assert.equal(pkg.version, "1.0.0");
	assert.equal(hashBindingIr(api), receipt.profiles[0].bindingIrSha256); assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256);
	assert.equal(Boolean(evidence.reviewedSourceSha256), route === "reviewed");
	const proof = { route, role, name: pkg.name, version: pkg.version
		, profile: pkg.profile, archive, receiptSha256: result.receiptSha256
		, bindingIrSha256: hashBindingIr(api)
		, sourceTreeSha256: evidence.sourceTreeSha256
		, reviewedSourceSha256: evidence.reviewedSourceSha256
		, runtimeIdentity: pkg.runtimeIdentity, nominal: nominal.resource.kindId
		, producerHead };
	return { dir, api, entries, role, proof };
};
const pairOutput = "Ticket, Task<Ticket> and DeclaredError<Ticket> compose across the two installed packages";
const projectFile = (pkg, audit = false) => '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><UseAppHost>false</UseAppHost><Nullable>enable</Nullable><AllowUnsafeBlocks>' + audit + '</AllowUnsafeBlocks><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup>'
	+ pkg.map(p => `<PackageReference Include="${p.proof.name}" Version="[1.0.0]" />`).join("") + "</ItemGroup></Project>";
const pairClient = async (work, dotnet, pkg, program, audit = null) => {
	const base = await mkdtemp(join(work, "named-pair-")), project = join(base, "project"), feed = join(base, "feed"), cache = join(base, "cache");
	const moved = join(base, "app"); await mkdir(feed); await mkdir(project);
	for(const p of pkg) await copyFile(join(p.dir, p.proof.archive.path), join(feed, basename(p.proof.archive.path)), constants.COPYFILE_EXCL);
	const isolated = { ...env, DOTNET_CLI_HOME: join(base, "cli"), NUGET_PACKAGES: cache, MSBUILDDISABLENODEREUSE: "1", DOTNET_NOLOGO: "1" };
	const sdk = await sdkVersion(dotnet, project, isolated); await writeFile(join(project, "global.json"), canonicalJson({ sdk: { version: sdk, rollForward: "disable" } }));
	await writeFile(join(project, "Client.csproj"), projectFile(pkg, Boolean(audit)));
	await writeFile(join(project, "NuGet.Config"), "<configuration><packageSources><clear /></packageSources></configuration>");
	await copyFile(program, join(project, "Program.cs"));
	if(audit) await copyFile(audit, join(project, "Audit.cs"));
	await run(dotnet, ["restore", "Client.csproj", "--source", feed, "--configfile", "NuGet.Config", "--disable-parallel"], project, isolated);
	const output = join(base, "out");
	await run(dotnet, ["publish", "Client.csproj", "-c", "Release", "--no-restore", "--disable-build-servers", "-m:1", "/p:UseSharedCompilation=false", "--self-contained", "false", "-o", output], project, isolated);
	await rename(output, moved);
	for(const dir of [project, feed, cache]) await rm(dir, { recursive: true });
	const launch = args => run(dotnet, [join(moved, "Client.dll"), ...args], base, { PATH: "/unavailable", LANG: "C.UTF-8", DOTNET_EnableDiagnostics: "0", DOTNET_PROCESSOR_COUNT: "1", LEAN_NUM_THREADS: "1" });
	if(audit)
	{
		const orders = [];
		for(const order of ["desk-first", "depot-first"])
		{
			const observed = await launch([order]); assert.equal(observed, order + ": end, typed failure and cancellation finalized before explicit disposal; last error owner usable, zero owner and descriptor delta");
			orders.push({order, observed});
		}
		return orders;
	}
	const answer = await launch([]);
	assert.equal(answer, pairOutput); return answer;
};
const sdkVersion = async (dotnet, dir, vars) => {
	const sdk = (await run(dotnet, ["--list-sdks"], dir, vars)).split("\n").map(x => /^(8\.0\.\d+) \[/u.exec(x)?.[1]).filter(Boolean).sort((a, b) => +a.split(".")[2] - +b.split(".")[2]).at(-1);
	assert.ok(sdk); return sdk;
};
const smoke = env.LEAN_BRIDGE_DOTNET_LEASE_PAIR, pair = resolve("tests/fixtures/dotnet-task-resources/Pair.cs");
const terminalClient = resolve("tests/fixtures/dotnet-task-resources/Terminal.cs");
const terminalAudit = resolve("tests/fixtures/dotnet-sync-io/Audit.cs");
const terminal = env.LEAN_BRIDGE_DOTNET_STREAM_TERMINAL_ORIGINAL;
const terminalEvidence = async (work, dotnet, packages, route) => ({
	route, packages: packages.map(p => p.proof)
	, consumerSha256: sha256(await readFile(terminalClient))
	, observerSha256: sha256(await readFile(terminalAudit))
	, observations: await pairClient(work, dotnet, packages, terminalClient, terminalAudit)
});
test("installed CLR stream finalizers run before the application explicitly disposes its cursor", {skip: !terminal, timeout: 1_800_000}, async t => {
	const root = resolve(terminal), work = await mkdtemp(join(tmpdir(), "clr-stream-terminal-"));
	t.after(() => rm(work, {recursive: true, force: true}));
	const out = resolve(env.LEAN_BRIDGE_DOTNET_STREAM_TERMINAL_OUTPUT ?? "build/dotnet-stream-terminal");
	const pin = await json(resolve("docs/evidence/dotnet-resource-leases-20261122.json"));
	assert.equal(pin.installed.clients["Audit.cs"], sha256(await readFile(terminalAudit)));
	const dotnet = await run("which", [env.LEAN_BRIDGE_DOTNET ?? "dotnet"], work, env); await mkdir(out, {recursive: true});
	for(const route of ["ordinary", "reviewed"])
	{
		const packages = [await inspect(root, route, "desk"), await inspect(root, route, "depot")];
		for(const p of packages)
		{
			const original = pin.installed.rows.find(r => r.route === route).packages.find(r => r.role === p.role);
			for(const [key, value] of Object.entries(p.proof)) assert.deepEqual(value, original[key], key);
		}
		assert.equal(packages[0].proof.nominal, packages[1].proof.nominal);
		const result = await terminalEvidence(work, dotnet, packages, route);
		await writeFile(join(out, route + ".json"), canonicalJson(result));
	}
});
test("two installed IO/task NuGet packages use a source-named Ticket without an alias or unsafe code", { skip: !smoke, timeout: 600_000 }, async t => {
	const work = await mkdtemp(join(tmpdir(), "lease-pair-")); t.after(() => rm(work, { recursive: true, force: true }));
	const root = resolve(smoke), dotnet = await run("which", [env.LEAN_BRIDGE_DOTNET ?? "dotnet"], work, env);
	await pairClient(work, dotnet, [await inspect(root, "ordinary", "desk"), await inspect(root, "ordinary", "depot")], pair);
});

const capture = env.LEAN_BRIDGE_DOTNET_LEASE_CAPTURE, replay = env.LEAN_BRIDGE_DOTNET_LEASE_REPLAY;
test("relocated .NET packages share nominal resource leases through IO, callbacks, tasks and streams", { skip: !capture && !replay, timeout: 3_600_000 }, async t => {
	const root = resolve(replay ?? capture), work = await mkdtemp(join(tmpdir(), "installed-dotnet-resources-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const dotnet = await run("which", [env.LEAN_BRIDGE_DOTNET ?? "dotnet"], work, env), rows = [];
	const clients = { "Program.cs": resolve("tests/fixtures/dotnet-task-resources/Program.cs"), "Audit.cs": resolve("tests/fixtures/dotnet-sync-io/Audit.cs") };
	if(replay) for(const name of Object.keys(clients)) clients[name] = join(root, name);
	const clientHashes = { "Pair.cs": sha256(await readFile(replay ? join(root, "Pair.cs") : pair)) };
	for(const [name, file] of Object.entries(clients)) clientHashes[name] = sha256(await readFile(file));
	const foreign = await inspect(root, "lookalike", "desk");
	for(const route of ["ordinary", "reviewed"])
	{
		const pkg = [await inspect(root, route, "desk"), await inspect(root, route, "depot"), foreign];
		if(capture) await writeFile(join(root, route + ".stream-terminal.json"), canonicalJson(await terminalEvidence(work, dotnet, pkg.slice(0, 2), route)), {flag: "wx"});
		assert.equal(pkg[0].proof.nominal, pkg[1].proof.nominal); assert.notEqual(pkg[0].proof.nominal, foreign.proof.nominal);
		assert.equal(new Set(pkg.map(p => p.proof.producerHead)).size, 3);
		const base = join(work, route), feed = join(base, "feed"), project = join(base, "project"), cache = join(base, "pkgs");
		const output = join(base, "out"), moved = join(base, "relocated"); await mkdir(feed, { recursive: true }); await mkdir(project);
		const isolated = { ...env, DOTNET_CLI_HOME: join(base, "cli"), NUGET_PACKAGES: cache, MSBUILDDISABLENODEREUSE: "1", DOTNET_NOLOGO: "1" };
		const sdk = await sdkVersion(dotnet, project, isolated);
		assert.ok(sdk);
		await writeFile(join(project, "global.json"), canonicalJson({ sdk: { version: sdk, rollForward: "disable", allowPrerelease: false } }));
		const namedPair = await pairClient(work, dotnet, pkg.slice(0, 2), replay ? join(root, "Pair.cs") : pair);
		await writeFile(join(project, "Client.csproj"), projectFile(pkg, true));
		await writeFile(join(project, "NuGet.Config"), "<configuration><packageSources><clear /></packageSources></configuration>");
		for(const p of pkg) await copyFile(join(p.dir, p.proof.archive.path), join(feed, basename(p.proof.archive.path)), constants.COPYFILE_EXCL);
		for(const [f, src] of Object.entries(clients)) await copyFile(src, join(project, f), constants.COPYFILE_EXCL);
		await run(dotnet, ["restore", "Client.csproj", "--source", feed, "--configfile", "NuGet.Config", "--disable-parallel"], project, isolated);
		const assets = await json(join(project, "obj/project.assets.json")), packages = [];
		for(const p of pkg)
		{
			const lib = assets.libraries[p.proof.name + "/1.0.0"]; assert.equal(lib.type, "package");
			const dir = join(cache, lib.path), inner = await json(join(dir, "lean-bridge/package-receipt.json"));
			const archive = join(dir, basename(p.proof.archive.path).toLowerCase());
			assert.equal(sha256(await readFile(archive)), p.proof.archive.sha256);
			assert.equal(inner.sourceTreeSha256, p.proof.sourceTreeSha256); assert.equal(inner.bindingIrSha256, p.proof.bindingIrSha256);
			assert.equal(inner.runtimeIdentity, p.proof.runtimeIdentity); assert.equal(inner.sdk, sdk);
			const ledger = inner.resourceLedger; assert.equal(ledger.library, "liblb_task_resources_" + ledger.id + ".so");
			const native = "runtimes/linux-x64/native/", libraries = {}, contracts = {};
			for(const [path, record] of Object.entries(inner.files))
			{
				assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
				const bytes = await installedFile(dir, archive, p.proof.name, path); assert.equal(bytes.length, record.bytes); assert.equal(sha256(bytes), record.sha256);
				if(path.endsWith(".dll")) assert.ok(!bytes.includes(Buffer.from(p.proof.producerHead)), "consumer DLL contains staging checkout revision");
				if(path.startsWith(native)) libraries[basename(path)] = record.sha256;
			}
			const library = "liblbc_" + p.proof.name.toLowerCase().replaceAll(".", "_") + ".so";
			assert.deepEqual(Object.keys(libraries).sort(), [ledger.library, library, "libleanshared.so", "liblean_bridge_native.so"].sort());
			assert.equal(libraries[ledger.library], ledger.sha256);
			const kinds = p.api.types.filter(x => x.kind === "resource");
			assert.deepEqual(inner.resourceContracts, kinds.map(x => "LeanBridge.ResourceV1.H" + x.source.extensions["lean-bridge.dev/resource-identity"]).sort());
			for(const id of inner.resourceContracts) contracts[id] = inner.files["lib/net8.0/" + id + ".dll"].sha256;
			if(!replay || env.LEAN_BRIDGE_DOTNET_LEASE_COMPARE_SOURCES === "1")
			{
				const tasks = p.role === "depot", wire = generateSyncWire(library.slice(3, -3), p.entries, { tasks, resources: kinds });
				const auth = { library
					, libraries
					, ledgerId: ledger.id
					, componentReceiptSha256: inner.componentIdentity
					, componentId: p.api.component.id
					, runtimeIdentity: inner.runtimeIdentity };
				const generate = tasks ? generateDotnetTasks : generateDotnetIO;
				const generated = await generate({ api: p.api, wire, evidence: auth });
				const borrowed = structuredClone(p.api), member = borrowed.declarations.find(x => x.name === "count");
				member.parameters[0].ownership = "transfer";
				await assert.rejects(generate({ api: borrowed, wire, evidence: auth }), /resource ownership/u);
				const wrongTag = { ...wire, leases: wire.leases.map(r => ({ ...r, tag: r.tag + 1 })) };
				await assert.rejects(generate({ api: p.api, wire: wrongTag, evidence: auth }), /resource kind or ledger/u);
				const wrongError = structuredClone(p.api);
				wrongError.declarations.find(x => x.name === (tasks ? "checked" : "check_ticket")).failure.errors = [];
				await assert.rejects(generate({ api: wrongError, wire, evidence: auth }), /resource error/u);
				assert.equal(generated.assembly, inner.assembly); assert.deepEqual(Object.keys(generated.contracts).sort(), inner.resourceContracts);
				const source = "lean-bridge/dotnet/src/";
				for(const [f, bytes] of Object.entries(generated.files)) assert.equal(sha256(bytes), inner.files[source + inner.assembly + "/" + f].sha256);
				for(const [id, bytes] of Object.entries(generated.contracts)) assert.equal(sha256(bytes), inner.files[source + id + "/Resource.cs"].sha256);
			}
			packages.push({ ...p.proof, sdk, assembly: inner.assembly, assemblySha256: inner.files["lib/net8.0/" + inner.assembly + ".dll"].sha256, nativeSha256: libraries[library], ledger, contracts });
		}
		assert.deepEqual(packages[0].contracts, packages[1].contracts); assert.equal(Object.keys(packages[0].contracts).length, 2);
		assert.ok(Object.keys(packages[2].contracts).every(k => !Object.hasOwn(packages[0].contracts, k)));
		for(const p of packages.slice(1))
		{
			assert.deepEqual(p.ledger, packages[0].ledger); assert.equal(p.runtimeIdentity, packages[0].runtimeIdentity);
		}
		const misuse = join(project, "WrongTypes.cs");
		await writeFile(misuse, "static class WrongTypes { static uint Badge() => LeanBridge.LeaseDesk.Api.Count(LeanBridge.LeaseDepot.Api.Badge(1));\nstatic uint OtherTicket() => LeanBridge.LeaseDepot.Api.Count(LeanBridge.OtherDesk.Api.Issue(1)); }");
		const flags = ["Client.csproj", "-c", "Release", "--no-restore", "--disable-build-servers", "-m:1", "/p:UseSharedCompilation=false"];
		await assert.rejects(run(dotnet, ["build", ...flags], project, isolated), e => {
			for(const line of [1, 2]) assert.match(e.message, new RegExp("WrongTypes\\.cs\\(" + line + ",\\d+\\): error CS1503", "u"));
			assert.doesNotMatch(e.message, /Program\.cs\(\d+,\d+\): error/u); return true;
		});
		await rm(misuse);
		await run(dotnet, ["publish", ...flags, "--self-contained", "false", "-o", output], project, isolated);
		await rename(output, moved);
		for(const p of packages) for(const [id, hash] of Object.entries({ ...p.contracts, [p.assembly]: p.assemblySha256 }))
			assert.equal(sha256(await readFile(join(moved, id + ".dll"))), hash);
		await rm(feed, { recursive: true }); await rm(cache, { recursive: true }); await rm(project, { recursive: true });
		const withoutTools = { PATH: "/unavailable", LANG: "C.UTF-8", DOTNET_EnableDiagnostics: "0", DOTNET_PROCESSOR_COUNT: "1", LEAN_NUM_THREADS: "1", TMPDIR: base };
		const calls = [];
		for(const order of ["desk-first", "depot-first"])
		{
			const call = await run(dotnet, [join(moved, "Client.dll"), order], base, withoutTools, 180_000);
			assert.equal(call, order + ": shared nominal type, distinct foreign definition, typed errors, cancellation and stream cleanup; 3 components, 0 live identities, 0 leaked descriptors");
			calls.push(call);
		}
		const ledger = packages[0].ledger, nested = join(moved, "runtimes/linux-x64/native", ledger.library);
		const file = await readFile(nested).then(() => nested, e => { if(e.code !== "ENOENT") throw e; return join(moved, ledger.library); });
		assert.equal(sha256(await readFile(file)), ledger.sha256); await appendFile(file, Buffer.from([0]));
		assert.equal(await run(dotnet, [join(moved, "Client.dll"), "corrupt"], base, withoutTools), "tampered ledger rejected");
		rows.push({ route, packages, calls, namedPair }); t.diagnostic(route + " published clients, static negatives and tamper passed");
	}
	for(const i of [0, 1])
	{
		assert.equal(rows[0].packages[i].bindingIrSha256, rows[1].packages[i].bindingIrSha256);
		assert.notEqual(rows[0].packages[i].archive.sha256, rows[1].packages[i].archive.sha256);
		assert.deepEqual(rows[0].packages[i].contracts, rows[1].packages[i].contracts);
	}
	const report = { schemaVersion: 1, clients: clientHashes, rows }, file = join(root, "acceptance.json");
	if(replay)
	{
		const bytes = await readFile(file); assert.deepEqual(report, JSON.parse(bytes));
		if(env.LEAN_BRIDGE_DOTNET_LEASE_EXPECTED)
		{
			const pin = await json(resolve(env.LEAN_BRIDGE_DOTNET_LEASE_EXPECTED)); assert.equal(sha256(bytes), pin.acceptanceSha256); assert.deepEqual(pin.installed, report);
		}
	}
	else
	{
		for(const [name, file] of Object.entries({ ...clients, "Pair.cs": pair })) await copyFile(file, join(root, name), constants.COPYFILE_EXCL);
		await writeFile(file, canonicalJson(report), { flag: "wx" });
	}
});
