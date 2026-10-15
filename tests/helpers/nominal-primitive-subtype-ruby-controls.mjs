/**
 * Missing-record and coordinated-tamper controls for original nominal Ruby evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { checkNominalPrimitiveSubtypeRubyEnvironment } from "./nominal-primitive-subtype-ruby-environment-records.mjs";
import { checkNominalPrimitiveSubtypeRubyModels } from "./nominal-primitive-subtype-ruby-model-records.mjs";
import { checkNominalPrimitiveSubtypeRubyPackage } from "./nominal-primitive-subtype-ruby-package-records.mjs";
import { checkNominalPrimitiveSubtypeRubyReport, nominalPrimitiveSubtypeRubyRecords } from "./nominal-primitive-subtype-ruby-report.mjs";
import { nominalPrimitiveSubtypeRubyReceipt } from "./nominal-primitive-subtype-ruby-package.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Exercise all nineteen named constructor sites and the independent Fin sibling.
 *
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalPrimitiveSubtypeRubyModelMutations = mode => {
	assert.ok(["full", "result-only"].includes(mode));
	const output = model => model.exports.find(item => item.name === "NominalPrimitiveSubtypes.produce").refinements.result.arguments[0];
	const input = model => model.exports.find(item => item.name === "NominalPrimitiveSubtypes.echoB").refinements.parameters[0];
	const mutations = [
		["omitted export", model => { model.exports.pop(); }]
		, ["changed extractor", model => { model.sourceIdentity.extractorSha256 = "0".repeat(64); }]
		, ["wrong native word width", model => { model.pointerBits = 32; }]
		, ["changed output Fin bound", model => {
			const tree = output(model); assert.equal(tree.fields.at(-1), "digit");
			tree.arguments.at(-1).bound = "4";
		}]
	];
	for(const [index, field] of nominalPrimitiveSubtypeFields.entries())
	{
		mutations.push(["invented output constructor: " + field.name, model => {
			const tree = output(model); assert.equal(tree.fields[index], field.name);
			assert.equal(tree.arguments[index].constructor, null);
			tree.arguments[index].constructor = "NominalPrimitiveSubtypes." + field.constructor + "A";
		}]);
		if(mode === "full")
		{
			mutations.push(["replaced input constructor: " + field.name, model => {
				const tree = input(model); assert.equal(tree.fields[index], field.name);
				assert.equal(tree.arguments[index].constructor, "NominalPrimitiveSubtypes." + field.constructor + "B");
				tree.arguments[index].constructor = "NominalPrimitiveSubtypes." + field.constructor + "A";
			}]);
		}
	}
	return mutations;
};

/**
 * Require all originals and reject coordinated source, environment and compiler changes.
 *
 * @param originalRead - Original record byte reader; mutations stay in memory.
 * @param options - Independently selected producer, API and runtime scope.
 */
export const checkNominalPrimitiveSubtypeRubyControls = async (originalRead, options) => {
	const accepted = await checkNominalPrimitiveSubtypeRubyReport(originalRead, options);
	const gem = JSON.parse(await originalRead("gem.json")), paths = nominalPrimitiveSubtypeRubyRecords(options.route, gem);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const identities = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`); return Buffer.from(value);
	};
	const json = path => JSON.parse(originals.get(path));
	let recordControls = 0, environmentControls = 0, packageControls = 0, modelControls = 0, executionControls = 0;
	for(const path of paths) for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
	{
		const changes = new Map([[path, replacement]]);
		await assert.rejects(checkNominalPrimitiveSubtypeRubyReport(path => read(path, changes), options)); recordControls++;
	}
	const baseline = { environment: json("environment.json"), interpreter: json("interpreter.json"), gem };
	const prefix = `gems/${baseline.environment.fullName}/`;
	const mutations = [
		value => { value.environment.files[prefix + "lib/rubygems_plugin.rb"] = identity("injected"); }
		, value => { value.environment.files[prefix + "lib/lean_bridge/extra.rb"] = identity("injected"); }
		, value => { value.environment.files[prefix + "lib/lean_bridge/nominalprimitivesubtypes.rb"].sha256 = "0".repeat(64); }
		, value => { delete value.environment.files[prefix + "lib/lean_bridge/nominalprimitivesubtypes/native.rb"]; }
		, value => { value.environment.files[prefix + "lib/lean_bridge/nominalprimitivesubtypes.rb"] = { kind: "symlink", target: "/tmp/forged.rb" }; }
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
		assert.throws(() => checkNominalPrimitiveSubtypeRubyEnvironment({ ...changed
			, receiptBytes: originals.get(`package/${nominalPrimitiveSubtypeRubyReceipt}`)
			, gemspecBytes: originals.get("installed.gemspec") })); environmentControls++;
	}
	for(const target of ["lib/lean_bridge/nominalprimitivesubtypes.rb", "lib/lean_bridge/nominalprimitivesubtypes/native.rb", "lib/lean_bridge/native_copied_runtime_v1.rb", "lib/lean_bridge/extra.rb"])
	{
		const changed = structuredClone(gem), receipt = json(`package/${nominalPrimitiveSubtypeRubyReceipt}`);
		const changes = new Map(), bytes = Buffer.concat([originals.get(`package/${target}`) ?? Buffer.alloc(0), Buffer.from("\n# coordinated source replacement\n")]);
		changes.set(`package/${target}`, bytes); receipt.files[target] = identity(bytes); changed.files[target] = identity(bytes);
		if(!changed.retained.includes(target)) changed.retained.push(target);
		changed.retained.sort();
		const receiptBytes = Buffer.from(canonicalJson(receipt)); changes.set(`package/${nominalPrimitiveSubtypeRubyReceipt}`, receiptBytes);
		changed.files[nominalPrimitiveSubtypeRubyReceipt] = identity(receiptBytes); changed.receiptSha256 = sha256(receiptBytes);
		changes.set("gem.json", Buffer.from(canonicalJson(changed)));
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkNominalPrimitiveSubtypeRubyPackage({
			read: mutatedRead
			, json: async path => JSON.parse(await mutatedRead(path))
			, model: json("build-0/model.json")
			, receipt: json("build-0/package-set-receipt.json")
			, producerCommit: options.producerCommit
			, floor: options.floor })); packageControls++;
	}
	const modelMutations = nominalPrimitiveSubtypeRubyModelMutations(options.mode);
	for(const [label, mutate] of modelMutations)
	{
		const changes = new Map(), model = json("build-0/model.json"), report = json("report.json"); mutate(model);
		const bytes = Buffer.from(canonicalJson(model));
		for(const attempt of [0, 1])
		{ changes.set(`build-${attempt}/model.json`, bytes); report.builds[attempt].modelSha256 = sha256(bytes); }
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkNominalPrimitiveSubtypeRubyModels({ ...options, report
			, read: mutatedRead
			, json: async path => JSON.parse(await mutatedRead(path)) }), assert.AssertionError, label); modelControls++;
	}
	for(const position of ["installed", "relocated"])
	{
		const mutations = [
			item => { item.run.code = 1; }, item => { item.run.stderr = "warning"; }
			, item => { item.counts.checks--; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.counts.snapshotControls = 0; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.counts.wordBits = 32; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
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
			await assert.rejects(checkNominalPrimitiveSubtypeRubyReport(path => read(path, changes), options)); executionControls++;
		}
	}
	for(const [path, hash] of identities) assert.equal(sha256(await originalRead(path)), hash, path);
	return { ...accepted, recordControls, environmentControls, packageControls, modelControls, executionControls };
};
