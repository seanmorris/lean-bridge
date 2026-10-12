/**
 * Missing-record and coordinated-tamper controls for original nominal Ruby evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalSubtypeRubyEnvironment } from "./nominal-subtype-ruby-environment-records.mjs";
import { checkNominalSubtypeRubyModels } from "./nominal-subtype-ruby-model-records.mjs";
import { checkNominalSubtypeRubyPackage } from "./nominal-subtype-ruby-package-records.mjs";
import { checkNominalSubtypeRubyReport, nominalSubtypeRubyRecords } from "./nominal-subtype-ruby-report.mjs";
import { nominalSubtypeRubyReceipt } from "./nominal-subtype-ruby-package.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Require all originals and reject coordinated source, environment and compiler changes.
 *
 * @param originalRead - Original record byte reader; mutations stay in memory.
 * @param options - Independently selected producer, API and runtime scope.
 */
export const checkNominalSubtypeRubyControls = async (originalRead, options) => {
	const accepted = await checkNominalSubtypeRubyReport(originalRead, options);
	const gem = JSON.parse(await originalRead("gem.json")), paths = nominalSubtypeRubyRecords(options.route, gem);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`); return Buffer.from(value);
	};
	const json = path => JSON.parse(originals.get(path));
	let recordControls = 0, environmentControls = 0, packageControls = 0, modelControls = 0, executionControls = 0;
	for(const path of paths) for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
	{
		const changes = new Map([[path, replacement]]);
		await assert.rejects(checkNominalSubtypeRubyReport(path => read(path, changes), options)); recordControls++;
	}
	const baseline = { environment: json("environment.json"), interpreter: json("interpreter.json"), gem };
	const prefix = `gems/${baseline.environment.fullName}/`;
	const mutations = [
		value => { value.environment.files[prefix + "lib/rubygems_plugin.rb"] = identity("injected"); }
		, value => { value.environment.files[prefix + "lib/lean_bridge/extra.rb"] = identity("injected"); }
		, value => { value.environment.files[prefix + "lib/lean_bridge/nominalsubtypes.rb"].sha256 = "0".repeat(64); }
		, value => { delete value.environment.files[prefix + "lib/lean_bridge/nominalsubtypes/native.rb"]; }
		, value => { value.environment.files[prefix + "lib/lean_bridge/nominalsubtypes.rb"] = { kind: "symlink", target: "/tmp/forged.rb" }; }
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
		assert.throws(() => checkNominalSubtypeRubyEnvironment({ ...changed
			, receiptBytes: originals.get(`package/${nominalSubtypeRubyReceipt}`)
			, gemspecBytes: originals.get("installed.gemspec") })); environmentControls++;
	}
	for(const target of ["lib/lean_bridge/nominalsubtypes.rb", "lib/lean_bridge/nominalsubtypes/native.rb", "lib/lean_bridge/native_copied_runtime_v1.rb", "lib/lean_bridge/extra.rb"])
	{
		const changed = structuredClone(gem), receipt = json(`package/${nominalSubtypeRubyReceipt}`);
		const changes = new Map(), bytes = Buffer.concat([originals.get(`package/${target}`) ?? Buffer.alloc(0), Buffer.from("\n# coordinated source replacement\n")]);
		changes.set(`package/${target}`, bytes); receipt.files[target] = identity(bytes); changed.files[target] = identity(bytes);
		if(!changed.retained.includes(target)) changed.retained.push(target);
		changed.retained.sort();
		const receiptBytes = Buffer.from(canonicalJson(receipt)); changes.set(`package/${nominalSubtypeRubyReceipt}`, receiptBytes);
		changed.files[nominalSubtypeRubyReceipt] = identity(receiptBytes); changed.receiptSha256 = sha256(receiptBytes);
		changes.set("gem.json", Buffer.from(canonicalJson(changed)));
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkNominalSubtypeRubyPackage({
			read: mutatedRead
			, json: async path => JSON.parse(await mutatedRead(path))
			, model: json("build-0/model.json")
			, receipt: json("build-0/package-set-receipt.json")
			, producerCommit: options.producerCommit
			, floor: options.floor })); packageControls++;
	}
	const modelMutations = [
		model => { model.exports.pop(); }
		, model => { model.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, model => { model.exports.find(item => item.name.endsWith(".produceEnvelope")).refinements.result.arguments[0].constructor = "NominalSubtypes.plusOne"; }
		, model => { model.exports.find(item => item.name.endsWith(".produceEnvelope")).refinements.result.arguments[1].bound = "4"; }
	];
	if(options.mode === "full") modelMutations.push(model => { model.exports.find(item => item.name.endsWith(".second")).refinements.parameters[0].arguments[0].constructor = "NominalSubtypes.plusOne"; });
	for(const mutate of modelMutations)
	{
		const changes = new Map(), model = json("build-0/model.json"), report = json("report.json"); mutate(model);
		const bytes = Buffer.from(canonicalJson(model));
		for(const attempt of [0, 1])
		{ changes.set(`build-${attempt}/model.json`, bytes); report.builds[attempt].modelSha256 = sha256(bytes); }
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkNominalSubtypeRubyModels({ ...options, report
			, read: mutatedRead
			, json: async path => JSON.parse(await mutatedRead(path)) })); modelControls++;
	}
	for(const position of ["installed", "relocated"])
	{
		const mutations = [
			item => { item.run.code = 1; }, item => { item.run.stderr = "warning"; }
			, item => { item.counts.checks--; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.counts.snapshotControls = 0; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
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
			await assert.rejects(checkNominalSubtypeRubyReport(path => read(path, changes), options)); executionControls++;
		}
	}
	return { ...accepted, recordControls, environmentControls, packageControls, modelControls, executionControls };
};
