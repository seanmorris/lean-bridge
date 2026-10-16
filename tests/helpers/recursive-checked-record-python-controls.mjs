/**
 * Missing-record and coordinated-tamper controls for original recursive Python evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { recursiveCheckedRecordPythonPackage } from "./recursive-checked-record-python-fixture.mjs";
import { recursiveCheckedRecordPythonInstalls } from "./recursive-checked-record-python-install.mjs";
import { recursiveCheckedRecordPythonModelMutations } from "./recursive-checked-record-python-model-records.mjs";
import {
	checkRecursiveCheckedRecordPythonReport, recursiveCheckedRecordPythonRecords
} from "./recursive-checked-record-python-report.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Require every original file and reject coordinated changes to every independent check.
 *
 * @param originalRead - Original record reader; mutations stay in memory.
 * @param options - Independently selected route, module, producer and runtime.
 */
export const checkRecursiveCheckedRecordPythonControls = async (originalRead, options) => {
	const accepted = await checkRecursiveCheckedRecordPythonReport(originalRead, options);
	const wheel = JSON.parse(await originalRead("wheel.json"));
	const paths = recursiveCheckedRecordPythonRecords(options.route, options.fixture, wheel);
	const originals = new Map();
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const json = path => JSON.parse(originals.get(path));
	const rejects = async (changes, label) => {
		const read = async path => {
			const value = changes.has(path) ? changes.get(path) : originals.get(path);
			assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`);
			return Buffer.from(value);
		};
		await assert.rejects(checkRecursiveCheckedRecordPythonReport(read, options), undefined, label);
	};
	const encoded = value => Buffer.from(canonicalJson(value));
	let recordControls = 0, resourceControls = 0, modelControls = 0, environmentControls = 0, packageControls = 0;

	for(const path of paths) for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
	{
		await rejects(new Map([[path, replacement]]), `${path} ${replacement ? "corrupted" : "missing"}`);
		recordControls++;
	}

	const resourceMutations = [
		value => { value[0].observations[0].freeBytes = 1024; }
		, value => { value[0].observations[0].availableBytes = 1024; }
		, value => { value[0].observations.at(-1).load = json("report.json").loadCeiling; }
		, value => { value[0].waits++; }
		, value => { value.pop(); }
	];
	for(const mutate of resourceMutations)
	{
		const report = json("report.json"), resources = json("resources.json");
		mutate(resources); report.resourceChecks = resources;
		await rejects(new Map([["resources.json", encoded(resources)], ["report.json", encoded(report)]]), "resources");
		resourceControls++;
	}
	for(const loadCeiling of [6, 10, 24])
	{
		const report = json("report.json"); report.loadCeiling = loadCeiling;
		await rejects(new Map([["report.json", encoded(report)]]), `load ceiling ${loadCeiling}`);
		resourceControls++;
	}

	for(const [label, mutate] of recursiveCheckedRecordPythonModelMutations(options.fixture))
	{
		const model = json("build-0/model.json"), report = json("report.json"); mutate(model);
		const bytes = encoded(model), changes = new Map();
		for(const attempt of [0, 1])
		{
			changes.set(`build-${attempt}/model.json`, bytes); report.builds[attempt].modelSha256 = sha256(bytes);
		}
		changes.set("report.json", encoded(report));
		await rejects(changes, label); modelControls++;
	}

	// Coordinated venv edits: every digest is updated so only the content check can refuse them.
	const { name, version } = recursiveCheckedRecordPythonPackage(options.fixture);
	for(const selection of recursiveCheckedRecordPythonInstalls)
	{
		const site = `lib/python${selection.minor}/site-packages/`, moduleDir = `${site}lean_${name}/`;
		const fileEntry = text => ({ kind: "file", ...identity(text), mode: 0o644 });
		const mutations = [
			["sitecustomize", value => { value[`${site}sitecustomize.py`] = fileEntry("print('injected')"); }]
			, ["path hook", value => { value[`${site}injected.pth`] = fileEntry("import injected\n"); }]
			, ["extra package module", value => { value[`${moduleDir}extra.py`] = fileEntry("injected"); }]
			, ["changed package module", value => { value[`${moduleDir}__init__.py`].sha256 = "0".repeat(64); }]
			, ["missing package stub", value => { delete value[`${moduleDir}__init__.pyi`]; }]
			, ["symlinked native module", value => { value[`${moduleDir}_native.py`] = { kind: "symlink", target: "/tmp/forged.py" }; }]
			, ["bytecode cache", value => { value[`${moduleDir}__pycache__/__init__.cpython.pyc`] = fileEntry("cached"); }]
			, ["retargeted interpreter", value => { value[`bin/python${selection.minor}`].target = "/usr/bin/python3"; }]
			, ["unexpected distribution", value => { value[`${site}injected-1.0.dist-info/METADATA`] = fileEntry("Name: injected\n"); }]
			, ["forged metadata", value => { value[`${site}${name}-${version}.dist-info/METADATA`].sha256 = "0".repeat(64); }]
			, ["dependency mismatch", value => {
				for(const path of Object.keys(value).filter(path => path.startsWith(`${site}typing_extensions`))) delete value[path];
				if(selection.typingVersion === null) value[`${site}typing_extensions.py`] = fileEntry("injected");
			}]
		];
		for(const [label, mutate] of mutations)
		{
			const prefix = `${selection.name}/`, inventory = json(prefix + "environment.json");
			mutate(inventory);
			const bytes = encoded(inventory), digest = sha256(bytes);
			const install = json(prefix + "report.json"), report = json("report.json");
			install.inventorySha256 = digest;
			const observations = ["installed", "relocated"].map(position => {
				const observation = json(`${prefix}${position}.json`); observation.inventorySha256 = digest;
				return [`${prefix}${position}.json`, observation];
			});
			install.observations = observations.map(([, observation]) => observation);
			report.reports = report.reports.map(item => item.selection === selection.name ? install : item);
			const changes = new Map([
				[prefix + "environment.json", bytes]
				, [prefix + "report.json", encoded(install)]
				, ["report.json", encoded(report)]
				, ...observations.map(([path, value]) => [path, encoded(value)])
			]);
			await rejects(changes, `${selection.name} ${label}`); environmentControls++;
		}
	}

	// A coordinated wheel.json and retained-text rewrite cannot replace the original archive bytes.
	for(const target of [`lean_${name}/__init__.py`, `lean_${name}/_native.py`, `lean_${name}/lean_bridge/package-receipt.json`])
	{
		const changed = structuredClone(wheel);
		const bytes = Buffer.concat([originals.get(`package/${target}`), Buffer.from("\n# coordinated replacement\n")]);
		changed.files[target] = identity(bytes);
		const changes = new Map([[`package/${target}`, bytes], ["wheel.json", encoded(changed)]]);
		if(target.endsWith("package-receipt.json"))
		{
			changed.receiptSha256 = sha256(bytes);
			const report = json("report.json"); report.wheelReceiptSha256 = changed.receiptSha256;
			changes.set("wheel.json", encoded(changed)); changes.set("report.json", encoded(report));
		}
		await rejects(changes, `coordinated ${target}`); packageControls++;
	}
	return { ...accepted, recordControls, resourceControls, modelControls, environmentControls, packageControls };
};
