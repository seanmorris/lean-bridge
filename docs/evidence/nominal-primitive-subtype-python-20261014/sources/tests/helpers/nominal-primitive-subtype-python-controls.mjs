/**
 * Missing-record and coordinated-tamper controls for original nominal Python evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypePythonMinors } from "./nominal-primitive-subtype-python-fixture.mjs";
import { checkNominalPrimitiveSubtypePythonEnvironment } from "./nominal-primitive-subtype-python-environment-records.mjs";
import { checkNominalPrimitiveSubtypePythonModels } from "./nominal-primitive-subtype-python-model-records.mjs";
import { checkNominalPrimitiveSubtypePythonPackage } from "./nominal-primitive-subtype-python-package-records.mjs";
import { checkNominalPrimitiveSubtypePythonReport, nominalPrimitiveSubtypePythonRecords } from "./nominal-primitive-subtype-python-report.mjs";
import { nominalPrimitiveSubtypePythonReceipt } from "./nominal-primitive-subtype-python-wheel.mjs";

import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Require every original file, reject coordinated package changes and enforce pre-pip closure.
 *
 * @param originalRead - Original record reader; mutations stay in memory.
 * @param options - Independently selected route, API, producer and runtime.
 */
export const checkNominalPrimitiveSubtypePythonControls = async (originalRead, options) => {
	const accepted = await checkNominalPrimitiveSubtypePythonReport(originalRead, options);
	const wheel = JSON.parse(await originalRead("wheel.json")), paths = nominalPrimitiveSubtypePythonRecords(options.route, wheel);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`); return Buffer.from(value);
	};
	const json = path => JSON.parse(originals.get(path));
	let recordControls = 0, environmentControls = 0, packageControls = 0, modelControls = 0;
	for(const path of paths) for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
	{
		const changes = new Map([[path, replacement]]);
		await assert.rejects(checkNominalPrimitiveSubtypePythonReport(path => read(path, changes), options)); recordControls++;
	}
	for(const minor of nominalPrimitiveSubtypePythonMinors)
	{
		const report = json(`${minor}/report.json`), prefix = `lib/python${minor}/site-packages/`;
		const base = { baseline: json(`${minor}/baseline.json`)
			, installed: json(`${minor}/environment.json`)
			, pip: json(`${minor}/pip.json`)
			, pipMetadata: json(`${minor}/pip-metadata.json`)
			, interpreter: report.interpreter, artifact: wheel.archive };
		const metadata = prefix + "nominalprimitivesubtypes-1.0.0.dist-info/";
		const metadataMutation = (value, name, text) => {
			value.pipMetadata[metadata + name] = text;
			value.installed.entries[metadata + name] = { kind: "file", ...identity(text) };
		};
		const mutations = [
			value => { value.installed.entries[prefix + "sitecustomize.py"] = { kind: "file", ...identity("print('injected')") }; }
			, value => { value.installed.entries[prefix + "injected.pth"] = { kind: "file", ...identity("import injected\n") }; }
			, value => { value.installed.entries[prefix + "lean_nominalprimitivesubtypes/extra.py"] = { kind: "file", ...identity("injected") }; }
			, value => { value.installed.entries[prefix + "lean_nominalprimitivesubtypes/__init__.py"].sha256 = "0".repeat(64); }
			, value => { delete value.installed.entries[prefix + "lean_nominalprimitivesubtypes/__init__.pyi"]; }
			, value => { value.installed.entries[prefix + "lean_nominalprimitivesubtypes/_native.py"] = { kind: "symlink", target: "/tmp/forged.py" }; }
			, value => { value.baseline.expectedSha256 = "0".repeat(64); }
			, value => { value.installed.python = "3.13.0"; }
			, value => { value.interpreter.identity.implementation = "pypy"; }
			, value => { value.interpreter.identity.pointerBits = 32; }
			, value => { value.pip.arguments = value.pip.arguments.filter(arg => arg !== "--no-index"); }
			, value => { value.pip.arguments = value.pip.arguments.filter(arg => arg !== "--no-compile"); }
			, value => { value.pip.arguments[0] = "-S"; }
			, value => { value.pip.environment.PATH = "/usr/bin"; }
			, value => { value.pip.run.code = 1; }
			, value => { value.pip.run.stdout = "Installing collected packages\n"; }
			, value => { metadataMutation(value, "INSTALLER", "forged\n"); }
			, value => { metadataMutation(value, "REQUESTED", "forged\n"); }
			, value => { const direct = JSON.parse(value.pipMetadata[metadata + "direct_url.json"]); direct.url = "https://untrusted.invalid/wheel.whl"; metadataMutation(value, "direct_url.json", JSON.stringify(direct)); }
			, value => { const direct = JSON.parse(value.pipMetadata[metadata + "direct_url.json"]); direct.archive_info.hashes.sha256 = "0".repeat(64); metadataMutation(value, "direct_url.json", JSON.stringify(direct)); }
			, value => { metadataMutation(value, "RECORD", value.pipMetadata[metadata + "RECORD"] + "extra.py,,\n"); }
			, value => { metadataMutation(value, "RECORD", value.pipMetadata[metadata + "RECORD"].replace("sha256=", "sha512=")); }
		];
		for(const mutate of mutations)
		{
			const changed = structuredClone(base); mutate(changed);
			// Updating the post-install digest must not authorize new executable inputs.
			changed.installed.expectedSha256 = sha256(canonicalJson(changed.installed.entries));
			assert.throws(() => checkNominalPrimitiveSubtypePythonEnvironment({ ...changed, receiptBytes: originals.get(`package/${nominalPrimitiveSubtypePythonReceipt}`) })); environmentControls++;
		}
	}
	const recordPath = "nominalprimitivesubtypes-1.0.0.dist-info/RECORD";
	for(const target of ["lean_nominalprimitivesubtypes/__init__.py", "lean_nominalprimitivesubtypes/__init__.pyi", "lean_nominalprimitivesubtypes/_native.py", "lean_nominalprimitivesubtypes/extra.py"])
	{
		const changed = structuredClone(wheel), receipt = json(`package/${nominalPrimitiveSubtypePythonReceipt}`);
		const changes = new Map(), bytes = Buffer.concat([originals.get(`package/${target}`) ?? Buffer.alloc(0), Buffer.from("\n# coordinated source replacement\n")]);
		changes.set(`package/${target}`, bytes); receipt.files[target] = identity(bytes); changed.files[target] = identity(bytes);
		if(!changed.retained.includes(target)) changed.retained.push(target);
		changed.retained.sort();
		const receiptBytes = Buffer.from(canonicalJson(receipt)); changes.set(`package/${nominalPrimitiveSubtypePythonReceipt}`, receiptBytes);
		changed.files[nominalPrimitiveSubtypePythonReceipt] = identity(receiptBytes); changed.receiptSha256 = sha256(receiptBytes);
		const lines = Object.keys(changed.files).filter(path => path !== recordPath).sort().map(path => `${path},sha256=${Buffer.from(changed.files[path].sha256, "hex").toString("base64url")},${changed.files[path].bytes}`);
		const recordBytes = Buffer.from([...lines, `${recordPath},,`, ""].join("\n"));
		changes.set(`package/${recordPath}`, recordBytes); changed.files[recordPath] = identity(recordBytes);
		changes.set("wheel.json", Buffer.from(canonicalJson(changed)));
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkNominalPrimitiveSubtypePythonPackage({
			read: mutatedRead, json: async path => JSON.parse(await mutatedRead(path))
			, model: json("build-0/model.json")
			, receipt: json("build-0/package-set-receipt.json")
			, producerCommit: options.producerCommit, floor: options.floor }));
		packageControls++;
	}
	const modelMutations = nominalPrimitiveSubtypePythonModelMutations(options.mode);
	for(const [label, mutate] of modelMutations)
	{
		const changes = new Map(), model = json("build-0/model.json"), report = json("report.json"); mutate(model);
		const bytes = Buffer.from(canonicalJson(model));
		for(const attempt of [0, 1])
		{ changes.set(`build-${attempt}/model.json`, bytes); report.builds[attempt].modelSha256 = sha256(bytes); }
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkNominalPrimitiveSubtypePythonModels({ ...options, report
			, read: mutatedRead
			, json: async path => JSON.parse(await mutatedRead(path)) }), assert.AssertionError, label);
		modelControls++;
	}
	return { ...accepted, recordControls, environmentControls, packageControls, modelControls };
};

/**
 * Select wrong compiler facts and every primitive constructor identity explicitly.
 *
 * @param mode - Full or constructor-free result-only API.
 */
export const nominalPrimitiveSubtypePythonModelMutations = mode => {
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
