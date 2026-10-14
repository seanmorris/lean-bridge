/**
 * Reject missing originals and coordinated native execution/model substitutions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { readOwnedPerlCallbackVariantTar as readRepositoryTar } from "./owned-perl-callback-result-variant-archives.mjs";
import { checkNominalPrimitiveSubtypeNativeModels } from "./nominal-primitive-subtype-native-model-records.mjs";
import { checkNominalPrimitiveSubtypeNativePackages } from "./nominal-primitive-subtype-native-package-records.mjs";
import { checkNominalPrimitiveSubtypeNativeReport, nominalPrimitiveSubtypeNativeRecords } from "./nominal-primitive-subtype-native-report.mjs";

/**
 * Enumerate every primitive constructor and the independent Fin sibling.
 *
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypeNativeModelMutations = mode => {
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
 * Preserve the actual original files while exercising strict checker failures in memory.
 *
 * @param originalRead - Reader relative to one actual native selection.
 * @param options - Independently fixed producer, route, mode, runtime and floor.
 */
export const checkNominalPrimitiveSubtypeNativeControls = async (originalRead, options) => {
	const accepted = await checkNominalPrimitiveSubtypeNativeReport(originalRead, options);
	const receipt = JSON.parse(await originalRead("build-0/package-set-receipt.json"));
	const paths = nominalPrimitiveSubtypeNativeRecords(options.route, receipt), originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const identities = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), "Missing original record: " + path); return value;
	};
	const json = path => JSON.parse(originals.get(path));
	let recordControls = 0, reportControls = 0, modelControls = 0, packageControls = 0;
	for(const path of paths) for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
	{
		const changes = new Map([[path, replacement]]);
		await assert.rejects(checkNominalPrimitiveSubtypeNativeReport(path => read(path, changes), options), undefined, path);
		recordControls++;
	}
	const mutations = [
		value => { value.independentBuilds = 1; }
		, value => { value.route = options.route === "ordinary" ? "reviewed" : "ordinary"; }
		, value => { value.mode = options.mode === "full" ? "result-only" : "full"; }
		, value => { value.producerCommit = "0".repeat(40); }
		, value => { value.profiles.pop(); }
		, value => { value.declaredGlibcFloor = "2.35"; }
		, value => { value.runtime.glibc.stdout = "glibc 2.35\n"; }
		, value => { value.reproducible = false; }
		, value => { value.authorInputsUnchanged = false; }
		, ...[0, 1].flatMap(index => [
			value => { value.reports[index].checks++; }
			, value => { value.reports[index].result.rejections++; }
			, value => { value.reports[index].result.snapshotControls = 0; }
			, value => { value.reports[index].result.wordBits = 32; }
			, value => { value.reports[index].sourceSha256 = "0".repeat(64); }
			, value => { value.reports[index].consumerSha256 = "0".repeat(64); }
			, value => { value.reports[index].dispatch.observed = true; }
			, value => { value.reports[index].compiler.code = 17; }
			, value => { value.reports[index].runs[1].relocated = false; }
			, value => { value.reports[index].runs[1].stdout = value.reports[index].runs[1].stdout.replace('"wordBits":64', '"wordBits":32'); }
			, value => { value.reports[index].packages = []; }
			, ...["offlineInstall", "compilerFreePath", "compilerFreeReplay", "relocatedInstallation", "sourceRemovedBeforeInstallation"].map(key => value => { value.reports[index][key] = false; })
		])
	];
	for(const mutate of mutations)
	{
		const report = json("report.json"), before = canonicalJson(report); mutate(report);
		assert.notEqual(canonicalJson(report), before);
		const changes = new Map(), set = (path, value) => changes.set(path, Buffer.from(canonicalJson(value)));
		set("report.json", report); set("runtime.json", report.runtime);
		for(const item of report.reports)
		{
			set(item.profile + "/report.json", item); set(item.profile + "/compiler.json", item.compiler);
			for(const [position, run] of item.runs.entries()) set(`${item.profile}/${position ? "relocated" : "installed"}.json`, run);
		}
		await assert.rejects(checkNominalPrimitiveSubtypeNativeReport(path => read(path, changes), options)); reportControls++;
	}
	for(const [label, mutate] of nominalPrimitiveSubtypeNativeModelMutations(options.mode))
	{
		const changes = new Map(), model = json("build-0/model.json"), report = json("report.json"); mutate(model);
		const bytes = Buffer.from(canonicalJson(model));
		for(const attempt of [0, 1])
		{ changes.set(`build-${attempt}/model.json`, bytes); report.builds[attempt].modelSha256 = sha256(bytes); }
		const modified = path => read(path, changes);
		await assert.rejects(checkNominalPrimitiveSubtypeNativeModels({ ...options
			, report, read: modified
			, json: async path => JSON.parse(await modified(path)) }), assert.AssertionError, label);
		modelControls++;
	}
	for(const originalPackage of receipt.packages)
	{
		const profile = originalPackage.target, artifact = originalPackage.artifacts[0];
		const root = `nominalprimitivesubtypes-1.0.0-${profile}`;
		const members = readRepositoryTar(originals.get("handoff/" + artifact.path), root);
		const publicHeader = `include/nominalprimitivesubtypes.${profile === "c" ? "h" : "hpp"}`;
		const mutations = [
			["changed generated public header", files => files.set(publicHeader, Buffer.concat([files.get(publicHeader), Buffer.from("\n/* substituted */\n")]))]
			, ["additional public header", files => files.set("include/injected.h", Buffer.from("#pragma once\n"))]
			, ["additional unlisted payload", files => files.set("injected.h", Buffer.from("#pragma once\n"))]
			, ["changed adapter library", files => {
				const path = "lib/libnominalprimitivesubtypes.so", bytes = Buffer.from(files.get(path));
				bytes[bytes.length - 1] ^= 1; files.set(path, bytes);
			}]
			, ["changed declared glibc floor", (_files, packaged) => { packaged.glibcMinimumVersion = "2.35"; }]
			, ...profile === "c" ? [
				["changed corresponding GMP source", files => {
					const path = "share/lean-bridge/sources/gmp-6.3.0.tar.xz", bytes = Buffer.from(files.get(path));
					bytes[bytes.length - 1] ^= 1; files.set(path, bytes);
					const gmp = JSON.parse(files.get("share/lean-bridge/gmp.json")); gmp.sha256 = sha256(bytes);
					files.set("share/lean-bridge/gmp.json", Buffer.from(canonicalJson(gmp)));
				}]
				, ["unverified GMP build", files => {
					const path = "share/lean-bridge/gmp.json", gmp = JSON.parse(files.get(path)); gmp.checked = false;
					files.set(path, Buffer.from(canonicalJson(gmp)));
				}]
			] : []
		];
		for(const [label, mutate] of mutations)
		{
			const files = new Map(members), packaged = JSON.parse(files.get("lean-bridge-package.json"));
			mutate(files, packaged);
			packaged.files = Object.fromEntries([...files].filter(([path]) => path !== "lean-bridge-package.json")
				.map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }]));
			const packageBytes = Buffer.from(canonicalJson(packaged)); files.set("lean-bridge-package.json", packageBytes);
			const archive = createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
				, files: [...files].map(([path, bytes]) => ({ path: root + "/" + path, bytes, mode: 0o644 })) });
			const changed = structuredClone(receipt), replacement = changed.packages.find(pkg => pkg.target === profile).artifacts[0];
			replacement.bytes = archive.length; replacement.sha256 = sha256(archive);
			const receiptBytes = Buffer.from(canonicalJson(changed));
			const changes = new Map([
				["handoff/" + artifact.path, archive]
				, [profile + "/lean-bridge-package.json", packageBytes]
				, ["handoff/package-set-receipt.json", receiptBytes]
				, ["handoff/package-set-receipt.json.sha256", Buffer.from(sha256(receiptBytes) + "  package-set-receipt.json\n")]
			]);
			await assert.rejects(checkNominalPrimitiveSubtypeNativePackages({
				read: path => read(path, changes), model: json("build-0/model.json")
				, receipt: changed, floor: options.floor
				, producerCommit: options.producerCommit }), undefined, profile + ": " + label);
			packageControls++;
		}
	}
	for(const [path, hash] of identities) assert.equal(sha256(await originalRead(path)), hash, path);
	return { ...accepted, recordControls, reportControls, modelControls, packageControls };
};
