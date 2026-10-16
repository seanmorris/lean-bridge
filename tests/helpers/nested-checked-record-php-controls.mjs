/**
 * Reject missing originals and coordinated nested checked-record PHP record changes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNestedCheckedRecordPhpReport } from "./nested-checked-record-php-report.mjs";
import { checkNestedCheckedRecordPhpModels } from "./nested-checked-record-php-model-records.mjs";
import { checkNestedCheckedRecordPhpPackageRecords } from "./nested-checked-record-php-package-records.mjs";
import { checkNestedCheckedRecordPhpEnvironmentRecords } from "./nested-checked-record-php-environment-records.mjs";
import { nestedCheckedRecordPhpReceipt } from "./nested-checked-record-php-package.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Exercise every retained record and independently fixed source/consumer semantics.
 *
 * @param originalRead - Original selection-relative record reader.
 * @param options - Independent original author, API and runtime pins.
 */
export const checkNestedCheckedRecordPhpControls = async (originalRead, options) => {
	const accepted = await checkNestedCheckedRecordPhpReport(originalRead, options), originals = new Map();
	for(const path of accepted.records) originals.set(path, Buffer.from(await originalRead(path)));
	const json = path => JSON.parse(originals.get(path));
	const encode = value => Buffer.from(canonicalJson(value));
	const read = async (path, changes = new Map()) => {
		const bytes = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(bytes), `Missing original: ${path}`); return bytes;
	};
	const reject = (changes, label) => assert.rejects(
		checkNestedCheckedRecordPhpReport(path => read(path, changes), options), undefined, label);
	let recordControls = 0, executionControls = 0, toolControls = 0;
	let resourceControls = 0, environmentControls = 0, packageControls = 0, modelControls = 0;
	for(const path of accepted.records)
		for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
		{
			await reject(new Map([[path, replacement]]), path); recordControls++;
		}
	const executionChanges = [
		value => { value.run.code = 1; }
		, value => { value.run.stderr = "warning"; }
		, value => { value.counts.checks--; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.counts.snapshotControls = 0; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.counts.hostRejections--; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.counts.recoveries++; value.run.stdout = JSON.stringify(value.counts) + "\n"; }
		, value => { value.args = []; }
		, value => { value.command += "-substituted"; }
		, value => { value.cwd += "-not-the-moved-tree"; }
		, value => { value.relocated = !value.relocated; }
		, value => { value.strictness = value.strictness === "weak" ? "strict" : "weak"; }
		, value => { value.closure.vendorFilesSha256 = "0".repeat(64); }
	];
	for(const [position, place] of ["installed", "relocated"].entries())
		for(const [offset, strictness] of ["weak", "strict"].entries())
			for(const mutate of executionChanges)
			{
				const report = json("report.json"), path = `${place}-${strictness}.json`, observation = json(path);
				mutate(observation); report.observations[2 * position + offset] = observation;
				await reject(new Map([[path, encode(observation)], ["report.json", encode(report)]]), path); executionControls++;
			}
	const toolChanges = [
		value => { value.selected.phpVersion = "8.2.0"; }
		, value => { value.selected.composerVersion = "2.0.0"; }
		, ...[["version", "8.2.0"], ["sapi", "fpm-fcgi"], ["zts", 1]
			, ["integerBytes", 4], ["arch", "aarch64"], ["os", "Windows"]]
			.map(([key, item]) => value => { value.interpreter.php[key] = item; value.interpreter.run.stdout = JSON.stringify(value.interpreter.php); })
		, value => { value.runtimeFlags.push("-d", "auto_prepend_file=/unrecorded.php"); }
		, value => { value.composerVersion.args = value.composerVersion.args.filter(arg => arg !== "--no-plugins"); }
		, value => { value.composerVersion.run.stdout = "Composer version 2.0.0 2020-01-01\n"; }
		, value => { value.tools["/unrecorded/extra.so"] = identity("extra"); }
	];
	for(const mutate of toolChanges)
	{
		const report = json("report.json"), tools = json("tools.json"); mutate(tools); report.tools = tools;
		await reject(new Map([["tools.json", encode(tools)], ["report.json", encode(report)]]), "coordinated PHP tools"); toolControls++;
	}
	for(const mutate of [
		value => { value[0].observations[0].freeBytes = 1024; }
		, value => { value[0].observations[0].availableBytes = 1024; }
		, value => { value[0].observations.at(-1).load = json("report.json").loadCeiling; }
		, value => { value[0].waits++; }
	]) {
		const report = json("report.json"), resources = json("resources.json"); mutate(resources);
		report.resourceChecks = resources;
		await reject(new Map([["resources.json", encode(resources)]
			, ["report.json", encode(report)]]), "resource guard"); resourceControls++;
	}
	for(const loadCeiling of [6, 10, 24])
	{
		const report = json("report.json"); report.loadCeiling = loadCeiling;
		await reject(new Map([["report.json", encode(report)]])
			, "unrecorded load ceiling"); resourceControls++;
	}
	const environmentChanges = [
		value => { value.vendorFiles["unrecorded/plugin.php"] = identity("extra"); }
		, value => { delete value.vendorFiles["example/nestedcheckedrecords/src/Api.php"]; }
		, value => { value.vendorFiles["example/nestedcheckedrecords/src/Api.php"] = { kind: "symlink", target: "/tmp/injected.php" }; }
		, value => { value.feedFiles["component.zip"].sha256 = "0".repeat(64); }
		, value => { value.dependencyFiles["composer.json"].sha256 = "0".repeat(64); }
		, value => { value.generatedFiles["vendor/autoload.php"].sha256 = "0".repeat(64); }
		, value => { value.inputs["strict.php"] = value.inputs["consumer.php"]; }
		, value => { value.command = "/unrecorded/php"; }
		, value => { value.root = "relative/path"; }
		, value => { value.receiptBytes += "\n"; }
	];
	for(const mutate of environmentChanges)
	{
		const environment = json("environment.json"), packaged = json("package.json"); mutate(environment);
		packaged.closure.vendorFilesSha256 = sha256(canonicalJson(environment.vendorFiles));
		await assert.rejects(checkNestedCheckedRecordPhpEnvironmentRecords({
			read, json, environment, packaged
			, receipt: json("build-0/package-set-receipt.json")
			, tools: json("tools.json")
			, caller: originals.get("consumer.php").toString()
		})); environmentControls++;
	}
	for(const target of ["src/Api.php", "src/Internal/Native.php", "src/Internal/Runtime.php", "src/extra.php"])
	{
		const packaged = json("package.json"), receipt = json(`package/${nestedCheckedRecordPhpReceipt}`);
		const changes = new Map();
		const bytes = Buffer.concat([originals.get(`package/${target}`) ?? Buffer.alloc(0), Buffer.from("\n// substituted PHP source\n")]);
		changes.set(`package/${target}`, bytes); receipt.files[target] = identity(bytes); packaged.files[target] = identity(bytes);
		if(!packaged.retained.includes(target)) packaged.retained.push(target); packaged.retained.sort();
		const receiptBytes = encode(receipt); changes.set(`package/${nestedCheckedRecordPhpReceipt}`, receiptBytes);
		packaged.files[nestedCheckedRecordPhpReceipt] = identity(receiptBytes);
		packaged.receiptSha256 = sha256(receiptBytes); changes.set("package.json", encode(packaged));
		const altered = path => read(path, changes);
		await assert.rejects(checkNestedCheckedRecordPhpPackageRecords({ read: altered
			, json: async path => JSON.parse(await altered(path))
			, model: json("build-0/model.json")
			, receipt: json("build-0/package-set-receipt.json")
			, producerCommit: options.producerCommit, floor: options.floor }));
		packageControls++;
	}
	const replaceLeaf = (value, predicate, mutate) => {
		if(!value || typeof value !== "object") return false;
		if(predicate(value))
		{
			mutate(value); return true;
		}
		return Object.values(value).some(child => replaceLeaf(child, predicate, mutate));
	};
	const modelChanges = [
		value => { value.pointerBits = 32; }
		, value => { value.exports.pop(); }
		, value => { value.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, value => { assert.ok(replaceLeaf(value.exports.map(item => item.refinements)
			, item => item.kind === "fin", item => { item.bound = "9"; })); }
		, value => { assert.ok(replaceLeaf(value.exports.map(item => item.refinements?.result)
			, item => item.kind === "checked-record", item => { item.constructor = "NestedCheckedRecords.mkPacket"; })); }
		, value => { assert.ok(replaceLeaf(value.exports.map(item => item.refinements?.result)
			, item => item.kind === "subtype", item => { item.constructor = "NestedCheckedRecords.mkWord"; })); }
		, ...options.mode === "full" ? [value => { assert.ok(replaceLeaf(value.exports.map(item => item.refinements?.parameters)
			, item => item.kind === "subtype" && item.constructor !== null, item => { item.constructor = "NestedCheckedRecords.unreviewed"; })); }] : []
	];
	for(const mutate of modelChanges)
	{
		const report = json("report.json"), changes = new Map();
		for(const attempt of [0, 1])
		{
			const path = `build-${attempt}/model.json`, model = json(path); mutate(model);
			const bytes = encode(model); changes.set(path, bytes); report.builds[attempt].modelSha256 = sha256(bytes);
		}
		const altered = path => read(path, changes);
		await assert.rejects(checkNestedCheckedRecordPhpModels({ ...options, report
			, read: altered, json: async path => JSON.parse(await altered(path)) }));
		modelControls++;
	}
	return { recordControls, executionControls, toolControls, resourceControls
		, environmentControls, packageControls, modelControls };
};
