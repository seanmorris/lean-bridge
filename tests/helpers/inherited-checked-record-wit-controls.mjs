/**
 * Refuse coordinated mutations of inherited checked-record WIT package and execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkInheritedCheckedRecordWitReport } from "./inherited-checked-record-wit-report.mjs";
import { checkInheritedCheckedRecordWitModels } from "./inherited-checked-record-wit-model-records.mjs";
import { checkInheritedCheckedRecordWitPackageRecords } from "./inherited-checked-record-wit-package-records.mjs";
import { inheritedCheckedRecordWitReceipt, inheritedCheckedRecordWitSources } from "./inherited-checked-record-wit-package.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

// Every inherited-record export carries a refinement tree; keep the filter explicit anyway.
const refined = model => model.exports.flatMap(item => item.refinements ? [item.refinements] : []);
const replaceLeaf = (value, predicate, mutate) => {
	if(!value || typeof value !== "object") return false;
	if(predicate(value))
	{ mutate(value); return true; }
	return Object.values(value).some(child => replaceLeaf(child, predicate, mutate));
};

/**
 * Coordinated compiler-model mutations that every retained build must refuse.
 * Each mutation asserts that it found a leaf to change, so an unrefined model cannot pass vacuously.
 *
 * @param mode - Full or result-only API; only the full API carries parameter constructors.
 */
export const inheritedCheckedRecordWitModelMutations = mode => [
	value => { value.pointerBits = 32; }
	, value => { value.exports.pop(); }
	, value => { value.sourceIdentity.extractorSha256 = "0".repeat(64); }
	, value => { assert.ok(replaceLeaf(refined(value), item => item.kind === "fin", item => { item.bound = "9"; })); }
	, value => { assert.ok(replaceLeaf(refined(value).map(item => item.result)
		, item => item.kind === "checked-record"
		, item => { item.constructor = "InheritedCheckedRecords.mkTicket"; })); }
	, ...mode === "full" ? [value => { assert.ok(replaceLeaf(refined(value).map(item => item.parameters), item => item.kind === "subtype" && item.constructor !== null, item => { item.constructor = "InheritedCheckedRecords.unreviewed"; })); }] : []
];

/**
 * Exercise missing originals and source, constructor, tool, closure and command drift.
 *
 * @param originalRead - Original selection-relative record reader.
 * @param options - Independently selected original author/API/runtime identities.
 */
export const checkInheritedCheckedRecordWitControls = async (originalRead, options) => {
	const accepted = await checkInheritedCheckedRecordWitReport(originalRead, options), originals = new Map();
	for(const path of accepted.records) originals.set(path, Buffer.from(await originalRead(path)));
	const json = path => JSON.parse(originals.get(path)), encode = value => Buffer.from(canonicalJson(value));
	const read = async (path, changes = new Map()) => {
		const bytes = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(bytes), `Missing original: ${path}`); return bytes;
	};
	const reject = (changes, label) => assert.rejects(checkInheritedCheckedRecordWitReport(path => read(path, changes), options), undefined, label);
	let recordControls = 0, executionControls = 0, toolControls = 0, resourceControls = 0, environmentControls = 0, packageControls = 0, modelControls = 0;
	for(const path of accepted.records) for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
	{ await reject(new Map([[path, replacement]]), path); recordControls++; }
	for(const [position, place] of ["installed", "relocated"].entries()) for(const mutate of [
		value => { value.run.code = 1; }
		, value => { value.run.stderr = "warning"; }
		, value => { value.counts.checks--; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.counts.snapshots = 0; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.counts.hostRejections--; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.counts.recoveries++; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.args.push("extra"); }
		, value => { value.command += "-substituted"; }
		, value => { value.cwd += "-not-the-moved-tree"; }
		, value => { value.relocated = !value.relocated; }
		, value => { value.environment.PATH = "/usr/bin"; }
		, value => { value.closure.consumerFileSetSha256 = "0".repeat(64); }
	]) {
		const report = json("report.json"), path = place + ".json", observation = json(path); mutate(observation);
		report.observations[position] = observation;
		await reject(new Map([[path, encode(observation)], ["report.json", encode(report)]]), path); executionControls++;
	}
	for(const mutate of [
		value => { value.selected.cc = "relative/cc"; }
		, value => { value.commands.cc.bytes = 0; }
		, value => { value.commands.cc.sha256 = "invalid"; }
		, value => { delete value.commands.getconf; }
		, value => { value.versions.wasmTools.run.stdout = "wasm-tools 0.0.1\n"; }
		, value => { value.versions.cc.command = "/unrecorded/cc"; }
		, value => { value.versions.cc.run.code = 1; }
		, value => { value.versions.cc.args.push("--unrecorded"); }
		, value => { value.wasmtime.version = "0.0.0"; }
		, value => { value.wasmtime.files["lib/libwasmtime.so"].sha256 = "0".repeat(64); }
		, value => { delete value.wasmtime.files["include/wasmtime/component.h"]; }
		, value => { value.wasmtime.root = "relative/wasmtime"; }
	]) {
		const tools = json("tools.json"), report = json("report.json"); mutate(tools); report.tools = tools;
		await reject(new Map([["tools.json", encode(tools)], ["tools-after.json", encode(tools)], ["report.json", encode(report)]]), "coordinated WIT tool records"); toolControls++;
	}
	for(const mutate of [
		value => { value[0].observations[0].freeBytes = 1024; }
		, value => { value[0].observations[0].availableBytes = 1024; }
		, value => { value[0].observations.at(-1).load = json("report.json").loadCeiling; }
		, value => { value[0].waits++; }
	]) {
		const resources = json("resources.json"), report = json("report.json"); mutate(resources); report.resourceChecks = resources;
		await reject(new Map([["resources.json", encode(resources)], ["report.json", encode(report)]]), "resource guard"); resourceControls++;
	}
	for(const loadCeiling of [6, 10, 24])
	{
		const report = json("report.json"); report.loadCeiling = loadCeiling;
		await reject(new Map([["report.json", encode(report)]]), "unrecorded load ceiling"); resourceControls++;
	}
	for(const mutate of [
		value => { value.context.root = "relative/root"; }
		, value => { value.callerSha256 = "0".repeat(64); }
		, value => { value.context.receiptBytes += "\n"; }
		, value => { value.context.runtimeSearchPath = "/tmp/old/lib"; }
		, value => { value.closure.consumerFileSetSha256 = "0".repeat(64); }
		, value => { value.commands[0].args[2] = "/unrecorded/archive.tar.gz"; }
		, value => { value.commands[1].run.stdout += "unrecorded.c\n"; }
		, value => { value.commands[3].args = ["--version"]; }
		, value => { value.commands[4].args.pop(); }
		, value => { const wit = JSON.parse(value.commands[4].run.stdout); delete wit.interfaces[1].functions[Object.keys(wit.interfaces[1].functions)[0]]; value.commands[4].run.stdout = JSON.stringify(wit); }
		, value => { value.commands[5].run.stdout += " -lunrecorded"; }
		, value => { value.commands[6].args = value.commands[6].args.filter(arg => arg !== "-UNDEBUG"); }
		, value => { value.commands[6].environment.PATH = "/usr/bin"; }
		, value => { value.commands[7].run.stdout = value.commands[7].run.stdout.replaceAll("$ORIGIN", "/tmp/original"); }
		, value => { value.commands.pop(); }
	]) {
		const installation = json("installation.json"); mutate(installation);
		await reject(new Map([["installation.json", encode(installation)], ["install-commands.json", encode(installation.commands)]]), "coordinated installation records"); environmentControls++;
	}
	for(const target of inheritedCheckedRecordWitSources)
	{
		const packaged = json("package.json"), receipt = json(`package/${inheritedCheckedRecordWitReceipt}`), changes = new Map();
		const bytes = Buffer.concat([originals.get("package/" + target), Buffer.from("\n ")]);
		changes.set("package/" + target, bytes); receipt.files[target] = identity(bytes); packaged.files[target] = identity(bytes);
		const wit = json("package/native-wit-adapter.json");
		assert.ok(Object.hasOwn(wit.files, target)); wit.files[target] = identity(bytes);
		const witBytes = encode(wit); changes.set("package/native-wit-adapter.json", witBytes);
		receipt.files["native-wit-adapter.json"] = identity(witBytes); packaged.files["native-wit-adapter.json"] = identity(witBytes);
		const receiptBytes = encode(receipt); changes.set(`package/${inheritedCheckedRecordWitReceipt}`, receiptBytes);
		packaged.files[inheritedCheckedRecordWitReceipt] = identity(receiptBytes); packaged.receiptSha256 = sha256(receiptBytes);
		packaged.closure.receiptSha256 = sha256(receiptBytes);
		changes.set("package.json", encode(packaged)); const altered = path => read(path, changes);
		await assert.rejects(checkInheritedCheckedRecordWitPackageRecords({ read: altered
			, json: async path => JSON.parse(await altered(path))
			, model: json("build-0/model.json")
			, receipt: json("build-0/package-set-receipt.json")
			, tools: json("tools.json"), producerCommit: options.producerCommit
			, floor: options.floor })); packageControls++;
	}
	for(const mutate of inheritedCheckedRecordWitModelMutations(options.mode))
	{
		const report = json("report.json"), changes = new Map();
		for(const attempt of [0, 1])
		{
			const path = `build-${attempt}/model.json`, model = json(path); mutate(model);
			const bytes = encode(model); changes.set(path, bytes); report.builds[attempt].modelSha256 = sha256(bytes);
		}
		const altered = path => read(path, changes);
		await assert.rejects(checkInheritedCheckedRecordWitModels({ ...options, report, read: altered, json: async path => JSON.parse(await altered(path)) })); modelControls++;
	}
	return { recordControls, executionControls, toolControls, resourceControls, environmentControls, packageControls, modelControls };
};
