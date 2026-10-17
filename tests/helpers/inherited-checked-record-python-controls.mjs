/**
 * Missing-record and coordinated-tamper controls for original inherited checked-record Python evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { inheritedCheckedRecordPythonMinors } from "./inherited-checked-record-python-fixture.mjs";
import { checkInheritedCheckedRecordPythonEnvironment } from "./inherited-checked-record-python-environment-records.mjs";
import { checkInheritedCheckedRecordPythonModels } from "./inherited-checked-record-python-model-records.mjs";
import { checkInheritedCheckedRecordPythonPackage } from "./inherited-checked-record-python-package-records.mjs";
import { checkInheritedCheckedRecordPythonReport, inheritedCheckedRecordPythonRecords } from "./inherited-checked-record-python-report.mjs";
import { inheritedCheckedRecordPythonReceipt } from "./inherited-checked-record-python-wheel.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Require every original file, reject coordinated package changes and enforce pre-pip closure.
 *
 * @param originalRead - Original record reader; mutations stay in memory.
 * @param options - Independently selected route, API, producer and runtime.
 */
export const checkInheritedCheckedRecordPythonControls = async (originalRead, options) => {
	const accepted = await checkInheritedCheckedRecordPythonReport(originalRead, options);
	const wheel = JSON.parse(await originalRead("wheel.json")), paths = inheritedCheckedRecordPythonRecords(options.route, wheel);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`); return Buffer.from(value);
	};
	const json = path => JSON.parse(originals.get(path));
	let recordControls = 0, resourceControls = 0, environmentControls = 0, packageControls = 0, modelControls = 0;
	for(const path of paths) for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
	{
		const changes = new Map([[path, replacement]]);
		await assert.rejects(checkInheritedCheckedRecordPythonReport(path => read(path, changes), options)); recordControls++;
	}
	for(const mutate of [
		value => { value[0].observations[0].freeBytes = 1024; }
		, value => { value[0].observations[0].availableBytes = 1024; }
		, value => { value[0].observations.at(-1).load = json("report.json").loadCeiling; }
		, value => { value[0].waits++; }
	]) {
		const report = json("report.json"), resources = json("resources.json"); mutate(resources);
		report.resourceChecks = resources;
		const changes = new Map([
			["resources.json", Buffer.from(canonicalJson(resources))]
			, ["report.json", Buffer.from(canonicalJson(report))]
		]);
		await assert.rejects(checkInheritedCheckedRecordPythonReport(path => read(path, changes), options)); resourceControls++;
	}
	for(const loadCeiling of [4, 16, 24])
	{
		const report = json("report.json"); report.loadCeiling = loadCeiling;
		const changes = new Map([["report.json", Buffer.from(canonicalJson(report))]]);
		await assert.rejects(checkInheritedCheckedRecordPythonReport(path => read(path, changes), options)); resourceControls++;
	}
	for(const minor of inheritedCheckedRecordPythonMinors)
	{
		const report = json(`${minor}/report.json`), prefix = `lib/python${minor}/site-packages/`;
		const base = { baseline: json(`${minor}/baseline.json`)
			, installed: json(`${minor}/environment.json`)
			, pip: json(`${minor}/pip.json`)
			, pipMetadata: json(`${minor}/pip-metadata.json`)
			, interpreter: report.interpreter, artifact: wheel.archive };
		const metadata = prefix + "inheritedcheckedrecords-1.0.0.dist-info/";
		const metadataMutation = (value, name, text) => {
			value.pipMetadata[metadata + name] = text;
			value.installed.entries[metadata + name] = { kind: "file", ...identity(text) };
		};
		const mutations = [
			value => { value.installed.entries[prefix + "sitecustomize.py"] = { kind: "file", ...identity("print('injected')") }; }
			, value => { value.installed.entries[prefix + "injected.pth"] = { kind: "file", ...identity("import injected\n") }; }
			, value => { value.installed.entries[prefix + "lean_inheritedcheckedrecords/extra.py"] = { kind: "file", ...identity("injected") }; }
			, value => { value.installed.entries[prefix + "lean_inheritedcheckedrecords/__init__.py"].sha256 = "0".repeat(64); }
			, value => { delete value.installed.entries[prefix + "lean_inheritedcheckedrecords/__init__.pyi"]; }
			, value => { value.installed.entries[prefix + "lean_inheritedcheckedrecords/_native.py"] = { kind: "symlink", target: "/tmp/forged.py" }; }
			, value => { value.baseline.expectedSha256 = "0".repeat(64); }
			, value => { value.installed.python = "3.13.0"; }
			, value => { value.interpreter.identity.implementation = "pypy"; }
			, value => { value.interpreter.identity.pointerBits = 32; }
			, value => { value.pip.arguments = value.pip.arguments.filter(arg => arg !== "--no-index"); }
			, value => { value.pip.arguments = value.pip.arguments.filter(arg => arg !== "--no-compile"); }
			, value => { value.pip.arguments[0] = "-S"; }
			, value => { value.pip.environment.PATH = "/usr/bin"; }
			, value => { value.pip.run.code = 1; }
			, value => { value.pip.run.stdout = "Installing collected packages\n"; }
			, value => { metadataMutation(value, "INSTALLER", "forged\n"); }
			, value => { metadataMutation(value, "REQUESTED", "forged\n"); }
			, value => { const direct = JSON.parse(value.pipMetadata[metadata + "direct_url.json"]); direct.url = "https://untrusted.invalid/wheel.whl"; metadataMutation(value, "direct_url.json", JSON.stringify(direct)); }
			, value => { const direct = JSON.parse(value.pipMetadata[metadata + "direct_url.json"]); direct.archive_info.hashes.sha256 = "0".repeat(64); metadataMutation(value, "direct_url.json", JSON.stringify(direct)); }
			, value => { metadataMutation(value, "RECORD", value.pipMetadata[metadata + "RECORD"] + "extra.py,,\n"); }
			, value => { metadataMutation(value, "RECORD", value.pipMetadata[metadata + "RECORD"].replace("sha256=", "sha512=")); }
		];
		for(const mutate of mutations)
		{
			const changed = structuredClone(base); mutate(changed);
			// Updating the post-install digest must not authorize new executable inputs.
			changed.installed.expectedSha256 = sha256(canonicalJson(changed.installed.entries));
			assert.throws(() => checkInheritedCheckedRecordPythonEnvironment({ ...changed, receiptBytes: originals.get(`package/${inheritedCheckedRecordPythonReceipt}`) })); environmentControls++;
		}
	}
	const recordPath = "inheritedcheckedrecords-1.0.0.dist-info/RECORD";
	for(const target of ["lean_inheritedcheckedrecords/__init__.py", "lean_inheritedcheckedrecords/__init__.pyi", "lean_inheritedcheckedrecords/_native.py", "lean_inheritedcheckedrecords/extra.py"])
	{
		const changed = structuredClone(wheel), receipt = json(`package/${inheritedCheckedRecordPythonReceipt}`);
		const changes = new Map(), bytes = Buffer.concat([originals.get(`package/${target}`) ?? Buffer.alloc(0), Buffer.from("\n# coordinated source replacement\n")]);
		changes.set(`package/${target}`, bytes); receipt.files[target] = identity(bytes); changed.files[target] = identity(bytes);
		if(!changed.retained.includes(target)) changed.retained.push(target);
		changed.retained.sort();
		const receiptBytes = Buffer.from(canonicalJson(receipt)); changes.set(`package/${inheritedCheckedRecordPythonReceipt}`, receiptBytes);
		changed.files[inheritedCheckedRecordPythonReceipt] = identity(receiptBytes); changed.receiptSha256 = sha256(receiptBytes);
		const lines = Object.keys(changed.files).filter(path => path !== recordPath).sort().map(path => `${path},sha256=${Buffer.from(changed.files[path].sha256, "hex").toString("base64url")},${changed.files[path].bytes}`);
		const recordBytes = Buffer.from([...lines, `${recordPath},,`, ""].join("\n"));
		changes.set(`package/${recordPath}`, recordBytes); changed.files[recordPath] = identity(recordBytes);
		changes.set("wheel.json", Buffer.from(canonicalJson(changed)));
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkInheritedCheckedRecordPythonPackage({
			read: mutatedRead, json: async path => JSON.parse(await mutatedRead(path))
			, model: json("build-0/model.json")
			, receipt: json("build-0/package-set-receipt.json")
			, producerCommit: options.producerCommit, floor: options.floor }));
		packageControls++;
	}
	const modelMutations = inheritedCheckedRecordPythonModelMutations(options.mode);
	for(const [label, mutate] of modelMutations)
	{
		const changes = new Map(), model = json("build-0/model.json"), report = json("report.json"); mutate(model);
		const bytes = Buffer.from(canonicalJson(model));
		for(const attempt of [0, 1])
		{ changes.set(`build-${attempt}/model.json`, bytes); report.builds[attempt].modelSha256 = sha256(bytes); }
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkInheritedCheckedRecordPythonModels({ ...options, report
			, read: mutatedRead
			, json: async path => JSON.parse(await mutatedRead(path)) }), assert.AssertionError, label);
		modelControls++;
	}
	return { ...accepted, recordControls, resourceControls, environmentControls, packageControls, modelControls };
};

// Every inherited export carries a refinement tree; keep the filter explicit anyway.
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
export const inheritedCheckedRecordPythonModelMutations = mode => {
	assert.ok(["full", "result-only"].includes(mode));
	return [
		["wrong native word width", model => { model.pointerBits = 32; }]
		, ["omitted export", model => { model.exports.pop(); }]
		, ["changed extractor", model => { model.sourceIdentity.extractorSha256 = "0".repeat(64); }]
		, ["changed Fin bound", model => { assert.ok(replaceLeaf(refined(model), item => item.kind === "fin", item => { item.bound = "9"; })); }]
		, ["invented result constructor", model => { assert.ok(replaceLeaf(refined(model).map(item => item.result), item => item.kind === "checked-record", item => { item.constructor = "InheritedCheckedRecords.mkTicket"; })); }]
		, ...mode === "full" ? [["unreviewed parameter constructor", model => { assert.ok(replaceLeaf(refined(model).map(item => item.parameters), item => item.kind === "subtype" && item.constructor !== null, item => { item.constructor = "InheritedCheckedRecords.unreviewed"; })); }]] : []
	];
};
