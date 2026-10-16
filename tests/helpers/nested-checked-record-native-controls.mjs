/**
 * Challenge nested checked-record native evidence without changing originals.
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
	checkNestedCheckedRecordNativeReport, nestedCheckedRecordNativeRecords
} from "./nested-checked-record-native-report.mjs";

const canonical = value => Buffer.from(canonicalJson(value));

/**
 * Require every original and reject coordinated claim, model and package changes.
 *
 * @param originalRead - Reader relative to one completed selection.
 * @param options - Independently fixed run identity accepted by the report checker.
 */
export const checkNestedCheckedRecordNativeControls = async (originalRead, options) => {
	const accepted = await checkNestedCheckedRecordNativeReport(originalRead, options);
	const receipt = JSON.parse(await originalRead("build-0/package-set-receipt.json"));
	const paths = nestedCheckedRecordNativeRecords(options.route, receipt);
	assert.equal(new Set(paths).size, paths.length);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const identities = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), "Missing original record: " + path);
		return value;
	};
	const json = path => JSON.parse(originals.get(path));
	let recordControls = 0, reportControls = 0;
	let resourceControls = 0, modelControls = 0, packageControls = 0;
	for(const path of paths)
	{
		await assert.rejects(checkNestedCheckedRecordNativeReport(
			name => read(name, new Map([[path, null]])), options), undefined, path);
		recordControls++;
	}
	const reportMutations = [
		value => { value.independentBuilds = 1; }
		, value => { value.route = options.route === "ordinary" ? "reviewed" : "ordinary"; }
		, value => { value.mode = options.mode === "full" ? "result-only" : "full"; }
		, value => { value.producerCommit = "0".repeat(40); }
		, value => { value.profiles.pop(); }
		, value => { value.declaredGlibcFloor = "2.35"; }
		, value => { value.runtime.glibc.stdout = "glibc 2.35\n"; }
		, value => { value.reproducible = false; }
		, value => { value.authorInputsUnchanged = false; }
		, value => { value.resourceAdmission.samples--; }
		, ...[0, 1].flatMap(index => [
			value => { value.reports[index].checks++; }
			, value => { value.reports[index].result.rejections++; }
			, value => { value.reports[index].sourceSha256 = "0".repeat(64); }
			, value => { value.reports[index].compiler.code = 17; }
			, value => { value.reports[index].runs[1].relocated = false; }
			, value => { value.reports[index].runs[1].stdout = "{}\n"; }
			, value => { value.reports[index].packages = []; }
			, ...["offlineInstall", "compilerFreePath", "compilerFreeReplay"
				, "relocatedInstallation", "sourceRemovedBeforeInstallation"]
				.map(key => value => { value.reports[index][key] = false; })
		])
	];
	for(const mutate of reportMutations)
	{
		const report = json("report.json"), before = canonicalJson(report); mutate(report);
		assert.notEqual(canonicalJson(report), before);
		const changes = new Map([["report.json", canonical(report)]
			, ["runtime.json", canonical(report.runtime)]]);
		for(const item of report.reports)
		{
			changes.set(`${item.profile}/report.json`, canonical(item));
			changes.set(`${item.profile}/compiler.json`, canonical(item.compiler));
			for(const [position, run] of item.runs.entries())
				changes.set(`${item.profile}/${position ? "relocated" : "installed"}.json`
					, canonical(run));
		}
		await assert.rejects(checkNestedCheckedRecordNativeReport(
			path => read(path, changes), options));
		reportControls++;
	}
	const resourceMutations = [
		value => { value.maxLoad = 6; }
		, value => { value.samples[0].observations[0].freeBytes = 2 * 1024 ** 3 - 1; }
		, value => { value.samples[0].observations[0].availableBytes = 2 * 1024 ** 3 - 1; }
		, value => { value.samples[0].observations.at(-1).load = value.maxLoad; }
		, value => { value.samples[0].waits++; }
	];
	for(const mutate of resourceMutations)
	{
		const resources = json("resources.json"); mutate(resources);
		const changes = new Map([["resources.json", canonical(resources)]]);
		await assert.rejects(checkNestedCheckedRecordNativeReport(
			path => read(path, changes), options));
		resourceControls++;
	}
	const modelMutations = [
		model => { model.exports.pop(); }
		, model => { model.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, model => { model.pointerBits = 32; }
		, model => {
			const tree = model.exports.find(item => item.name.endsWith("produceArray"))
				.refinements.result.arguments[0];
			assert.equal(tree.kind, "checked-record"); tree.arguments[0].bound = "9";
		}
	];
	for(const mutate of modelMutations)
	{
		const model = json("build-0/model.json"), report = json("report.json"); mutate(model);
		const bytes = canonical(model), changes = new Map();
		for(const attempt of [0, 1])
		{
			changes.set(`build-${attempt}/model.json`, bytes);
			report.builds[attempt].modelSha256 = sha256(bytes);
		}
		changes.set("report.json", canonical(report));
		await assert.rejects(checkNestedCheckedRecordNativeReport(
			path => read(path, changes), options));
		modelControls++;
	}
	for(const originalPackage of receipt.packages)
	{
		const profile = originalPackage.target, artifact = originalPackage.artifacts[0];
		const root = `nestedcheckedrecords-1.0.0-${profile}`;
		const files = readRepositoryTar(originals.get("handoff/" + artifact.path), root);
		const header = `include/nestedcheckedrecords.${profile === "c" ? "h" : "hpp"}`;
		files.set(header, Buffer.concat([files.get(header), Buffer.from("\n/* substituted */\n")]));
		const packaged = JSON.parse(files.get("lean-bridge-package.json"));
		packaged.files = Object.fromEntries([...files]
			.filter(([path]) => path !== "lean-bridge-package.json")
			.map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }]));
		const packageBytes = canonical(packaged);
		files.set("lean-bridge-package.json", packageBytes);
		const members = [...files].map(([path, bytes]) => ({
			path: root + "/" + path, bytes, mode: 0o644
		}));
		const archive = createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
			, files: members });
		const changedReceipt = structuredClone(receipt);
		const replacement = changedReceipt.packages.find(pkg => pkg.target === profile)
			.artifacts[0];
		replacement.bytes = archive.length; replacement.sha256 = sha256(archive);
		const receiptBytes = canonical(changedReceipt), report = json("report.json");
		for(const attempt of [0, 1])
		{
			report.builds[attempt].receiptSha256 = sha256(receiptBytes);
			report.builds[attempt].archives[artifact.path] = replacement.sha256;
		}
		const changedItem = report.reports.find(item => item.profile === profile);
		changedItem.packages = changedReceipt.packages.filter(pkg => pkg.target === profile);
		for(const run of changedItem.runs) run.receiptSha256 = sha256(packageBytes);
		const changes = new Map([
			["report.json", canonical(report)]
			, [profile + "/report.json", canonical(changedItem)]
			, [profile + "/lean-bridge-package.json", packageBytes]
			, [profile + "/installed.json", canonical(changedItem.runs[0])]
			, [profile + "/relocated.json", canonical(changedItem.runs[1])]
			, ["handoff/" + artifact.path, archive]
			, ["handoff/package-set-receipt.json", receiptBytes]
			, ["handoff/package-set-receipt.json.sha256"
				, Buffer.from(sha256(receiptBytes) + "  package-set-receipt.json\n")]
			, ...[0, 1].map(attempt =>
				[`build-${attempt}/package-set-receipt.json`, receiptBytes])
		]);
		await assert.rejects(checkNestedCheckedRecordNativeReport(
			path => read(path, changes), options), undefined, profile);
		packageControls++;
	}
	for(const [path, hash] of identities)
		assert.equal(sha256(await originalRead(path)), hash, path);
	return { ...accepted, recordControls, reportControls, resourceControls
		, modelControls, packageControls };
};
