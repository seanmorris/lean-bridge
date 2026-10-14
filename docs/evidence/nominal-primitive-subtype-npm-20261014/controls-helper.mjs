/**
 * Refuse missing originals and coordinated primitive-base npm record mutations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeFields, nominalPrimitiveSubtypeName } from "./nominal-primitive-subtype-fixture.mjs";
import { checkNominalPrimitiveSubtypeNpmReport, nominalPrimitiveSubtypeNpmRecordPaths } from "./nominal-primitive-subtype-npm-report.mjs";

/**
 * Target every primitive constructor identity without deriving its expected name from metadata.
 *
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypeNpmAdapterMutations = mode => {
	assert.ok(["full", "result-only"].includes(mode));
	const produce = plan => plan.exports.find(item => item.bindingId === "lean:NominalPrimitiveSubtypes.produce");
	const output = plan => produce(plan).refinements.result.arguments[0];
	const input = plan => plan.exports.find(item => item.bindingId === "lean:NominalPrimitiveSubtypes.echoB").refinements.parameters[0];
	const mutations = [
		["omitted export", plan => { plan.exports.pop(); }]
		, ["wrong private ABI", plan => { plan.privateAbi.version = 6; }]
		, ["changed source module", plan => { produce(plan).sourceModule = "DifferentModule"; }]
		, ["changed output Fin bound", plan => {
			const tree = output(plan); assert.equal(tree.fields.at(-1).name, "digit");
			tree.fields.at(-1).refinement.bound = "4";
		}]
	];
	for(const [index, field] of nominalPrimitiveSubtypeFields.entries())
	{
		mutations.push(["invented output constructor: " + field.name, plan => {
			const item = output(plan).fields[index]; assert.equal(item.name, field.name);
			assert.equal(item.refinement.constructor, null);
			item.refinement.constructor = "NominalPrimitiveSubtypes." + field.constructor + "A";
		}]);
		if(mode === "full")
		{
			mutations.push(["replaced input constructor: " + field.name, plan => {
				const item = input(plan).fields[index]; assert.equal(item.name, field.name);
				assert.equal(item.refinement.constructor, "NominalPrimitiveSubtypes." + field.constructor + "B");
				item.refinement.constructor = "NominalPrimitiveSubtypes." + field.constructor + "A";
			}]);
		}
	}
	return mutations;
};

/**
 * Test the accepted original run and keep all negative mutations in memory.
 *
 * @param originalRead - Selection-relative original byte reader.
 * @param options - Independently authenticated producer, author route, mode and runtime.
 */
export const checkNominalPrimitiveSubtypeNpmControls = async (originalRead, options) => {
	const accepted = await checkNominalPrimitiveSubtypeNpmReport(originalRead, options);
	const originalReport = JSON.parse(await originalRead("report.json"));
	const paths = nominalPrimitiveSubtypeNpmRecordPaths(options.mode, originalReport.receipt);
	assert.equal(new Set(paths).size, paths.length);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const identities = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), "Missing original record: " + path); return Buffer.from(value);
	};
	let recordControls = 0, reportControls = 0, adapterControls = 0;
	for(const [path, bytes] of originals) for(const replacement of [null, Buffer.concat([bytes, Buffer.from("corrupted")])])
	{
		const changes = new Map([[path, replacement]]);
		await assert.rejects(checkNominalPrimitiveSubtypeNpmReport(path_ => read(path_, changes), options)); recordControls++;
	}
	const changes = [
		report => { report.independentBuilds = 1; }
		, report => { report.route = "wrong"; }
		, report => { report.mode = options.mode === "full" ? "result-only" : "full"; }
		, ...["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath", "relocatedInstallation"].map(key => report => { report[key] = false; })
		, report => { report.builds[1].componentArchiveSha256 = "0".repeat(64); }
		, report => { report.expectedBindingIrSha256 = "0".repeat(64); }
		, report => { report.dispatch.observed = true; }
		, report => { report.callers["fixtures/nominal-primitive-subtype-consumers/javascript.mjs"] = "0".repeat(64); }
		, report => { delete report.callers["results.mts"]; }
		, report => { report.typescript.skipLibCheck = true; }
		, report => { report.observations.pop(); }
		, report => { report.observations[1].relocated = false; }
		, report => { report.observations[0].result.stdout = '{"checks":1,"rejections":0}\n'; }
		, report => { report.observations[1].typescript.code = 1; }
		, report => { report.observations[1].runtime.stdout = '{"node":"v24.0.0","platform":"linux","arch":"x64"}\n'; }
		, report => { delete report.trees[nominalPrimitiveSubtypeName]["internal/validators.mjs"]; }
		, report => { report.trees[nominalPrimitiveSubtypeName]["metadata/binding-ir.json"] = "0".repeat(64); }
		, report => { report.trees.undefined = report.trees[nominalPrimitiveSubtypeName]; delete report.trees[nominalPrimitiveSubtypeName]; }
	];
	for(const mutate of changes)
	{
		const report = structuredClone(originalReport); mutate(report);
		const changed = new Map([["report.json", Buffer.from(canonicalJson(report))]]);
		for(const [index, observation] of report.observations.entries())
			changed.set(`${index ? "relocated" : "installed"}.json`, Buffer.from(canonicalJson(observation)));
		await assert.rejects(checkNominalPrimitiveSubtypeNpmReport(path => read(path, changed), options)); reportControls++;
	}
	for(const [label, mutate] of nominalPrimitiveSubtypeNpmAdapterMutations(options.mode))
	{
		const plan = JSON.parse(originals.get("build-0/locks/compiler-adapters.json")); mutate(plan);
		const bytes = Buffer.from(canonicalJson(plan));
		const changed = new Map([0, 1].map(attempt => [`build-${attempt}/locks/compiler-adapters.json`, bytes]));
		await assert.rejects(checkNominalPrimitiveSubtypeNpmReport(path => read(path, changed), options), undefined, label); adapterControls++;
	}
	for(const [path, bytes] of originals) assert.equal(sha256(bytes), identities.get(path), path);
	return { ...accepted, recordControls, reportControls, adapterControls };
};
