/** @file Build the same checked host-object record through ordinary and reviewed NuGet routes. */
import assert from "node:assert/strict";
import {access, copyFile, cp, mkdir, mkdtemp, readFile, rename, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import test from "node:test";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";

const json = async p => JSON.parse(await readFile(p));
const fixture = resolve("tests/fixtures/dotnet-host-record");
const project = '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><UseAppHost>false</UseAppHost><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup><ItemGroup><PackageReference Include="Workshop.Host" Version="[1.0.0]"/></ItemGroup></Project>';

test("installed NuGet records separate copied CLR arrays from application-owned fields", {timeout: 1_800_000}, async t => {
	const root = await mkdtemp(join(tmpdir(), "dotnet-host-record-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	const cli = await installOfflineAuthor(root), dotnet = process.env.LEAN_BRIDGE_DOTNET ?? "dotnet";
	const output = resolve(process.env.LEAN_BRIDGE_DOTNET_HOST_RECORD_EVIDENCE ?? "build/dotnet-host-record");
	const source = await readFile(join(fixture, "Program.cs"));
	let review;
	for(const route of ["ordinary", "reviewed"])
	{
		const author = join(root, route + "-project"), out = join(root, route + "-handoff");
		await cp(resolve("tests/fixtures/ruby-host-meter"), author, {recursive: true, filter: p => !p.endsWith(".rb")});
		await copyFile(join(fixture, "Workshop.lean"), join(author, "Workshop.lean")); await copyFile(resolve("LICENSE"), join(author, "LICENSE"));
		const ir = await json(join(author, "lean-bridge.hosts.json"));
		ir.types[0].host.targets = ["dotnet"]; ir.types[0].documentation.summary = "An application-owned CLR meter.";
		await saveLakeFile(author, "lean-bridge.hosts.json", canonicalJson(ir));
		const cfg = await json(join(author, "lean-bridge.exports.json"));
		cfg.targets = {nuget: {name: "Workshop.Host", version: "1.0.0"}};
		if(route === "ordinary") cfg.exports = ["Gauge.createPair", "Gauge.flip", "Gauge.sumRead", "Gauge.choose", "Gauge.duplicateSample"];
		else
		{
			delete cfg.exports; await saveLakeFile(author, "public.binding-ir.json", review);
		}
		await saveLakeFile(author, "lean-bridge.exports.json", canonicalJson(cfg));
		const stage = join(root, route + "-installed"), src = join(stage, "src"), cache = join(stage, "cache"), dest = join(stage, "relocated");
		const env = {...process.env, DOTNET_CLI_HOME: stage
			, NUGET_PACKAGES: cache, DOTNET_NOLOGO: "1"
			, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_PROCESSOR_COUNT: "1"
			, MSBUILDDISABLENODEREUSE: "1"};
		const build = p => run(process.execPath, [cli, "build", "--project", author, "--target", "nuget", "--output", p, "--json", "--progress", "none"], root, env);
		await mkdir(src, {recursive: true}); await build(out);
		const api = await json(join(out, "binding-ir.json")), evidence = await json(join(out, "host-export-evidence.json"));
		const def = api.types.find(r => r.id === "lean:Gauge.Pair"), flip = api.declarations.find(r => r.source.declaration === "Gauge.flip");
		assert.equal(api.schemaVersion, 4); assert.equal(flip.parameters[0].ownership, "borrow"); assert.equal(flip.result.ownership, "lease");
		assert.deepEqual(def.fields.map(f => f.name), ["lead", "sample", "sequence", "spare"]);
		if(route === "ordinary")
		{
			assert.equal(evidence.reviewedSourceSha256, null);
			def.fields[1].documentation.summary = "Copied measurement bytes."; review = canonicalJson(api);
		}
		else
		{
			assert.equal(evidence.reviewedSourceSha256, sha256(review)); assert.deepEqual(api, JSON.parse(review));
			def.fields.reverse(); await saveLakeFile(author, "public.binding-ir.json", canonicalJson(api));
			const no = join(stage, "no-release"); await assert.rejects(build(no), /Reviewed API differs/u); await assert.rejects(access(no), {code: "ENOENT"});
		}
		const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(out, "package-set-receipt.json")});
		assert.equal(receipt.packages.length, 1); const [pkg] = receipt.packages; assert.equal(pkg.name, "Workshop.Host");
		await saveLakeFile(src, "NuGet.Config", "<configuration><packageSources><clear/></packageSources></configuration>");
		await saveLakeFile(src, "Client.csproj", project); await saveLakeFile(src, "Program.cs", source);
		const negative = await readFile(join(fixture, "WrongMeter.cs"));
		await saveLakeFile(src, "WrongMeter.cs", negative);
		const feed = dirname(join(out, pkg.artifacts[0].path));
		await run(dotnet, ["restore", "--source", feed, "--configfile", "NuGet.Config", "--disable-parallel", "-m:1", "-p:NuGetAudit=false"], src, env);
		assert.deepEqual(Object.keys((await json(join(src, "obj/project.assets.json"))).libraries), ["Workshop.Host/1.0.0"]);
		assert.match(await readFile(join(cache, "workshop.host/1.0.0/README.md"), "utf8"), /byte array properties return copies/u);
		await rm(author, {recursive: true}); await rm(out, {recursive: true});
		const compile = ["build", "--no-restore", "-c", "Release", "--disable-build-servers", "-m:1", "-p:UseSharedCompilation=false"];
		await assert.rejects(run(dotnet, [...compile, "-p:DefineConstants=WRONG_METER"], src, env), /CS1503: .*Pair<object>.*Pair<Meter>/u);
		await run(dotnet, compile, src, env);
		await rename(join(src, "bin/Release/net8.0"), dest);
		await rm(src, {recursive: true}); await rm(cache, {recursive: true});
		const observed = await run(dotnet, [join(dest, "Client.dll")], dest, {PATH: "/unavailable", LANG: "C.UTF-8", DOTNET_PROCESSOR_COUNT: "1", LEAN_NUM_THREADS: "1", TMPDIR: dest});
		assert.equal(observed, "CLR pair: original meters, isolated byte arrays, exact BigInteger, two-record prevalidation, partial native output, captured fields and last release");
		await mkdir(output, {recursive: true}); await saveLakeFile(output, route + ".package-set.json", canonicalJson(receipt));
		const execution = {route, observed
			, dotnet: await run(dotnet, ["--version"], root, env)
			, consumerSha256: sha256(source), wrongMeterSha256: sha256(negative)
			, wrongMeterDiagnostic: "CS1503: Pair<object> cannot be passed to this Pair<Meter> parameter"
			, packageSetSha256: result.receiptSha256
			, reviewedSourceSha256: evidence.reviewedSourceSha256};
		await saveLakeFile(output, route + ".execution.json", canonicalJson(execution));
		t.diagnostic(route + ": " + result.receiptSha256); await rm(stage, {recursive: true});
	}
});
