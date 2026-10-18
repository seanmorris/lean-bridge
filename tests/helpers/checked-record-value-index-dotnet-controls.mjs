/**
 * Challenge .NET value-index evidence with independently destructive changes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	inspectCheckedRecordValueIndexDotnetCiHandoff
} from "./checked-record-value-index-dotnet-ci-handoff.mjs";
import {
	checkCheckedRecordValueIndexDotnetModels
} from "./checked-record-value-index-dotnet-model-records.mjs";
import {
	checkedRecordValueIndexDotnetRecords
	, checkCheckedRecordValueIndexDotnetReport
} from "./checked-record-value-index-dotnet-report.mjs";

const instantiation = type =>
	type.source.extensions["lean-lang.org/instantiation"];

/**
 * Require provenance, Git, package, caller and observation mutations to fail.
 *
 * @param originalRead - Selection-relative original record reader.
 * @param options - Exact route, revisions, runtime and toolchain pins.
 */
export const checkCheckedRecordValueIndexDotnetControls = async (
	originalRead, options
) => {
	const nuget = JSON.parse(await originalRead("nuget.json"));
	const context = JSON.parse(await originalRead("installation.json"));
	const paths = checkedRecordValueIndexDotnetRecords(
		options.route, nuget, context
	);
	const originals = new Map();
	for(const path of paths)
		originals.set(path, Buffer.from(await originalRead(path)));
	const read = (records, changes = new Map()) => async path => {
		const bytes = changes.has(path) ? changes.get(path) : records.get(path);
		assert.ok(Buffer.isBuffer(bytes), `Missing original record: ${path}`);
		return Buffer.from(bytes);
	};
	const encode = value => Buffer.from(canonicalJson(value));
	const json = (records, path) => JSON.parse(records.get(path));
	const verify = async records => {
		const selectedRead = read(records);
		const archive = await inspectCheckedRecordValueIndexDotnetCiHandoff(
			selectedRead
		);
		if(options.archiveSha512 !== undefined)
			assert.equal(options.archiveSha512, archive.archiveSha512
				, "Independent NuGet SHA-512");
		return checkCheckedRecordValueIndexDotnetReport(selectedRead, {
			...options, archiveSha512: archive.archiveSha512
		});
	};
	const reject = async (records, pattern, label) => {
		assert.ok(pattern instanceof RegExp, `${label} pins an error pattern`);
		await assert.rejects(verify(records), pattern, label);
	};
	const accepted = await verify(originals);

	let recordControls = 0;
	const missing = new Map(originals);
	missing.delete("report.json");
	await reject(missing, /Missing original record: report\.json/u
		, "missing top-level report");
	recordControls++;
	const corrupted = new Map(originals);
	corrupted.set("configuration.json", Buffer.concat([
		corrupted.get("configuration.json"), Buffer.from("corrupted")
	]));
	await reject(corrupted, /JSON|Unexpected non-whitespace/u
		, "corrupted configuration record");
	recordControls++;

	const provenance = [
		["closed Bool value-index mutation", /On preserves/u, ir => {
			instantiation(ir.types.find(type => type.name === "On"))
				.arguments[0].value = "false";
		}]
		, ["Unicode String value-index mutation", /UnicodeToken preserves/u
			, ir => {
				instantiation(ir.types.find(type => type.name === "UnicodeToken"))
					.arguments[1].value = "λ";
			}
		]
		, ["same text under another value-index kind", /ZeroToken preserves/u
			, ir => {
				instantiation(ir.types.find(type => type.name === "ZeroToken"))
					.arguments[1] = {
						kind: "value"
						, type: { kind: "primitive", name: "string" }
						, value: "0"
					};
			}
		]
		, ["missing value-index provenance"
			, /WideToken has value-index provenance/u, ir => {
				delete ir.types.find(type => type.name === "WideToken")
					.source.extensions["lean-lang.org/instantiation"];
			}
		]
		, ["missing value-index record", /Exact value-index record set/u
			, ir => {
				ir.types = ir.types.filter(type => type.name !== "Off");
			}
		]
	];
	let provenanceControls = 0;
	for(const [label, pattern, mutate] of provenance)
	{
		const records = new Map(originals);
		const path = "build-0/model.json";
		const model = JSON.parse(records.get(path));
		mutate(model.bindingIr);
		records.set(path, encode(model));
		await reject(records, pattern, label);
		provenanceControls++;
	}

	const reconciled = new Map(originals);
	const reconcileReport = json(reconciled, "report.json");
	for(const attempt of [0, 1])
	{
		const path = `build-${attempt}/model.json`;
		const model = json(reconciled, path);
		model.bindingIr.types.find(type => type.name === "On")
			.fields[0].name = "renamed";
		model.bindingIrSha256 = hashBindingIr(model.bindingIr);
		const bytes = encode(model);
		reconciled.set(path, bytes);
		reconcileReport.builds[attempt].bindingIrSha256
			= model.bindingIrSha256;
		reconcileReport.builds[attempt].modelSha256 = sha256(bytes);
	}
	reconciled.set("report.json", encode(reconcileReport));
	await reject(reconciled, /independently reconciles/u
		, "reconciled non-provenance Binding IR mutation");

	const gitBound = new Map(originals);
	const gitReport = json(gitBound, "report.json");
	for(const attempt of [0, 1])
	{
		const path = `build-${attempt}/author-inputs.json`;
		const inputs = json(gitBound, path);
		inputs.find(item => item.path === "LICENSE").sha256 = "0".repeat(64);
		gitBound.set(path, encode(inputs));
		const stable = inputs.map(({
			path: name, mode, sha256: digest
		}) => ({ path: name, mode, sha256: digest }));
		gitReport.builds[attempt].authorInputsSha256
			= sha256(canonicalJson(stable));
	}
	gitBound.set("report.json", encode(gitReport));
	await reject(gitBound, /LICENSE/u, "Git-bound author input mutation");

	const archive = new Map(originals);
	const archivePath
		= "handoff/archives/Checkedrecordvalueindices.Api.1.0.0.nupkg";
	archive.set(archivePath, Buffer.concat([
		archive.get(archivePath), Buffer.from("changed")
	]));
	await reject(archive, /NuGet archive (?:byte length|SHA-256)/u
		, "prepared NuGet archive mutation");

	const caller = new Map(originals);
	caller.set("consumer.cs", Buffer.concat([
		caller.get("consumer.cs"), Buffer.from("\n// substituted caller\n")
	]));
	await reject(caller, /Installed C# caller source/u
		, "installed C# caller mutation");

	const observation = new Map(originals);
	const installed = json(observation, "installed.json");
	const observationReport = json(observation, "report.json");
	installed.counts.calls++;
	installed.run.stdout = JSON.stringify(installed.counts) + "\n";
	observationReport.observations[0] = installed;
	observation.set("installed.json", encode(installed));
	observation.set("report.json", encode(observationReport));
	await reject(observation, /installed value-index counts/u
		, "installed observation mutation");

	const runtime = new Map(originals);
	const runtimeRecord = json(runtime, "runtime.json");
	const runtimeReport = json(runtime, "report.json");
	runtimeRecord.glibc.stdout = "glibc 2.99\n";
	runtimeReport.runtime = runtimeRecord;
	runtime.set("runtime.json", encode(runtimeRecord));
	runtime.set("report.json", encode(runtimeReport));
	await reject(runtime, /Independent runtime record/u
		, "independent runtime mutation");

	const modelRead = read(originals);
	await assert.doesNotReject(checkCheckedRecordValueIndexDotnetModels({
		report: json(originals, "report.json"), read: modelRead
		, json: async path => JSON.parse(await modelRead(path))
		, route: options.route, producerCommit: options.producerCommit
	}), "Unchanged compiler model remains accepted");
	await verify(originals);
	return {
		accepted, records: paths.length, recordControls, provenanceControls
		, reconciliationControls: 1, gitBindingControls: 1
		, packageControls: 1, callerControls: 1
		, observationControls: 1, runtimeControls: 1
	};
};
