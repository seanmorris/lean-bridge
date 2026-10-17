/**
 * Refuse coordinated mutations of recursive checked-record WIT package and execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordWitReport } from "./recursive-checked-record-wit-report.mjs";
import { checkRecursiveCheckedRecordWitModels, recursiveCheckedRecordWitModelMutations } from "./recursive-checked-record-wit-model-records.mjs";
import { checkRecursiveCheckedRecordWitPackageRecords } from "./recursive-checked-record-wit-package-records.mjs";
import { recursiveCheckedRecordWitComponentRecord } from "./recursive-checked-record-wit-handoff.mjs";
import { recursiveCheckedRecordWitGenerator } from "./recursive-checked-record-wit-generators.mjs";
import { recursiveCheckedRecordWitLayout, recursiveCheckedRecordWitReceipt } from "./recursive-checked-record-wit-package.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Re-sign changed package members through the WIT adapter receipt, the package receipt and package.json,
 * so only the regenerated-source comparison can refuse them.
 *
 * @param json - Original JSON reader.
 * @param fixture - Recursive or mutual module.
 * @param replacements - Package-relative paths and their substituted bytes.
 */
const resignPackage = (json, fixture, replacements) => {
	const packaged = json("package.json"), receipt = json(`package/${recursiveCheckedRecordWitReceipt}`), changes = new Map();
	const wit = json("package/native-wit-adapter.json");
	for(const [target, bytes] of replacements)
	{
		assert.ok(Object.hasOwn(receipt.files, target), target);
		changes.set("package/" + target, bytes); receipt.files[target] = identity(bytes); packaged.files[target] = identity(bytes);
		// Graph headers come from the C adapter; every other regenerated member is a WIT adapter file.
		if(Object.hasOwn(wit.files, target)) wit.files[target] = identity(bytes);
		else assert.match(target, /^include\/[a-z]+-graph(?:-types)?\.h$/u, target);
	}
	const witBytes = Buffer.from(canonicalJson(wit)); changes.set("package/native-wit-adapter.json", witBytes);
	receipt.files["native-wit-adapter.json"] = identity(witBytes); packaged.files["native-wit-adapter.json"] = identity(witBytes);
	const receiptBytes = Buffer.from(canonicalJson(receipt)); changes.set(`package/${recursiveCheckedRecordWitReceipt}`, receiptBytes);
	packaged.files[recursiveCheckedRecordWitReceipt] = identity(receiptBytes); packaged.receiptSha256 = sha256(receiptBytes);
	packaged.closure.receiptSha256 = sha256(receiptBytes);
	changes.set("package.json", Buffer.from(canonicalJson(packaged)));
	for(const [target] of replacements) assert.ok(recursiveCheckedRecordWitLayout(fixture).sources.includes(target), target);
	return changes;
};

/**
 * Exercise missing originals and source, transport, constructor, tool, closure and command drift.
 *
 * @param originalRead - Original selection-relative record reader.
 * @param options - Independently selected original author, module and runtime identities.
 */
export const checkRecursiveCheckedRecordWitControls = async (originalRead, options) => {
	const accepted = await checkRecursiveCheckedRecordWitReport(originalRead, options), originals = new Map();
	for(const path of accepted.records) originals.set(path, Buffer.from(await originalRead(path)));
	const json = path => JSON.parse(originals.get(path)), encode = value => Buffer.from(canonicalJson(value));
	const read = async (path, changes = new Map()) => {
		const bytes = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(bytes), `Missing original: ${path}`); return bytes;
	};
	const reject = (changes, label) => assert.rejects(checkRecursiveCheckedRecordWitReport(path => read(path, changes), options), undefined, label);
	const rejectPackage = (changes, label) => assert.rejects(checkRecursiveCheckedRecordWitPackageRecords({ read: path => read(path, changes)
		, json: async path => JSON.parse(await read(path, changes))
		, model: json("build-0/model.json")
		, receipt: json("build-0/package-set-receipt.json")
		, tools: json("tools.json")
		, producerCommit: options.producerCommit
		, floor: options.floor, fixture: options.fixture }), undefined, label);
	let recordControls = 0, executionControls = 0, toolControls = 0, resourceControls = 0, environmentControls = 0;
	let packageControls = 0, transportControls = 0, modelControls = 0, reportControls = 0;
	for(const path of accepted.records) for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
	{ await reject(new Map([[path, replacement]]), path); recordControls++; }
	// Swapped originals keep every byte but exchange two retained roles.
	const swaps = [["installed.json", "relocated.json"]
		, ["tools.json", "runtime.json"]
		, ["build-0/model.json", "build-0/package-set-receipt.json"]
		, ["configuration.json", "expected.binding-ir.json"]];
	for(const [left, right] of swaps)
	{
		await reject(new Map([[left, originals.get(right)], [right, originals.get(left)]]), `${left} <-> ${right}`);
		recordControls++;
	}
	for(const [label, mutate] of [
		["wrong fixture", value => { value.fixture = options.fixture === "recursive" ? "mutual" : "recursive"; }]
		, ["wrong route", value => { value.route = options.route === "ordinary" ? "reviewed" : "ordinary"; }]
		, ["wrong producer", value => { value.producerCommit = "0".repeat(40); }]
		, ["one author", value => { value.independentBuilds = 1; }]
		, ["dropped author", value => { value.builds.pop(); }]
		, ["diverged author", value => { value.builds[1] = { ...value.builds[1], modelSha256: "0".repeat(64) }; }]
		, ["inexact diagnostics", value => { value.refinementDiagnostics.exact = false; }]
		, ["other transport", value => { value.refinementDiagnostics.transport = "fixed-message"; }]
		, ["standalone component", value => { value.componentModel.standaloneWasi = true; }]
		, ["dispatch claimed", value => { value.dispatch.observed = true; }]
		, ["source kept", value => { value.sourceRemovedBeforeInstallation = false; }]
		, ["relocation omitted", value => { value.relocatedInstallation = false; }]
		, ["online install", value => { value.offlineInstall = false; }]
		, ["compiler replay", value => { value.compilerFreeReplay = false; }]
		, ["caller compiled twice", value => { value.callerCompiledOnce = false; }]
		, ["extra claim", value => { value.unrecorded = true; }]
	]) {
		const report = json("report.json"); mutate(report);
		await reject(new Map([["report.json", encode(report)]]), label); reportControls++;
	}
	for(const [position, place] of ["installed", "relocated"].entries()) for(const mutate of [
		value => { value.run.code = 1; }
		, value => { value.run.stderr = "warning"; }
		, value => { value.counts.checks--; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.counts.rejections--; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.counts.snapshots = 0; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.counts.hostRejections--; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.counts.recoveries++; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.counts.module = value.counts.module === "recursive" ? "mutual" : "recursive"; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
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
	// A truncated execution tuple: the relocated run is missing from the report.
	{
		const report = json("report.json"); report.observations.pop();
		await reject(new Map([["report.json", encode(report)]]), "missing relocated execution"); executionControls++;
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
		, value => { value.pop(); }
	]) {
		const resources = json("resources.json"), report = json("report.json"); mutate(resources); report.resourceChecks = resources;
		await reject(new Map([["resources.json", encode(resources)], ["report.json", encode(report)]]), "resource guard"); resourceControls++;
	}
	for(const loadCeiling of [6, 10, 24])
	{
		const report = json("report.json"); report.loadCeiling = loadCeiling;
		await reject(new Map([["report.json", encode(report)]]), "unrecorded load ceiling"); resourceControls++;
	}
	const define = options.fixture === "mutual" ? "-DRECURSIVE_CHECKED_RECORD_MUTUAL" : null;
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
		// The other module's caller: the define is added or removed.
		, value => {
			const args = value.commands[6].args;
			value.commands[6].args = define ? args.filter(arg => arg !== define) : [...args.slice(0, 5), "-DRECURSIVE_CHECKED_RECORD_MUTUAL", ...args.slice(5)];
		}
		, value => { value.commands[6].environment.PATH = "/usr/bin"; }
		, value => { value.commands[7].run.stdout = value.commands[7].run.stdout.replaceAll("$ORIGIN", "/tmp/original"); }
		, value => { value.commands.pop(); }
	]) {
		const installation = json("installation.json"); mutate(installation);
		await reject(new Map([["installation.json", encode(installation)], ["install-commands.json", encode(installation.commands)]]), "coordinated installation records"); environmentControls++;
	}
	const { sources, prefix: p, name, version } = recursiveCheckedRecordWitLayout(options.fixture);
	for(const target of sources)
	{
		await rejectPackage(resignPackage(json, options.fixture, [[target, Buffer.concat([originals.get("package/" + target), Buffer.from("\n ")])]]), target);
		packageControls++;
	}
	// Default/feature-off drift: a host and manifest regenerated without exact diagnostics, coherently re-signed.
	const generator = await recursiveCheckedRecordWitGenerator(options.producerCommit), packaged = json("package.json");
	const model = json("build-0/model.json"), component = originals.get(recursiveCheckedRecordWitComponentRecord(options.fixture));
	const off = generator.compileCopiedWitGraphPackageModel(model.bindingIr, { name, version }, { refinementDiagnostics: false });
	const offHost = Buffer.from(generator.guardWitHostSource(generator.renderWitGraphHostSource(off, component), p, packaged.evidence.dependencies));
	const offManifest = Buffer.from(canonicalJson(off.manifest));
	const host = `src/${p}_wasmtime.c`, header = `include/${p}-graph.h`;
	const fixedText = Buffer.from(originals.get("package/" + host).toString()
		.replaceAll(`status == 1 ? ${p}_graph_error() : NULL`, "NULL"));
	const undeclared = Buffer.from(originals.get("package/" + header).toString()
		.replace(`const char *${p}_graph_error(void);`, ""));
	for(const [label, replacements] of [
		["feature-off host", [[host, offHost]]]
		, ["feature-off manifest", [["binding-manifest.json", offManifest]]]
		, ["feature-off host and manifest", [[host, offHost], ["binding-manifest.json", offManifest]]]
		, ["fixed failure text", [[host, fixedText]]]
		, ["undeclared diagnostic", [[header, undeclared]]]
	]) {
		for(const [target, bytes] of replacements) assert.notDeepEqual(bytes, originals.get("package/" + target), label);
		await rejectPackage(resignPackage(json, options.fixture, replacements), label); transportControls++;
	}
	for(const [label, mutate] of recursiveCheckedRecordWitModelMutations(options.fixture))
	{
		const report = json("report.json"), changes = new Map();
		for(const attempt of [0, 1])
		{
			const path = `build-${attempt}/model.json`, value = json(path); mutate(value);
			const bytes = encode(value); changes.set(path, bytes); report.builds[attempt].modelSha256 = sha256(bytes);
		}
		const altered = path => read(path, changes);
		await assert.rejects(checkRecursiveCheckedRecordWitModels({ ...options, report, read: altered, json: async path => JSON.parse(await altered(path)) }), undefined, label); modelControls++;
	}
	// Changed author inputs in either root.
	for(const attempt of [0, 1])
	{
		const path = `build-${attempt}/author-inputs.json`, inputs = json(path); inputs[0].sha256 = "0".repeat(64);
		await reject(new Map([[path, encode(inputs)]]), path); modelControls++;
	}
	await checkRecursiveCheckedRecordWitReport(path => read(path), options);
	return { recordControls, reportControls, executionControls, toolControls, resourceControls, environmentControls, packageControls, transportControls, modelControls };
};
