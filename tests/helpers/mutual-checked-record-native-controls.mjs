/**
 * Challenge recursive checked-record native evidence without changing originals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	createDeterministicTarGzFromFiles
} from "../../src/release/deterministic-archive.mjs";
import {
	readOwnedPerlCallbackVariantTar as readRepositoryTar
} from "./owned-perl-callback-result-variant-archives.mjs";
import {
	assertMutualCheckedRecordNativeRecordPaths
	, checkMutualCheckedRecordNativeReport, mutualCheckedRecordNativeRecords
} from "./mutual-checked-record-native-report.mjs";

const canonical = value => Buffer.from(canonicalJson(value));
const stableSummaryKeys = Object.freeze([
	"route", "producerCommit", "runtime", "floor", "reportSha256"
	, "bindingIrSha256", "recordPaths", "independentBuilds", "profiles"
	, "artifacts"
]);

/**
 * Require a current replay to preserve every semantic result while allowing
 * later verifier revisions to add (but never remove) destructive controls.
 *
 * @param archived - Summary emitted by the exact hosted producer/checker.
 * @param current - Summary replayed by the current verifier.
 */
export const assertMutualCheckedRecordNativeCurrentReplay = (
	archived, current
) => {
	for(const key of stableSummaryKeys)
		assert.deepEqual(current[key], archived[key], `current replay ${key}`);
	assert.ok(archived.controls && current.controls, "current replay controls");
	for(const [key, count] of Object.entries(archived.controls))
	{
		assert.ok(Number.isSafeInteger(count) && count > 0
			, `archived control count ${key}`);
		assert.ok(Number.isSafeInteger(current.controls[key])
			&& current.controls[key] >= count, `current control count ${key}`);
	}
};

/**
 * Require originals and reject coordinated record, model, source and package changes.
 *
 * @param originalRead - Reader relative to one completed route.
 * @param options - Independently fixed producer, route, runtime and floor.
 */
export const checkMutualCheckedRecordNativeControls = async (
	originalRead, options
) => {
	const accepted = await checkMutualCheckedRecordNativeReport(originalRead, options);
	const receipt = JSON.parse(await originalRead("build-0/package-set-receipt.json"));
	const paths = mutualCheckedRecordNativeRecords(options.route, receipt);
	assert.equal(new Set(paths).size, paths.length);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const identities = new Map([...originals].map(([path, bytes]) =>
		[path, sha256(bytes)]));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`);
		return value;
	};
	const json = path => JSON.parse(originals.get(path));
	const reject = (changes, matcher) => assert.rejects(
		checkMutualCheckedRecordNativeReport(path => read(path, changes), options)
		, matcher);

	let recordControls = 0, reportControls = 0, executionControls = 0;
	let modelControls = 0, sourceTreeControls = 0, packageControls = 0;
	const retained = [...paths, "controls.json"].sort();
	for(const path of retained)
	{
		assert.throws(() => assertMutualCheckedRecordNativeRecordPaths(
			retained.filter(item => item !== path), options.route, receipt), undefined, path);
		recordControls++;
	}
	await assert.rejects(checkMutualCheckedRecordNativeReport(path =>
		path === "configuration.json" ? undefined : read(path), options)
	, /Missing native record: configuration\.json/u);
	recordControls++;

	for(const [mutate, matcher] of [
		[value => { value.reproducible = false; }, /report reproducible/u]
		, [value => { value.independentBuilds = 1; }, /report independent builds/u]
		, [value => { value.declaredGlibcFloor = "2.35"; }, /report declared glibc floor/u]
		, [value => { value.producerCommit = "0".repeat(40); }, /report producer commit/u]
		, [value => { value.authorInputsUnchanged = false; }, /report author inputs unchanged/u]
		, [value => {
			value.route = value.route === "ordinary" ? "reviewed" : "ordinary";
		}
		, /report route/u]
		, [value => { value.profiles.pop(); }, /report profiles/u]
		, [value => { value.relocated = false; }, /report relocated/u]
		, [value => { value.sourceFree = false; }, /report source free/u]
		, [value => { value.runtime.glibc.stdout = "glibc 2.35\n"; }, /report runtime/u]
	]){
		const report = json("report.json");
		mutate(report);
		await reject(new Map([["report.json", canonical(report)]]), matcher);
		reportControls++;
	}

	for(const position of [0, 1]) for(const [mutate, label] of [
		[value => { value.checks++; }, "check count"]
		, [value => {
			value.relocatedReplay.stdout = "mutual-checked-record-ok:0\n";
		}
		, "replay"]
		, [value => { value.consumerSha256 = "0".repeat(64); }, "consumer digest"]
		, [value => { value.compilerFreeReplay = false; }, "compilerFreeReplay"]
	]){
		const report = json("report.json");
		const profile = structuredClone(report.reports[position]);
		mutate(profile);
		report.reports[position] = profile;
		await reject(new Map([
			["report.json", canonical(report)]
			, [`${profile.profile}/report.json`, canonical(profile)]
		]), new RegExp(`${profile.profile} ${label}|${profile.profile}\\.${label}`, "u"));
		executionControls++;
	}

	for(const [mutate, matcher] of [
		[model => { model.exports.pop(); }, /model export names/u]
		, [model => {
			model.sourceIdentity.extractorSha256 = "0".repeat(64);
		}
		, /extractor identity/u]
		, [model => { model.pointerBits = 32; }, /pointer width/u]
		, [model => {
			model.sourceIdentity.sourceNoticesSha256 = "0".repeat(64);
		}
		, /source notices identity/u]
		, [model => {
			model.sourceIdentity.request.metadata.toolchain = "leanprover/lean4:v0.0.0";
		}
		, /toolchain identity/u]
		, [model => {
			const tree = model.exports.find(item =>
				item.name === "MutualCheckedRecords.first").refinements.parameters[0];
			tree.fields[1].refinement.bound = "4";
		}
		, /MutualCheckedRecords\.first/u]
		, ...options.route === "reviewed" ? [[model => {
			model.sourceIdentity.reviewedBindingIr.sourceSha256 = "0".repeat(64);
		}
		, /reviewed source digest/u]] : []
	]){
		const model = json("build-0/model.json"), report = json("report.json");
		mutate(model);
		const modelBytes = canonical(model), changes = new Map();
		for(const attempt of [0, 1])
		{
			changes.set(`build-${attempt}/model.json`, modelBytes);
			report.builds[attempt].modelSha256 = sha256(modelBytes);
		}
		changes.set("report.json", canonical(report));
		await reject(changes, matcher);
		modelControls++;
	}

	{
		const model = json("build-0/model.json");
		const changedReceipt = structuredClone(receipt), report = json("report.json");
		model.sourceIdentity.sourceTreeSha256 = "0".repeat(64);
		const modelBytes = canonical(model), receiptBytes = canonical(changedReceipt);
		changedReceipt.source.treeSha256 = model.sourceIdentity.sourceTreeSha256;
		const finalReceiptBytes = canonical(changedReceipt), changes = new Map();
		for(const attempt of [0, 1])
		{
			changes.set(`build-${attempt}/model.json`, modelBytes);
			changes.set(`build-${attempt}/package-set-receipt.json`, finalReceiptBytes);
			report.builds[attempt].modelSha256 = sha256(modelBytes);
			report.builds[attempt].receiptSha256 = sha256(finalReceiptBytes);
		}
		assert.notDeepEqual(receiptBytes, finalReceiptBytes);
		changes.set("report.json", canonical(report));
		changes.set("handoff/package-set-receipt.json", finalReceiptBytes);
		changes.set("handoff/package-set-receipt.json.sha256", Buffer.from(
			`${sha256(finalReceiptBytes)}  package-set-receipt.json\n`));
		await reject(changes, /source tree identity/u);
		sourceTreeControls++;
	}

	{
		const profile = "c";
		const artifact = receipt.packages.find(pkg => pkg.target === profile).artifacts[0];
		const root = "mutualcheckedrecords-1.0.0-c";
		const files = readRepositoryTar(originals.get(`handoff/${artifact.path}`), root);
		const header = "include/mutualcheckedrecords.h";
		files.set(header, Buffer.concat([
			files.get(header), Buffer.from("\n/* coordinated substitution */\n")
		]));
		const packaged = JSON.parse(files.get("lean-bridge-package.json"));
		packaged.files = Object.fromEntries([...files]
			.filter(([path]) => path !== "lean-bridge-package.json")
			.map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }]));
		const packageBytes = canonical(packaged);
		files.set("lean-bridge-package.json", packageBytes);
		const archive = createDeterministicTarGzFromFiles({
			sourceDateEpoch: 1
			, files: [...files].map(([path, bytes]) => ({
				path: `${root}/${path}`, bytes, mode: 0o644
			}))
		});
		const changedReceipt = structuredClone(receipt);
		const replacement = changedReceipt.packages.find(pkg => pkg.target === profile)
			.artifacts[0];
		replacement.bytes = archive.length;
		replacement.sha256 = sha256(archive);
		const receiptBytes = canonical(changedReceipt), report = json("report.json");
		for(const attempt of [0, 1])
		{
			report.builds[attempt].receiptSha256 = sha256(receiptBytes);
			report.builds[attempt].archives[artifact.path] = replacement.sha256;
		}
		const profileReport = report.reports.find(item => item.profile === profile);
		profileReport.packages = changedReceipt.packages.filter(pkg => pkg.target === profile);
		profileReport.closure.receiptSha256 = sha256(packageBytes);
		const changes = new Map([
			["report.json", canonical(report)]
			, [`${profile}/report.json`, canonical(profileReport)]
			, [`handoff/${artifact.path}`, archive]
			, ["handoff/package-set-receipt.json", receiptBytes]
			, ["handoff/package-set-receipt.json.sha256"
				, Buffer.from(
					`${sha256(receiptBytes)}  package-set-receipt.json\n`)]
			, ...[0, 1].map(attempt =>
				[`build-${attempt}/package-set-receipt.json`, receiptBytes])
		]);
		await reject(changes, /include\/mutualcheckedrecords\.h/u);
		packageControls++;
	}

	for(const [path, identity] of identities)
		assert.equal(sha256(await originalRead(path)), identity, path);
	const { receipt: ignoredReceipt, observations, packages, ...summary } = accepted;
	void ignoredReceipt;
	return {
		...summary
		, profiles: observations.map(item => ({
			profile: item.profile, checks: item.checks
		}))
		, artifacts: packages.map(item => ({
			profile: item.profile, ...item.artifact
		}))
		, controls: {
			record: recordControls, report: reportControls
			, execution: executionControls, model: modelControls
			, sourceTree: sourceTreeControls, package: packageControls
		}
	};
};
