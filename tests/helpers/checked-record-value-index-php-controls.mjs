/**
 * Challenge native-PHP value-index evidence with independently destructive
 * substitutions before it is admitted to the archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexPhpReport
} from "./checked-record-value-index-php-ci-report.mjs";

const instantiation = type =>
	type.source.extensions["lean-lang.org/instantiation"];

/**
 * Require the live PHP checker to refuse changed provenance, input, package,
 * consumer, execution and runtime records.
 *
 * @param originals - Complete route records keyed by route-relative path.
 * @param options - Exact route, producer, runtime, floor and tool identities.
 */
export const checkCheckedRecordValueIndexPhpControls = async (
	originals, options
) => {
	const read = records => async path => {
		assert.ok(records.has(path), `Missing original record: ${path}`);
		return records.get(path);
	};
	const encode = value => Buffer.from(canonicalJson(value));
	const json = (records, path) => JSON.parse(records.get(path));
	const verify = async records => {
		const result = await checkCheckedRecordValueIndexPhpReport(read(records), options);
		assert.deepEqual([...records.keys()].sort(), result.records
			, "Retained records differ from the verified set");
		return result;
	};
	const reject = async (records, label) => {
		await assert.rejects(verify(records), undefined, label);
	};
	const accepted = await verify(originals);

	const missing = new Map(originals); missing.delete("report.json");
	await reject(missing, "missing top-level report");
	const extra = new Map(originals); extra.set("unrecorded.json", Buffer.from("{}"));
	await reject(extra, "unread extra record");
	const corruptConfiguration = new Map(originals);
	corruptConfiguration.set("configuration.json", Buffer.concat([
		corruptConfiguration.get("configuration.json"), Buffer.from("corrupt")
	]));
	await reject(corruptConfiguration, "corrupt configuration record");

	const provenance = [
		["closed Bool value-index", ir => {
			instantiation(ir.types.find(type => type.name === "On"))
				.arguments[0].value = "false";
		}]
		, ["Unicode String value-index", ir => {
			instantiation(ir.types.find(type => type.name === "UnicodeToken"))
				.arguments[1].value = "λ";
		}]
		, ["same text under another value-index kind", ir => {
			instantiation(ir.types.find(type => type.name === "ZeroToken"))
				.arguments[1] = {
					kind: "value", type: { kind: "primitive", name: "string" }
					, value: "0"
				};
		}]
		, ["missing value-index provenance", ir => {
			delete ir.types.find(type => type.name === "WideToken")
				.source.extensions["lean-lang.org/instantiation"];
		}]
		, ["missing value-index record", ir => {
			const id = "lean:CheckedRecordValueIndices.Off";
			ir.types = ir.types.filter(type => type.id !== id);
			ir.declarations = ir.declarations.filter(declaration => ![
				...declaration.parameters.map(parameter => parameter.type)
				, declaration.result?.type
			].some(type => type?.id === id));
		}]
	];
	let provenanceControls = 0;
	for(const [label, mutate] of provenance)
	{
		const records = new Map(originals), report = json(records, "report.json");
		const path = "build-0/model.json", model = json(records, path);
		mutate(model.bindingIr); model.bindingIrSha256 = hashBindingIr(model.bindingIr);
		records.set(path, encode(model));
		report.builds[0].bindingIrSha256 = model.bindingIrSha256;
		report.builds[0].modelSha256 = sha256(records.get(path));
		records.set("report.json", encode(report));
		await reject(records, label); provenanceControls++;
	}

	const reconciled = new Map(originals), reconcileReport = json(reconciled, "report.json");
	for(const index of [0, 1])
	{
		const path = `build-${index}/model.json`, model = json(reconciled, path);
		model.bindingIr.types.find(type => type.name === "On").fields[0].name = "renamed";
		model.bindingIrSha256 = hashBindingIr(model.bindingIr); reconciled.set(path, encode(model));
		reconcileReport.builds[index].bindingIrSha256 = model.bindingIrSha256;
		reconcileReport.builds[index].modelSha256 = sha256(reconciled.get(path));
	}
	reconciled.set("report.json", encode(reconcileReport));
	await reject(reconciled, "reconciled non-provenance Binding IR");

	const author = new Map(originals);
	for(const index of [0, 1])
	{
		const path = `build-${index}/author-inputs.json`, inputs = json(author, path);
		inputs.find(item => item.path === "LICENSE").sha256 = "0".repeat(64);
		author.set(path, encode(inputs));
	}
	await reject(author, "Git-bound author input");

	const archive = new Map(originals), handoff = json(archive, "package.json").archive;
	const archivePath = `handoff/${handoff.path}`;
	archive.set(archivePath, Buffer.concat([archive.get(archivePath), Buffer.from("changed")]));
	await reject(archive, "prepared package archive byte");

	const packageMember = new Map(originals);
	const member = json(packageMember, "package.json").retained.find(path => path.endsWith("/Api.php"));
	packageMember.set(`package/${member}`, Buffer.concat([
		packageMember.get(`package/${member}`), Buffer.from("\n")
	]));
	await reject(packageMember, "generated package member");

	const caller = new Map(originals);
	caller.set("consumer.php", Buffer.concat([caller.get("consumer.php"), Buffer.from("\n")]));
	await reject(caller, "installed PHP caller");

	const weakStrict = new Map(originals);
	for(const place of ["installed", "relocated"])
	{
		const weak = `${place}-weak.json`, strict = `${place}-strict.json`;
		weakStrict.set(weak, originals.get(strict)); weakStrict.set(strict, originals.get(weak));
	}
	await reject(weakStrict, "weak and strict observations swapped");

	const relocated = new Map(originals), relocatedReport = json(relocated, "report.json");
	const relocatedObservation = json(relocated, "relocated-weak.json");
	relocatedObservation.relocated = false; relocatedReport.observations[2] = relocatedObservation;
	relocated.set("relocated-weak.json", encode(relocatedObservation));
	relocated.set("report.json", encode(relocatedReport));
	await reject(relocated, "relocation observation");

	const runtime = new Map(originals), runtimeReport = json(runtime, "report.json");
	const runtimeRecord = json(runtime, "runtime.json");
	runtimeRecord.glibc = "glibc 2.99"; runtimeReport.runtime = runtimeRecord;
	runtime.set("runtime.json", encode(runtimeRecord)); runtime.set("report.json", encode(runtimeReport));
	await reject(runtime, "independent runtime record");

	const tools = new Map(originals), toolsReport = json(tools, "report.json");
	const toolsRecord = json(tools, "tools.json"); toolsRecord.phpVersion = "8.9.0";
	toolsReport.tools = toolsRecord;
	tools.set("tools.json", encode(toolsRecord)); tools.set("report.json", encode(toolsReport));
	await reject(tools, "trusted PHP tools");

	if(options.route.endsWith("reviewed-ir"))
	{
		const reviewed = new Map(originals); reviewed.delete("build-0/api.binding-ir.json");
		await reject(reviewed, "reviewed Binding IR record");
	}
	await verify(originals);
	return {
		accepted, recordControls: 3, provenanceControls, reconciliationControls: 1
		, gitBindingControls: 1, packageControls: 2, callerControls: 1
		, observationControls: 2, runtimeControls: 1, toolControls: 1
		, reviewedControls: options.route.endsWith("reviewed-ir") ? 1 : 0
	};
};
