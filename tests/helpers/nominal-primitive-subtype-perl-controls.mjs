/**
 * Missing-record, coordinated-tamper, archive and compiler-decision controls for original Perl evidence.
 * Every control first proves that its mutation changed the bytes it targets; a silent no-op fails the
 * control itself. Mutations stay in memory; no original record changes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { checkNominalPrimitiveSubtypePerlModels } from "./nominal-primitive-subtype-perl-model-records.mjs";
import { checkNominalPrimitiveSubtypePerlReport, nominalPrimitiveSubtypePerlRecords } from "./nominal-primitive-subtype-perl-report.mjs";

/** The first prebuilt-only and the last build-xs installation of the eight-entry matrix. */
export const nominalPrimitiveSubtypePerlControlPositions = Object.freeze([0, 7]);

/**
 * Load the coupled manifest, installation receipt, trace and installed-file records of one role.
 *
 * @param get - Parsed JSON reader of selection-relative records.
 * @param prefix - `<configuration>/<delivery>/` record prefix.
 * @param role - Runtime or component distribution.
 */
export const nominalPrimitiveSubtypePerlPackageContext = (get, prefix, role) => {
	assert.ok(["runtime", "component"].includes(role));
	const manifest = get(prefix + `${role}-manifest.json`), installation = get(prefix + `${role}-install-receipt.json`);
	const trace = get(prefix + `${role}-trace.json`), installed = get(prefix + "installed-files.json");
	const suffix = `${manifest.module.replaceAll("::", "/")}/install-receipt.json`;
	const receiptPath = Object.keys(installed).find(path => path.endsWith("/" + suffix));
	assert.ok(receiptPath, `${prefix}${role}: installed receipt path`);
	return { prefix, role, manifest, installation, trace, installed, receiptPath, base: receiptPath.slice(0, -suffix.length), altered: new Map() };
};

/**
 * Coupled package mutations whose hashes are re-signed; the semantic checker must still reject each.
 * The floor control is bound to the selected floor so that it can never be a no-op at any hosted floor.
 *
 * @param delivery - Prebuilt-only or build-xs installation of the mutated position.
 * @param floor - The independently selected glibc floor of the selection.
 */
export const nominalPrimitiveSubtypePerlPackageMutations = (delivery, floor) => {
	assert.ok(["prebuilt-only", "build-xs"].includes(delivery)); assert.match(floor, /^2\.[0-9]+$/u);
	const generated = extension => [`changed generated ${extension}`, context => {
		const path = context.prefix + `${context.role}-${extension === "xs" ? "source.xs" : "public.pm"}`;
		const bytes = Buffer.concat([context.altered.get(path), Buffer.from("\n# changed generated API\n")]);
		context.altered.set(path, bytes);
		const relative = context.manifest.module.replaceAll("::", "/");
		const member = extension === "xs" ? context.manifest.xs : `lib/${relative}.pm`;
		context.manifest.files[member] = sha256(bytes);
		if(extension === "xs" && delivery === "build-xs") context.installation.sourceSha256 = sha256(bytes);
		if(extension === "pm")
		{
			context.trace.files.find(file => file.path === `${relative}.pm`).sha256 = sha256(bytes);
			context.installed[context.base + relative + ".pm"] = { bytes: bytes.length, sha256: sha256(bytes) };
		}
	}];
	return [
		["wrong glibc floor", context => {
			assert.equal(context.manifest.glibcMinimumVersion, floor, "the retained manifest floor must be the selected floor");
			context.manifest.glibcMinimumVersion = "2.37";
		}]
		, ["dropped prebuilt variant", context => { assert.ok(context.manifest.prebuilt.length > 0); context.manifest.prebuilt.pop(); }]
		, ["wrong ABI api_version", context => { assert.notEqual(context.installation.abi.api_version, "34"); context.installation.abi.api_version = "34"; }]
		, ["rebuilt operation", context => {
			assert.notEqual(context.installation.operation, "rebuilt-lean");
			context.installation.operation = "rebuilt-lean"; context.trace.operation = "rebuilt-lean";
		}]
		, ["changed native payload", context => { assert.equal(context.trace.nativePayloadUnchanged, true); context.trace.nativePayloadUnchanged = false; }]
		, ["dropped traced file", context => { assert.ok(context.trace.files.length > 1); context.trace.files.pop(); }]
		, ["traversing traced path", context => { context.trace.files[0].path = "../outside"; }]
		, ["traversing installed path", context => { context.installed["../outside"] = { bytes: 1, sha256: "0".repeat(64) }; }]
		, generated("xs"), generated("pm")
		, ...delivery === "build-xs" ? [
			["Lean as the XS compiler", context => { context.installation.commands[0][0] = "/usr/bin/lean"; }]
			, ["extra compiled source", context => { context.installation.commands[0].push("arbitrary.c"); }]
			, ["wrong XS source digest", context => { context.installation.sourceSha256 = "0".repeat(64); }]
		] : [["wrong prebuilt output digest", context => { context.installation.outputSha256 = "0".repeat(64); }]]
	];
};

/**
 * Apply one package mutation to fresh records, re-sign every coupled hash and require a byte change.
 *
 * @param originals - Immutable original record bytes, relative to one selection.
 * @param prefix - `<configuration>/<delivery>/` record prefix.
 * @param role - Runtime or component distribution.
 * @param position - Index of the installation inside the top-level report.
 * @param mutate - Mutation of the coupled context.
 */
export const applyNominalPrimitiveSubtypePerlPackageMutation = (originals, prefix, role, position, mutate) => {
	const get = path => {
		const bytes = originals.get(path); assert.ok(Buffer.isBuffer(bytes), `missing original: ${path}`); return JSON.parse(bytes);
	};
	const context = nominalPrimitiveSubtypePerlPackageContext(get, prefix, role);
	for(const path of [prefix + `${role}-source.xs`, prefix + `${role}-public.pm`])
	{ assert.ok(Buffer.isBuffer(originals.get(path)), path); context.altered.set(path, originals.get(path)); }
	const observation = get("report.json"), current = observation.reports[position];
	assert.equal(`${current.configuration}/${current.delivery}/`, prefix);
	mutate(context);
	const set = (path, value) => context.altered.set(path, Buffer.from(canonicalJson(value)));
	set(prefix + `${role}-manifest.json`, context.manifest);
	// The installer wrote the receipt itself; keep its exact bytes unless the mutation changed it.
	const receiptRecord = prefix + `${role}-install-receipt.json`, originalReceipt = originals.get(receiptRecord);
	const bytes = canonicalJson(context.installation) === canonicalJson(JSON.parse(originalReceipt)) ? originalReceipt : Buffer.from(canonicalJson(context.installation));
	context.altered.set(receiptRecord, bytes);
	set(prefix + `${role}-trace.json`, context.trace);
	context.installed[context.receiptPath] = { bytes: bytes.length, sha256: sha256(bytes) };
	set(prefix + "installed-files.json", context.installed);
	current.installedFilesSha256 = sha256(context.altered.get(prefix + "installed-files.json"));
	const trace = current.traces.find(value => value.role === role);
	trace.manifestSha256 = sha256(context.altered.get(prefix + `${role}-manifest.json`));
	trace.receiptSha256 = sha256(bytes); trace.traceSha256 = sha256(context.altered.get(prefix + `${role}-trace.json`));
	set(prefix + "report.json", current); set("report.json", observation);
	const changed = [...context.altered].filter(([path, value]) => {
		const original = originals.get(path); assert.ok(Buffer.isBuffer(original), `missing original: ${path}`);
		return !value.equals(original);
	});
	assert.ok(changed.length > 0, "a package mutation must change at least one record");
	return context.altered;
};

/**
 * Archive and receipt mutations, each proven to change the bytes it replaces.
 *
 * @param receipt - Package-set receipt naming both archives.
 * @param originals - Immutable original record bytes, relative to one selection.
 */
export const nominalPrimitiveSubtypePerlHandoffMutations = (receipt, originals) => {
	const handoffReceipt = "handoff/package-set-receipt.json", archives = receipt.packages.map(pkg => "handoff/" + pkg.artifacts[0].path);
	assert.equal(archives.length, 2); assert.notEqual(archives[0], archives[1]);
	const original = path => { const bytes = originals.get(path); assert.ok(Buffer.isBuffer(bytes), `missing original: ${path}`); return bytes; };
	const mutations = [
		["noncanonical receipt", new Map([[handoffReceipt, Buffer.concat([original(handoffReceipt), Buffer.from(" ")])]])]
		, ["changed receipt digest sidecar", new Map([[handoffReceipt + ".sha256", Buffer.from(`${"0".repeat(64)}  package-set-receipt.json\n`)]])]
		, ["truncated archive", new Map([[archives[0], original(archives[0]).subarray(0, -1)]])]
		, ["swapped archives", new Map([[archives[0], original(archives[1])], [archives[1], original(archives[0])]])]
	];
	for(const [label, changes] of mutations) for(const [path, bytes] of changes)
		assert.ok(!bytes.equals(original(path)), `${label}: ${path} must change`);
	return mutations;
};

/**
 * Apply one compiler-decision mutation to a copy of the model and require a byte change.
 *
 * @param model - Original reproduced compiler model.
 * @param mutate - Mutation of the model copy.
 */
export const applyNominalPrimitiveSubtypePerlModelMutation = (model, mutate) => {
	const mutated = structuredClone(model); mutate(mutated);
	assert.notEqual(canonicalJson(mutated), canonicalJson(model), "a model mutation must change the model");
	return mutated;
};

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
	for(const path of paths)
	{
		const corrupted = Buffer.concat([originals.get(path), Buffer.from("corrupted")]);
		assert.ok(!corrupted.equals(originals.get(path)));
		for(const replacement of [null, corrupted])
		{ await rejects(new Map([[path, replacement]]), path); recordControls++; }
	}
	const report = json("report.json");
	for(const position of nominalPrimitiveSubtypePerlControlPositions) for(const role of ["runtime", "component"])
	{
		const item = report.reports[position], prefix = `${item.configuration}/${item.delivery}/`;
		for(const [label, mutate] of nominalPrimitiveSubtypePerlPackageMutations(item.delivery, options.floor))
		{
			const altered = applyNominalPrimitiveSubtypePerlPackageMutation(originals, prefix, role, position, mutate);
			await rejects(altered, `${prefix}${role}: ${label}`); packageControls++;
		}
	}
	for(const [label, changes] of nominalPrimitiveSubtypePerlHandoffMutations(receipt, originals))
	{ await rejects(changes, label); handoffControls++; }
	for(const [label, mutate] of nominalPrimitiveSubtypePerlModelMutations(options.mode))
	{
		const changes = new Map(), top = json("report.json");
		const bytes = Buffer.from(canonicalJson(applyNominalPrimitiveSubtypePerlModelMutation(json("build-0/model.json"), mutate)));
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
		, ["wrong native word width", model => { assert.equal(model.pointerBits, 64); model.pointerBits = 32; }]
		, ["changed Perl module", model => {
			assert.equal(model.moduleName, "LeanBridge::NominalPrimitiveSubtypes"); model.moduleName = "LeanBridge::NominalSubtypes";
		}]
		, ["changed output Fin bound", model => {
			const tree = output(model); assert.equal(tree.fields.at(-1), "digit");
			assert.equal(tree.arguments.at(-1).bound, "3"); tree.arguments.at(-1).bound = "4";
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
