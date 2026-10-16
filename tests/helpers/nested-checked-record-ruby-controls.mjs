/**
 * Missing-record and coordinated-tamper controls for original nested checked-record Ruby evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNestedCheckedRecordRubyEnvironment } from "./nested-checked-record-ruby-environment-records.mjs";
import { checkNestedCheckedRecordRubyModels } from "./nested-checked-record-ruby-model-records.mjs";
import { checkNestedCheckedRecordRubyPackage } from "./nested-checked-record-ruby-package-records.mjs";
import { checkNestedCheckedRecordRubyReport, nestedCheckedRecordRubyRecords } from "./nested-checked-record-ruby-report.mjs";
import { nestedCheckedRecordRubyReceipt } from "./nested-checked-record-ruby-package.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

// Every nested export carries a refinement tree; keep the filter explicit anyway.
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
export const nestedCheckedRecordRubyModelMutations = mode => {
	assert.ok(["full", "result-only"].includes(mode));
	return [
		["wrong native word width", model => { model.pointerBits = 32; }]
		, ["omitted export", model => { model.exports.pop(); }]
		, ["changed extractor", model => { model.sourceIdentity.extractorSha256 = "0".repeat(64); }]
		, ["changed Fin bound", model => { assert.ok(replaceLeaf(refined(model), item => item.kind === "fin", item => { item.bound = "9"; })); }]
		, ["invented result constructor", model => { assert.ok(replaceLeaf(refined(model).map(item => item.result), item => item.kind === "checked-record", item => { item.constructor = "NestedCheckedRecords.mkPacket"; })); }]
		, ...mode === "full" ? [["unreviewed parameter constructor", model => { assert.ok(replaceLeaf(refined(model).map(item => item.parameters), item => item.kind === "subtype" && item.constructor !== null, item => { item.constructor = "NestedCheckedRecords.unreviewed"; })); }]] : []
	];
};

/**
 * Require all originals and reject coordinated source, environment and compiler changes.
 *
 * @param originalRead - Original record byte reader; mutations stay in memory.
 * @param options - Independently selected producer, API and runtime scope.
 */
export const checkNestedCheckedRecordRubyControls = async (originalRead, options) => {
	const accepted = await checkNestedCheckedRecordRubyReport(originalRead, options);
	const gem = JSON.parse(await originalRead("gem.json")), paths = nestedCheckedRecordRubyRecords(options.route, gem);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const identities = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`); return Buffer.from(value);
	};
	const json = path => JSON.parse(originals.get(path));
	let recordControls = 0, resourceControls = 0, environmentControls = 0, packageControls = 0, modelControls = 0, executionControls = 0;
	for(const path of paths) for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
	{
		const changes = new Map([[path, replacement]]);
		await assert.rejects(checkNestedCheckedRecordRubyReport(path => read(path, changes), options)); recordControls++;
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
		await assert.rejects(checkNestedCheckedRecordRubyReport(path => read(path, changes), options)); resourceControls++;
	}
	for(const loadCeiling of [6, 10, 24])
	{
		const report = json("report.json"); report.loadCeiling = loadCeiling;
		const changes = new Map([["report.json", Buffer.from(canonicalJson(report))]]);
		await assert.rejects(checkNestedCheckedRecordRubyReport(path => read(path, changes), options)); resourceControls++;
	}
	const baseline = { environment: json("environment.json"), interpreter: json("interpreter.json"), gem };
	const prefix = `gems/${baseline.environment.fullName}/`;
	const mutations = [
		value => { value.environment.files[prefix + "lib/rubygems_plugin.rb"] = identity("injected"); }
		, value => { value.environment.files[prefix + "lib/lean_bridge/extra.rb"] = identity("injected"); }
		, value => { value.environment.files[prefix + "lib/lean_bridge/nestedcheckedrecords.rb"].sha256 = "0".repeat(64); }
		, value => { delete value.environment.files[prefix + "lib/lean_bridge/nestedcheckedrecords/native.rb"]; }
		, value => { value.environment.files[prefix + "lib/lean_bridge/nestedcheckedrecords.rb"] = { kind: "symlink", target: "/tmp/forged.rb" }; }
		, value => { value.environment.files[`cache/${value.environment.fullName}.gem`].sha256 = "0".repeat(64); }
		, value => { value.environment.files[`specifications/${value.environment.fullName}.gemspec`].sha256 = "0".repeat(64); }
		, value => { value.environment.interpreter.sha256 = "0".repeat(64); }
		, value => { value.environment.command = "/unavailable/substituted-ruby"; }
		, value => { value.environment.gems = "relative/gems"; }
		, value => { value.environment.receiptBytes += "\n"; }
		, value => { value.environment.fullName = "another-1.0.0-x86_64-linux"; }
	];
	for(const mutate of mutations)
	{
		const changed = structuredClone(baseline); mutate(changed);
		// A coordinated inventory digest must not admit extra executable inputs.
		changed.environment.expectedSha256 = sha256(canonicalJson(changed.environment.files));
		assert.throws(() => checkNestedCheckedRecordRubyEnvironment({ ...changed
			, receiptBytes: originals.get(`package/${nestedCheckedRecordRubyReceipt}`)
			, gemspecBytes: originals.get("installed.gemspec") })); environmentControls++;
	}
	for(const target of ["lib/lean_bridge/nestedcheckedrecords.rb", "lib/lean_bridge/nestedcheckedrecords/native.rb", "lib/lean_bridge/native_copied_runtime_v1.rb", "lib/lean_bridge/extra.rb"])
	{
		const changed = structuredClone(gem), receipt = json(`package/${nestedCheckedRecordRubyReceipt}`);
		const changes = new Map(), bytes = Buffer.concat([originals.get(`package/${target}`) ?? Buffer.alloc(0), Buffer.from("\n# coordinated source replacement\n")]);
		changes.set(`package/${target}`, bytes); receipt.files[target] = identity(bytes); changed.files[target] = identity(bytes);
		if(!changed.retained.includes(target)) changed.retained.push(target);
		changed.retained.sort();
		const receiptBytes = Buffer.from(canonicalJson(receipt)); changes.set(`package/${nestedCheckedRecordRubyReceipt}`, receiptBytes);
		changed.files[nestedCheckedRecordRubyReceipt] = identity(receiptBytes); changed.receiptSha256 = sha256(receiptBytes);
		changes.set("gem.json", Buffer.from(canonicalJson(changed)));
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkNestedCheckedRecordRubyPackage({
			read: mutatedRead
			, json: async path => JSON.parse(await mutatedRead(path))
			, model: json("build-0/model.json")
			, receipt: json("build-0/package-set-receipt.json")
			, producerCommit: options.producerCommit
			, floor: options.floor })); packageControls++;
	}
	const modelMutations = nestedCheckedRecordRubyModelMutations(options.mode);
	for(const [label, mutate] of modelMutations)
	{
		const changes = new Map(), model = json("build-0/model.json"), report = json("report.json"); mutate(model);
		const bytes = Buffer.from(canonicalJson(model));
		for(const attempt of [0, 1])
		{ changes.set(`build-${attempt}/model.json`, bytes); report.builds[attempt].modelSha256 = sha256(bytes); }
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkNestedCheckedRecordRubyModels({ ...options, report
			, read: mutatedRead
			, json: async path => JSON.parse(await mutatedRead(path)) }), assert.AssertionError, label); modelControls++;
	}
	for(const position of ["installed", "relocated"])
	{
		const mutations = [
			item => { item.run.code = 1; }, item => { item.run.stderr = "warning"; }
			, item => { item.counts.checks--; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.counts.snapshotControls = 0; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.counts.hostRejections--; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.args = []; }, item => { item.command += "-substituted"; }
			, item => { item.cwd += "-not-the-moved-tree"; item.gems = item.cwd + "/gems"; }
			, item => { item.relocated = !item.relocated; }
			, item => { item.closure.gemspecSha256 = "0".repeat(64); }
		];
		for(const mutate of mutations)
		{
			const observation = json(position + ".json"), report = json("report.json"); mutate(observation);
			report.observations[position === "installed" ? 0 : 1] = observation;
			const changes = new Map([[position + ".json", Buffer.from(canonicalJson(observation))], ["report.json", Buffer.from(canonicalJson(report))]]);
			await assert.rejects(checkNestedCheckedRecordRubyReport(path => read(path, changes), options)); executionControls++;
		}
	}
	for(const [path, hash] of identities) assert.equal(sha256(await originalRead(path)), hash, path);
	return { ...accepted, recordControls, resourceControls, environmentControls, packageControls, modelControls, executionControls };
};
