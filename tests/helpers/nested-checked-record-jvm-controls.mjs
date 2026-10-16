/**
 * Refuse missing originals and coordinated nested checked-record JVM changes without editing evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNestedCheckedRecordJvmReport } from "./nested-checked-record-jvm-report.mjs";

/**
 * Exercise retained readers and independent model, caller and package constraints.
 *
 * @param originalRead - Selection-relative original byte reader.
 * @param options - Independent original source, API and platform pins.
 */
export const checkNestedCheckedRecordJvmControls = async (originalRead, options) => {
	const accepted = await checkNestedCheckedRecordJvmReport(originalRead, options), originals = new Map();
	for(const path of accepted.records) originals.set(path, Buffer.from(await originalRead(path)));
	const json = path => JSON.parse(originals.get(path));
	const encode = value => Buffer.from(canonicalJson(value));
	const read = async (path, changes) => {
		const bytes = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(bytes), `Missing original: ${path}`); return bytes;
	};
	const reject = (changes, label) => assert.rejects(checkNestedCheckedRecordJvmReport(path => read(path, changes), options), undefined, label);
	let recordControls = 0, executionControls = 0, probeControls = 0;
	let packageControls = 0, modelControls = 0, resourceControls = 0;
	for(const path of accepted.records)
	{
		for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
		{
			await reject(new Map([[path, replacement]]), path); recordControls++;
		}
	}
	const executionChanges = [
		value => { value.run.code = 1; }
		, value => { value.run.stderr = "unexpected"; }
		, value => { value.run.stdout = "{}\n"; }
		, value => { value.counts.checks--; }
		, value => { value.counts.snapshots--; }
		, value => { value.counts.hostRejections++; }
		, value => { value.cwd += "-unrecorded"; }
		, value => { value.closure.interpreterSha256 = "0".repeat(64); }
	];
	for(const [consumerIndex, profile] of ["java", "kotlin"].entries())
	{
		for(const [stageIndex, stage] of ["installed", "relocated", "source-free"].entries())
		{
			for(const mutate of executionChanges)
			{
				const report = json("report.json"), path = `${profile}/${stage}.json`, record = json(path);
				mutate(record); report.consumers[consumerIndex].observations[stageIndex] = record;
				await reject(new Map([[path, encode(record)], ["report.json", encode(report)]]), `${profile}/${stage}`);
				executionControls++;
			}
		}
		const probeChanges = [
			value => { value.run.code = options.mode === "full" ? 1 : 0; }
			, value => { value.run.stderr = "unexpected diagnostics"; }
			, value => { value.cwd += "-unrecorded"; }
			, value => { value.environment.JAVA_TOOL_OPTIONS = "-agentlib:unrecorded"; }
			, value => { value.args = value.args.filter(arg => arg !== "-Werror"); }
			, value => { value.archiveSha256 = "0".repeat(64); }
			, value => { value.command = "/unavailable/compiler"; }
		];
		for(const mutate of probeChanges)
		{
			const report = json("report.json"), path = `${profile}/api-probe/record.json`, record = json(path);
			mutate(record); report.consumers[consumerIndex].apiProbe = record;
			await reject(new Map([[path, encode(record)], ["report.json", encode(report)]]), `${profile} compiler probe`);
			probeControls++;
		}
	}
	for(const [index, invalid] of [false, true].entries())
	{
		const nullChanges = [
			value => { value.run.code = invalid ? 0 : 1; }
			, value => { value.run.stderr = "not a nullability error"; }
			, value => { value.environment.KOTLIN_OPTS = "-injected"; }
			, value => { value.archiveSha256 = "0".repeat(64); }
		];
		for(const mutate of nullChanges)
		{
			const report = json("report.json"), path = `kotlin/nullability-${invalid}/record.json`, record = json(path);
			mutate(record); report.consumers[1].nullability[index] = record;
			await reject(new Map([[path, encode(record)], ["report.json", encode(report)]]), "Kotlin nullability");
			probeControls++;
		}
	}
	const resourceChanges = [
		value => { value[0].observations[0].freeBytes = 1024; }
		, value => { value[0].observations[0].availableBytes = 1024; }
		, value => { value[0].observations.at(-1).load = json("report.json").loadCeiling; }
		, value => { value[0].waits++; }
	];
	// An unrecorded ceiling is refused even when every sample would still satisfy it.
	for(const ceiling of [7, 6.5, "8", null])
	{
		const report = json("report.json"); report.loadCeiling = ceiling;
		await reject(new Map([["report.json", encode(report)]]), "load ceiling"); resourceControls++;
	}
	for(const mutate of resourceChanges)
	{
		const report = json("report.json"), record = json("resources.json");
		mutate(record); report.resourceChecks = record;
		await reject(new Map([["resources.json", encode(record)], ["report.json", encode(report)]]), "resource guard");
		resourceControls++;
	}
	const packageChanges = [
		value => { value.glibcMinimumVersion = "2.99"; }
		, value => { value.namespace += ".other"; }
		, value => { value.kotlin.standardLibraryVersion = "0.0.0"; }
		, value => { value.compiledProjectionSha256 = "0".repeat(64); }
	];
	for(const mutate of packageChanges)
	{
		const report = json("report.json"), installation = json("installation.json");
		mutate(installation.receipt); installation.receiptBytes = canonicalJson(installation.receipt);
		report.installation = installation;
		for(const consumer of report.consumers) consumer.context.receiptBytes = installation.receiptBytes;
		await reject(new Map([["installation.json", encode(installation)]
			, ["report.json", encode(report)]
			, ["package/META-INF/lean-bridge/package-receipt.json", encode(installation.receipt)]]), "coordinated package receipt");
		packageControls++;
	}
	const modelChanges = [
		value => { value.pointerBits = 32; }
		, value => { value.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, value => {
			value.exports.find(item => item.name.endsWith(".produceOption"))
				.refinements.result.arguments[0].arguments[1].constructor
				= "NestedCheckedRecords.mkWord";
		}
		, value => {
			value.exports.find(item => item.name.endsWith(".produceArray"))
				.refinements.result.arguments[0].arguments[0].bound = "9";
		}
		, ...options.mode === "full" ? [value => {
			value.exports.find(item => item.name.endsWith(".first"))
				.refinements.parameters[0].constructor
				= "NestedCheckedRecords.normalizePacket";
		}] : []
	];
	for(const mutate of modelChanges)
	{
		const report = json("report.json"), changes = new Map();
		for(const index of [0, 1])
		{
			const path = `build-${index}/model.json`, model = json(path); mutate(model);
			const bytes = encode(model); changes.set(path, bytes); report.builds[index].modelSha256 = sha256(bytes);
		}
		changes.set("report.json", encode(report)); await reject(changes, "coordinated native model"); modelControls++;
	}
	return { recordControls, executionControls, probeControls
		, packageControls, modelControls, resourceControls };
};
