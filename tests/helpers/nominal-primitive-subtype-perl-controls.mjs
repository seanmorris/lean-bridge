/**
 * Missing-record, coordinated-tamper, archive and compiler-decision controls for original Perl evidence.
 * Mutations stay in memory; no original record changes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { checkNominalPrimitiveSubtypePerlModels } from "./nominal-primitive-subtype-perl-model-records.mjs";
import { checkNominalPrimitiveSubtypePerlReport, nominalPrimitiveSubtypePerlRecords } from "./nominal-primitive-subtype-perl-report.mjs";

/**
 * Require every original file, reject coordinated package, archive and compiler changes.
 *
 * @param originalRead - Original record reader; mutations stay in memory.
 * @param options - Independently selected route, API, producer and runtime.
 */
export const checkNominalPrimitiveSubtypePerlControls = async (originalRead, options) => {
	const accepted = await checkNominalPrimitiveSubtypePerlReport(originalRead, options);
	const receipt = JSON.parse(await originalRead("build-0/package-set-receipt.json"));
	const paths = nominalPrimitiveSubtypePerlRecords(options.route, receipt);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`); return Buffer.from(value);
	};
	const json = path => JSON.parse(originals.get(path));
	const rejects = (changes, label) => assert.rejects(checkNominalPrimitiveSubtypePerlReport(path => read(path, changes), options), undefined, label);
	let recordControls = 0, packageControls = 0, handoffControls = 0, modelControls = 0;
	for(const path of paths) for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
	{
		await rejects(new Map([[path, replacement]]), path); recordControls++;
	}
	const report = json("report.json");
	for(const position of [0, 7]) for(const role of ["runtime", "component"])
	{
		const item = report.reports[position], prefix = `${item.configuration}/${item.delivery}/`;
		const changes = [
			context => { context.manifest.glibcMinimumVersion = "2.38"; }
			, context => { context.manifest.prebuilt.pop(); }
			, context => { context.installation.abi.api_version = "34"; }
			, context => { context.installation.operation = "rebuilt-lean"; context.trace.operation = "rebuilt-lean"; }
			, context => { context.trace.nativePayloadUnchanged = false; }
			, context => { context.trace.files.pop(); }
			, context => { context.trace.files[0].path = "../outside"; }
			, context => { context.installed["../outside"] = { bytes: 1, sha256: "0".repeat(64) }; }
			, ...["xs", "pm"].map(extension => context => {
				const path = prefix + `${role}-${extension === "xs" ? "source.xs" : "public.pm"}`;
				const bytes = Buffer.concat([context.altered.get(path), Buffer.from("\n# changed generated API\n")]);
				context.altered.set(path, bytes);
				const relative = context.manifest.module.replaceAll("::", "/");
				const member = extension === "xs" ? context.manifest.xs : `lib/${relative}.pm`;
				context.manifest.files[member] = sha256(bytes);
				if(extension === "xs" && item.delivery === "build-xs") context.installation.sourceSha256 = sha256(bytes);
				if(extension === "pm")
				{
					context.trace.files.find(file => file.path === `${relative}.pm`).sha256 = sha256(bytes);
					context.installed[context.base + relative + ".pm"] = { bytes: bytes.length, sha256: sha256(bytes) };
				}
			})
			, ...item.delivery === "build-xs" ? [
				context => { context.installation.commands[0][0] = "/usr/bin/lean"; }
				, context => { context.installation.commands[0].push("arbitrary.c"); }
				, context => { context.installation.sourceSha256 = "0".repeat(64); }
			] : [context => { context.installation.outputSha256 = "0".repeat(64); }]
		];
		for(const change of changes)
		{
			const altered = new Map();
			const get = path => JSON.parse(altered.get(path) ?? originals.get(path));
			const set = (path, value) => altered.set(path, Buffer.from(canonicalJson(value)));
			const observation = get("report.json"), current = observation.reports[position];
			const context = { altered, manifest: get(prefix + `${role}-manifest.json`)
				, installation: get(prefix + `${role}-install-receipt.json`)
				, trace: get(prefix + `${role}-trace.json`)
				, installed: get(prefix + "installed-files.json") };
			for(const path of [prefix + `${role}-source.xs`, prefix + `${role}-public.pm`]) altered.set(path, originals.get(path));
			const suffix = `${context.manifest.module.replaceAll("::", "/")}/install-receipt.json`;
			const receiptPath = Object.keys(context.installed).find(path => path.endsWith("/" + suffix));
			context.base = receiptPath.slice(0, -suffix.length);
			change(context);
			set(prefix + `${role}-manifest.json`, context.manifest);
			set(prefix + `${role}-install-receipt.json`, context.installation);
			set(prefix + `${role}-trace.json`, context.trace);
			const bytes = altered.get(prefix + `${role}-install-receipt.json`);
			context.installed[receiptPath] = { bytes: bytes.length, sha256: sha256(bytes) };
			set(prefix + "installed-files.json", context.installed);
			current.installedFilesSha256 = sha256(altered.get(prefix + "installed-files.json"));
			const trace = current.traces.find(value => value.role === role);
			trace.manifestSha256 = sha256(altered.get(prefix + `${role}-manifest.json`));
			trace.receiptSha256 = sha256(bytes); trace.traceSha256 = sha256(altered.get(prefix + `${role}-trace.json`));
			set(prefix + "report.json", current); set("report.json", observation);
			await rejects(altered, `${prefix}${role} tamper`); packageControls++;
		}
	}
	const handoffReceipt = "handoff/package-set-receipt.json", archives = receipt.packages.map(pkg => "handoff/" + pkg.artifacts[0].path);
	const handoffMutations = [
		["noncanonical receipt", new Map([[handoffReceipt, Buffer.concat([originals.get(handoffReceipt), Buffer.from(" ")])]])]
		, ["changed receipt digest sidecar", new Map([[handoffReceipt + ".sha256", Buffer.from(`${"0".repeat(64)}  package-set-receipt.json\n`)]])]
		, ["truncated archive", new Map([[archives[0], originals.get(archives[0]).subarray(0, originals.get(archives[0]).length - 1)]])]
		, ["swapped archives", new Map([[archives[0], originals.get(archives[1])], [archives[1], originals.get(archives[0])]])]
	];
	for(const [label, changes] of handoffMutations)
	{ await rejects(changes, label); handoffControls++; }
	for(const [label, mutate] of nominalPrimitiveSubtypePerlModelMutations(options.mode))
	{
		const changes = new Map(), model = json("build-0/model.json"), top = json("report.json"); mutate(model);
		const bytes = Buffer.from(canonicalJson(model));
		for(const attempt of [0, 1])
		{ changes.set(`build-${attempt}/model.json`, bytes); top.builds[attempt].modelSha256 = sha256(bytes); }
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkNominalPrimitiveSubtypePerlModels({ ...options, report: top
			, read: mutatedRead
			, json: async path => JSON.parse(await mutatedRead(path)) }), assert.AssertionError, label);
		modelControls++;
	}
	return { ...accepted, recordControls, packageControls, handoffControls, modelControls };
};

/**
 * Select wrong compiler facts and every primitive constructor identity explicitly.
 *
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypePerlModelMutations = mode => {
	assert.ok(["full", "result-only"].includes(mode));
	const output = model => model.exports.find(item => item.name === "NominalPrimitiveSubtypes.produce").refinements.result.arguments[0];
	const input = model => model.exports.find(item => item.name === "NominalPrimitiveSubtypes.echoB").refinements.parameters[0];
	const mutations = [
		["omitted export", model => { model.exports.pop(); }]
		, ["changed extractor", model => { model.sourceIdentity.extractorSha256 = "0".repeat(64); }]
		, ["wrong native word width", model => { model.pointerBits = 32; }]
		, ["changed Perl module", model => { model.moduleName = "LeanBridge::NominalSubtypes"; }]
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
