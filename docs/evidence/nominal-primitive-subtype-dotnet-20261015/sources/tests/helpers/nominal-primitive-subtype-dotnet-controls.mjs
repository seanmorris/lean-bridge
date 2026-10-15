/**
 * Refuse missing originals and coordinated changes without modifying producer evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypeDotnetReport, nominalPrimitiveSubtypeDotnetRecords } from "./nominal-primitive-subtype-dotnet-report.mjs";
import { checkNominalPrimitiveSubtypeDotnetModels } from "./nominal-primitive-subtype-dotnet-model-records.mjs";
import { checkNominalPrimitiveSubtypeDotnetPackage } from "./nominal-primitive-subtype-dotnet-package-records.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });

/**
 * Exercise original record readers, independently pinned tools and reconstructed source decisions.
 *
 * @param originalRead - Selection-relative retained-record reader.
 * @param options - Independent original selection, toolchain and archive pins.
 */
export const checkNominalPrimitiveSubtypeDotnetControls = async (originalRead, options) => {
	const accepted = await checkNominalPrimitiveSubtypeDotnetReport(originalRead, options);
	const nuget = JSON.parse(await originalRead("nuget.json"));
	const context = JSON.parse(await originalRead("installation.json"));
	const paths = nominalPrimitiveSubtypeDotnetRecords(options.route, options.mode, nuget, context);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const read = async (path, changes = new Map()) => {
		const bytes = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(bytes), `Missing original record: ${path}`);
		return Buffer.from(bytes);
	};
	const json = path => JSON.parse(originals.get(path));
	const encode = value => Buffer.from(canonicalJson(value));
	const reject = (changes, label) => assert.rejects(
		checkNominalPrimitiveSubtypeDotnetReport(path => read(path, changes), options), undefined, label
	);
	let recordControls = 0, environmentControls = 0, packageControls = 0;
	let modelControls = 0, executionControls = 0;
	for(const path of paths)
	{
		for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
		{
			await reject(new Map([[path, replacement]]), path); recordControls++;
		}
	}
	// Re-sign every duplicate environment identity so semantic checks must reject the change.
	const environmentChanges = [
		["consumer.cs", "inputs", text => text + "\n// substitute caller\n"]
		, ["Consumer.csproj", "inputs", text => text.replace("[1.0.0]", "*")]
		, ["NuGet.Config", "inputs", text => text.replace('value="feed"', 'value="https://example.invalid/feed"')]
		, ["global.json", "inputs", text => text.replace("disable", "latestMajor")]
		, ["obj/Consumer.csproj.nuget.g.props", "buildInputs", text => text.replace("</Project>", '<Import Project="/tmp/injected.props"/></Project>')]
		, ["obj/Consumer.csproj.nuget.g.targets", "buildInputs", text => text.replace(" />", '><Target Name="Injected"/></Project>')]
		, ["obj/Consumer.csproj.nuget.dgspec.json", "buildInputs", text => text.replace('"projectReferences": {}', '"projectReferences": {"/tmp/other.csproj": {}}')]
		, ["obj/project.assets.json", "buildInputs", text => text.replace('"related": ".xml"', '"related": ".unverified"')]
		, ["obj/project.nuget.cache", "buildInputs", text => text.replace('"success": true', '"success": false')]
		, ["out/Consumer.runtimeconfig.json", "outputs", text => text.replace('"net8.0"', '"net9.0"')]
		, ["out/Consumer.deps.json", "outputs", text => text.replace('"Consumer.dll"', '"Injected.dll"')]
	];
	for(const [path, group, transform] of environmentChanges)
	{
		const fullPath = "consumer-environment/" + path;
		const bytes = Buffer.from(transform(originals.get(fullPath).toString()));
		assert.notDeepEqual(bytes, originals.get(fullPath), path);
		const changed = json("installation.json"), packageRecord = json("nuget.json");
		const report = json("report.json"), key = group === "inputs" ? path : path.slice(path.indexOf("/") + 1);
		changed[group][key] = identity(bytes);
		const closure = { ...packageRecord.closure
			, buildInputsSha256: sha256(canonicalJson(changed.buildInputs))
			, deployedFilesSha256: sha256(canonicalJson(changed.outputs)) };
		packageRecord.closure = closure; report.installation = packageRecord;
		const changes = new Map([[fullPath, bytes]
			, ["installation.json", encode(changed)]
			, ["nuget.json", encode(packageRecord)]]);
		for(const [index, stage] of ["installed", "relocated", "source-free"].entries())
		{
			report.observations[index].closure = index === 2
				? { deployedFilesSha256: closure.deployedFilesSha256 } : closure;
			changes.set(stage + ".json", encode(report.observations[index]));
		}
		changes.set("report.json", encode(report));
		await reject(changes, path); environmentControls++;
	}
	const environmentMutations = [["PATH", "/usr/bin"]
		, ["DOTNET_STARTUP_HOOKS", "/tmp/hook.dll"]
		, ["NUGET_PACKAGES", "/tmp/shared"], ["DOTNET_MULTILEVEL_LOOKUP", "1"]];
	for(const [key, value] of environmentMutations)
	{
		const processes = json("api-probe/processes.json"); processes.environment[key] = value;
		await reject(new Map([["api-probe/processes.json", encode(processes)]]), key); environmentControls++;
	}
	for(const mutate of [
		value => { value.command = "/another/dotnet"; }
		, value => { value.interpreter.sha256 = "0".repeat(64); }
		, value => { value.sdk.version = "8.0.100"; }
		, value => { value.measurements[1].run.stdout = "8.0.100\n"; }
	]) {
		const tools = json("toolchain.json"), report = json("report.json");
		mutate(tools); report.tools = tools;
		await reject(new Map([["toolchain.json", encode(tools)], ["report.json", encode(report)]]), "tool identity");
		environmentControls++;
	}
	const probeMutations = [
		value => { value.restore.code = 1; }
		, value => { value.build.stderr = "unverified"; }
		, value => { value.build.code = options.mode === "full" ? 1 : 0; }
		, value => { value.cwd += "-elsewhere"; }
		, value => { value.diagnostics.runs[0].results = options.mode === "full" ? [{ ruleId: "unexpected" }] : []; }
	];
	for(const mutate of probeMutations)
	{
		const record = json("api-probe/record.json"), report = json("report.json");
		const processes = json("api-probe/processes.json"); mutate(record);
		report.apiProbe = { ...record, assemblySha256: report.apiProbe.assemblySha256 };
		processes.commands[0].run = record.restore; processes.commands[1].run = record.build;
		await reject(new Map([["api-probe/record.json", encode(record)]
			, ["api-probe/errors.sarif", encode(record.diagnostics)]
			, ["api-probe/processes.json", encode(processes)]
			, ["report.json", encode(report)]]), "coordinated API probe"); environmentControls++;
	}
	for(const mutate of [
		value => { value[0].observations[0].freeBytes = 1024; }
		, value => { value[0].observations[0].availableBytes = 1024; }
		, value => { value[0].observations.at(-1).load = value[0].maxLoad; }
		, value => { value[0].waits++; }
	]) {
		const checks = json("resources.json"), report = json("report.json"); mutate(checks);
		report.resourceChecks = checks;
		await reject(new Map([["resources.json", encode(checks)], ["report.json", encode(report)]]), "resource floor");
		environmentControls++;
	}
	const packageTargets = ["src/LeanBridge.Nominalprimitivesubtypes/Api.cs"
		, "src/LeanBridge.Nominalprimitivesubtypes/Runtime.cs"
		, "src/LeanBridge.Nominalprimitivesubtypes/LeanBridge.Nominalprimitivesubtypes.csproj"
		, "binding-manifest.json", "src/Injected.cs"];
	for(const target of packageTargets)
	{
		const changed = structuredClone(nuget);
		const receiptPath = "lean-bridge/package-receipt.json", compiledPath = "lean-bridge/native-dotnet.json";
		const receipt = json(`package/${receiptPath}`), compiled = json(`package/${compiledPath}`);
		const path = "lean-bridge/dotnet/" + target;
		const bytes = Buffer.concat([originals.get("package/" + path) ?? Buffer.alloc(0), Buffer.from("\n// substituted source\n")]);
		receipt.files[path] = identity(bytes); compiled.files[target] = identity(bytes);
		const compiledBytes = encode(compiled); receipt.compiledProjectionSha256 = sha256(compiledBytes);
		receipt.files[compiledPath] = identity(compiledBytes);
		const receiptBytes = encode(receipt); changed.compiled = compiled;
		changed.files = { ...receipt.files, [receiptPath]: identity(receiptBytes) };
		changed.retained = Object.keys(changed.files).sort().filter(path => !path.startsWith("runtimes/") && !path.endsWith(".dll"));
		changed.receiptSha256 = sha256(receiptBytes); changed.closure.receiptSha256 = sha256(receiptBytes);
		changed.closure.packageFileSetSha256 = sha256(canonicalJson(Object.keys(changed.files).sort()));
		const changes = new Map([["package/" + path, bytes]
			, ["package/" + compiledPath, compiledBytes]
			, ["package/" + receiptPath, receiptBytes]
			, ["nuget.json", encode(changed)]]);
		const changedRead = path => read(path, changes);
		await assert.rejects(checkNominalPrimitiveSubtypeDotnetPackage({ read: changedRead
			, json: async path => JSON.parse(await changedRead(path))
			, model: json("build-0/model.json")
			, receipt: json("build-0/package-set-receipt.json")
			, floor: options.floor, producerCommit: options.producerCommit
			, sdk: options.toolchain.sdk.version })); packageControls++;
	}
	const modelChanges = [
		value => { value.exports.pop(); }
		, value => { value.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, value => { value.exports.find(item => item.name.endsWith(".produce")).refinements.result.arguments[0].arguments[10].constructor = "NominalPrimitiveSubtypes.natA"; }
		, value => { value.exports.find(item => item.name.endsWith(".produce")).refinements.result.arguments[0].arguments[19].bound = "4"; }
	];
	if(options.mode === "full") modelChanges.push(value => {
		value.exports.find(item => item.name.endsWith(".echoA")).refinements.parameters[0].arguments[10].constructor = "NominalPrimitiveSubtypes.natB";
	});
	for(const mutate of modelChanges)
	{
		const model = json("build-0/model.json"), report = json("report.json"); mutate(model);
		const changes = new Map(), bytes = encode(model);
		for(const index of [0, 1])
		{
			changes.set(`build-${index}/model.json`, bytes); report.builds[index].modelSha256 = sha256(bytes);
		}
		const changedRead = path => read(path, changes);
		await assert.rejects(checkNominalPrimitiveSubtypeDotnetModels({ ...options
			, report, read: changedRead
			, json: async path => JSON.parse(await changedRead(path)) })); modelControls++;
	}
	for(const [index, stage] of ["installed", "relocated", "source-free"].entries())
	{
		const mutations = [
			value => { value.run.code = 1; }
			, value => { value.run.stderr = "unverified"; }
			, value => { value.counts.checks--; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
			, value => { value.counts.snapshotControls = 0; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
			, value => { value.cwd += "-wrong-tree"; value.framework.cwd = value.cwd; }
			, value => { value.framework.facts.version = "8.0.0"; value.framework.run.stdout = JSON.stringify(value.framework.facts) + "\n"; }
			, value => { value.framework.runtimeFiles["libcoreclr.so"].sha256 = "0".repeat(64); }
			, value => { value.framework.args[0] = "Other.dll"; }
			, value => { value.stage = "wrong"; }
			, value => { if(index === 2) value.sourcesRemoved = false; else value.closure.receiptSha256 = "0".repeat(64); }
		];
		for(const mutate of mutations)
		{
			const observation = json(stage + ".json"), report = json("report.json"); mutate(observation);
			report.observations[index] = observation;
			await reject(new Map([[stage + ".json", encode(observation)], ["report.json", encode(report)]]), stage);
			executionControls++;
		}
	}
	return { ...accepted, recordControls, environmentControls, packageControls, modelControls, executionControls };
};
