/**
 * Missing-record and coordinated-tamper controls for inherited checked-record
 * Perl evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkInheritedCheckedRecordPerlCiRecords
	, inheritedCheckedRecordPerlRecordPaths
} from "./inherited-checked-record-perl-ci-report.mjs";

const refined = model => model.exports.flatMap(item =>
	item.refinements ? [item.refinements] : []);
const replaceLeaf = (value, predicate, mutate) => {
	if(!value || typeof value !== "object") return false;
	if(predicate(value))
	{
		mutate(value); return true;
	}
	return Object.values(value).some(child =>
		replaceLeaf(child, predicate, mutate));
};

/**
 * Coordinated compiler-model changes that must still be refused.
 *
 * @param mode - Full or result-only API.
 */
export const inheritedCheckedRecordPerlModelMutations = mode => {
	assert.ok(["full", "result-only"].includes(mode));
	return [
		["wrong native word width", model => { model.pointerBits = 32; }]
		, ["omitted export", model => { model.exports.pop(); }]
		, ["changed extractor", model => {
			model.sourceIdentity.extractorSha256 = "0".repeat(64);
		}]
		, ["changed Lean version", model => {
			model.sourceIdentity.leanVersion = "0.0.0";
		}]
		, ["malformed Lean commit", model => {
			model.sourceIdentity.leanCommit = "unknown";
		}]
		, ["malformed Lean compiler", model => {
			model.sourceIdentity.leanCompilerSha256 = "unknown";
		}]
		, ["changed source notices", model => {
			model.sourceIdentity.sourceNoticesSha256 = "0".repeat(64);
		}]
		, ["changed source tree", model => {
			model.sourceIdentity.sourceTreeSha256 = "0".repeat(64);
		}]
		, ["invented lake dependency", model => {
			model.sourceIdentity.lakeDependencies = [];
		}]
		, ["changed metadata source", model => {
			model.sourceIdentity.request.metadata.modules[0].sourceSha256
				= "0".repeat(64);
		}]
		, ["changed metadata toolchain", model => {
			model.sourceIdentity.request.metadata.toolchain = "leanprover/lean4:v0";
		}]
		, ["changed Fin bound", model => {
			assert.ok(replaceLeaf(refined(model), item => item.kind === "fin"
				, item => { item.bound = "9"; }));
		}]
		, ["invented result constructor", model => {
			assert.ok(replaceLeaf(refined(model).map(item => item.result)
				, item => item.kind === "checked-record"
				, item => {
					item.constructor = "InheritedCheckedRecords.mkTicket";
				}
			));
		}]
		, ...mode === "full" ? [[
			"unreviewed parameter constructor", model => {
				assert.ok(replaceLeaf(refined(model).map(item => item.parameters)
					, item => item.kind === "subtype"
						&& item.constructor !== null
					, item => {
						item.constructor = "InheritedCheckedRecords.unreviewed";
					}
				));
			}
		]] : []
	];
};

/**
 * Require every original and refuse coordinated producer-record changes.
 *
 * @param originalRead - Original record and handoff byte reader.
 * @param options - Complete independently selected checker options.
 */
export const checkInheritedCheckedRecordPerlControls = async (
	originalRead, options
) => {
	const accepted = await checkInheritedCheckedRecordPerlCiRecords({
		...options, read: originalRead
	});
	const allPaths = [...options.paths].sort();
	const recordPaths = inheritedCheckedRecordPerlRecordPaths(
		options.route, options.mode
	);
	const originals = new Map();
	for(const path of allPaths)
		originals.set(path, Buffer.from(await originalRead(path)));
	const identities = new Map([...originals].map(([path, bytes]) =>
		[path, sha256(bytes)]));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`);
		return Buffer.from(value);
	};
	const json = path => JSON.parse(originals.get(path));
	const reject = changes => assert.rejects(
		checkInheritedCheckedRecordPerlCiRecords({
			...options, read: path => read(path, changes)
		})
	);
	let recordControls = 0, resourceControls = 0;
	let interpreterControls = 0, modelControls = 0;
	let executionControls = 0, packageControls = 0;
	for(const path of recordPaths)
		for(const replacement of [
			null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])
		]){
			await reject(new Map([[path, replacement]]));
			recordControls++;
		}
	for(const mutate of [
		value => { value[0].observations[0].freeBytes = 1024; }
		, value => { value[0].observations[0].availableBytes = 1024; }
		, value => {
			value[0].observations.at(-1).load
				= json("report.json").loadCeiling;
		}
		, value => { value[0].waits++; }
	]){
		const report = json("report.json");
		const resources = json("resources.json"); mutate(resources);
		report.resourceChecks = resources;
		await reject(new Map([
			["resources.json", Buffer.from(canonicalJson(resources))]
			, ["report.json", Buffer.from(canonicalJson(report))]
		]));
		resourceControls++;
	}
	for(const loadCeiling of [6, 10, 24])
	{
		const report = json("report.json");
		report.loadCeiling = loadCeiling;
		await reject(new Map([
			["report.json", Buffer.from(canonicalJson(report))]
		]));
		resourceControls++;
	}
	for(const mutate of [
		value => { value[0].command = "relative/perl"; }
		, value => { value[0].executable.sha256 = "0".repeat(64); }
		, value => { value[0].identity.version = "5.40.0"; }
		, value => { value.pop(); }
	]){
		const report = json("report.json");
		const interpreters = json("interpreters.json"); mutate(interpreters);
		report.interpreters = interpreters;
		await reject(new Map([
			["interpreters.json", Buffer.from(canonicalJson(interpreters))]
			, ["report.json", Buffer.from(canonicalJson(report))]
		]));
		interpreterControls++;
	}
	for(const [label, mutate] of inheritedCheckedRecordPerlModelMutations(
		options.mode
	)){
		const changes = new Map();
		const model = json("build-0/model.json");
		const report = json("report.json"); mutate(model);
		const bytes = Buffer.from(canonicalJson(model));
		for(const attempt of [0, 1])
		{
			changes.set(`build-${attempt}/model.json`, bytes);
			report.builds[attempt].modelSha256 = sha256(bytes);
		}
		changes.set("report.json", Buffer.from(canonicalJson(report)));
		await assert.rejects(checkInheritedCheckedRecordPerlCiRecords({
			...options, read: path => read(path, changes)
		}), assert.AssertionError, label);
		modelControls++;
	}
	const execution = `${options.interpreters[0].configuration}/prebuilt-only/`;
	for(const mutate of [
		value => { value.item.arguments = []; }
		, value => { value.item.repeatedRuns = 1; }
		, value => { value.item.proofFieldsAbsent = false; }
		, value => { value.item.compilerFreeReplay = false; }
		, value => { value.item.installationCCompilerAvailable = true; }
		, value => { value.installed.code = 1; }
		, value => { value.installed.stderr = "warning"; }
		, value => { value.relocated.code = 1; }
		, value => { value.relocated.stderr = "warning"; }
		, value => { value.installedResult.checks--; }
		, value => { value.relocatedResult.calls--; }
		, value => { value.item.installedFilesSha256 = "0".repeat(64); }
	]){
		const report = json("report.json");
		const item = report.reports[0];
		const installed = json(execution + "installed-process.json");
		const relocated = json(execution + "relocated-process.json");
		const installedResult = json(execution + "installed.json");
		const relocatedResult = json(execution + "relocated.json");
		mutate({ item, installed, relocated, installedResult, relocatedResult });
		const changes = new Map([
			["report.json", Buffer.from(canonicalJson(report))]
			, [execution + "installed-process.json"
				, Buffer.from(canonicalJson(installed))]
			, [execution + "relocated-process.json"
				, Buffer.from(canonicalJson(relocated))]
			, [execution + "installed.json"
				, Buffer.from(canonicalJson(installedResult))]
			, [execution + "relocated.json"
				, Buffer.from(canonicalJson(relocatedResult))]
		]);
		await reject(changes); executionControls++;
	}
	for(const [path, mutate] of [
		["component-manifest.json", value => { value.module = "Other"; }]
		, ["runtime-manifest.json", value => {
			value.runtimeIdentity = "0".repeat(64);
		}]
		, ["component-install-receipt.json", value => {
			value.operation = "unknown";
		}]
		, ["component-trace.json", value => {
			value.nativePayloadUnchanged = false;
		}]
	]){
		const fullPath = execution + path;
		const value = json(fullPath); mutate(value);
		await reject(new Map([[fullPath, Buffer.from(canonicalJson(value))]]));
		packageControls++;
	}
	for(const [path, digest] of identities)
		assert.equal(sha256(await originalRead(path)), digest, path);
	return {
		...accepted, recordControls, resourceControls, interpreterControls
		, modelControls, executionControls, packageControls
	};
};
