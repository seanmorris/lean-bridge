/**
 * Authenticate installed structural PHP-Wasm originals and reject substituted evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkStructuralSubtypePhpWasmReport, structuralSubtypePhpWasmRecords } from "./structural-subtype-php-wasm-report.mjs";
import { phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";
import { copiedPhpPublicSource } from "../../src/backends/php/copied-values.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { structuralSubtypePhpGenerators } from "./structural-subtype-php-generators.mjs";

const root = "docs/evidence/structural-subtype-php-wasm-20261011";
const indexSha256 = "da25a7fe6aae70c6f5c23713f7e65e0195fdccb59e5d7b27672007afaa825c5c";
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "structural-subtype-php-wasm-installed-v1");
	assert.deepEqual(index.runs.map(run => run.route), ["ordinary", "reviewed"]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes("..")); assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.deepEqual(identity(value), { bytes: file.bytes, sha256: file.sha256 });
		files.set(file.path, value);
	}
	return { index, files };
};
const routeRecords = (files, run) => {
	const prefix = `${run.label}/records/`;
	return new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
};
const readRecords = records => async path => {
	assert.ok(records.has(path), "Missing original " + path); return records.get(path);
};
const save = (records, path, value) => records.set(path, Buffer.from(canonicalJson(value)));
const load = (records, path) => JSON.parse(records.get(path));
const mirror = (records, report) => {
	save(records, "report.json", report);
	for(const [index, execution] of report.phpWasm.executions.entries()) save(records, `executions/${index}.json`, execution);
};
const deploymentRecord = (records, report, path, bytes) => {
	records.set("deployment/" + path, bytes); report.phpWasm.deployment[path] = identity(bytes);
};

test("structural PHP-Wasm archive authenticates both author routes and all twelve installed contexts", async () => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	for(const source of index.selectedSources)
		assert.deepEqual(files.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	for(const run of index.runs)
	{
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`), runtime = files.get(`${run.label}/runtime.json`);
		assert.equal(start.revision, run.producerCommit); assert.equal(start.route, run.route);
		assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
		assert.equal(start.runtimeSha256, sha256(runtime));
		assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
		assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
		assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_WASM_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PHP_WASM_ROUTES, run.route);
		assert.deepEqual(start.args.slice(3), ["--test", "--test-concurrency=1", "tests/helpers/structural-subtype-php-wasm-installed-tests.mjs"]);
		assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
		assert.match(tap.toString(), new RegExp(`^ok 1 - installed structural Subtypes PHP-Wasm ${run.route} reproduce and relocate$`, "mu"));
		assert.doesNotMatch(tap.toString(), /^not ok |# (?:SKIP|TODO)\b/mu);
		const records = routeRecords(files, run);
		assert.deepEqual([...records.keys()].sort(), structuralSubtypePhpWasmRecords(run.route).sort());
		const checked = await checkStructuralSubtypePhpWasmReport(readRecords(records), run);
		assert.deepEqual(checked, Object.fromEntries(Object.entries(run).filter(([key]) => !["label", "tapSha256", "reportSha256"].includes(key))));
		assert.equal(run.reportSha256, sha256(records.get("report.json")));
		assert.deepEqual(load(records, "report.json").phpWasm.runtime, JSON.parse(runtime));
	}
});

test("structural PHP-Wasm public API identities replay the recorded producer, not today's result comments", async () => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	const original = await structuralSubtypePhpGenerators(index.producerCommit);
	for(const run of index.runs)
	{
		const records = routeRecords(files, run), model = load(records, "build-0/model.json");
		const options = { integerBits: 32, structuredCallables: true, lists: true, variants: true };
		const generated = original.copiedPhpPublicSource(original.compileCopiedPhpModel(model.bindingIr, options));
		const current = copiedPhpPublicSource(compileCopiedPhpModel(model.bindingIr, options));
		assert.notEqual(generated, current);
		assert.match(generated, /result\[\*\] checked by StructuralSubtypes.checkedPositive/u);
		assert.match(current, /result\[\*\] projects the Subtype base value/u);
		const deployment = load(records, "report.json").phpWasm.deployment;
		const apis = Object.entries(deployment).filter(([path]) => path.endsWith("/src/Api.php"));
		assert.equal(apis.length, 2);
		for(const [, recorded] of apis)
		{
			assert.deepEqual(recorded, identity(Buffer.from(generated)));
			assert.notDeepEqual(recorded, identity(Buffer.from(current)));
		}
	}
});

test("structural PHP-Wasm archive rejects every missing and corrupted original", async t => {
	const { files } = await checkArchive(path => readFile(`${root}/${path}`));
	files.set("index.json", await readFile(`${root}/index.json`));
	for(const target of files.keys())
	{
		await assert.rejects(checkArchive(async path => {
			if(path === target) throw new Error("missing original");
			return files.get(path);
		}));
		await assert.rejects(checkArchive(async path => path === target ? Buffer.concat([files.get(path), Buffer.from("changed")]) : files.get(path)));
	}
	t.diagnostic(`${2 * files.size} missing/corrupted original controls`);
});

test("structural PHP-Wasm report requires all original records independently of the archive index", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`)); let controls = 0;
	for(const run of index.runs)
	{
		const originals = routeRecords(files, run);
		for(const path of structuralSubtypePhpWasmRecords(run.route))
		{
			const records = new Map(originals); records.delete(path);
			await assert.rejects(checkStructuralSubtypePhpWasmReport(readRecords(records), run), undefined, path); controls++;
		}
	}
	t.diagnostic(`${controls} missing required record controls`);
});

test("structural PHP-Wasm reports reject coordinated contract, caller, package and execution substitutions", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`)); let controls = 0;
	for(const run of index.runs)
	{
		const originals = routeRecords(files, run), baseline = load(originals, "report.json");
		const refuse = async mutate => {
			const records = new Map(originals), report = structuredClone(baseline);
			mutate(records, report); mirror(records, report);
			assert.ok([...records].some(([path, bytes]) => !bytes.equals(originals.get(path))), "Negative control must change evidence");
			await assert.rejects(checkStructuralSubtypePhpWasmReport(readRecords(records), run)); controls++;
		};
		for(const mutate of [
			report => { report.independentBuilds = 1; }
			, report => { report.route = "invented"; }
			, report => { report.producerCommit = "0".repeat(40); }
			, report => { report.expectedBindingIrSha256 = "0".repeat(64); }
			, report => { report.dispatch.observed = true; }
			, report => { report.builds[1].receiptSha256 = "0".repeat(64); }
			, ...["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"].map(key => report => { report[key] = false; })
			, ...phpWasmIsolationFlags.map(key => report => { report.phpWasm[key] = false; })
			, report => { report.phpWasm.runtime.pointerBits = 64; }
			, report => { report.phpWasm.runtime.pins.phpVersion = "8.3.0"; }
			, report => { report.phpWasm.component.compiler.emsdkCommit = "0".repeat(40); }
			, report => { report.phpWasm.host.version = "9.9.9"; }
			, report => { report.phpWasm.executions.pop(); }
			, report => { report.phpWasm.executions[1] = report.phpWasm.executions[0]; }
			, report => { report.phpWasm.packageSet.archives[0].sha256 = "0".repeat(64); }
		]) await refuse((_records, report) => mutate(report));
		for(const position of baseline.phpWasm.executions.keys())
			for(const mutate of [
				row => { row.mode = "invented"; }
				, row => { row.observation.checks--; }
				, row => { row.observation.rejections--; }
				, row => { row.observation.snapshotControls--; }
				, row => { row.observation.word_bits = 64; }
				, row => { row.phases.pop(); }
				, row => { row.phases[3].libraries.pop(); }
			]) await refuse((_records, report) => mutate(report.phpWasm.executions[position]));
		for(const position of baseline.phpWasm.executions.keys())
		{
			if(baseline.phpWasm.executions[position].realm !== "chromium") continue;
			for(const mutate of [
				row => { row.requests = []; }
				, row => { row.requests[0].sha256 = "0".repeat(64); }
				, row => { row.requests = row.requests.filter(request => !request.path.endsWith(".so")); }
			]) await refuse((_records, report) => mutate(report.phpWasm.executions[position]));
		}
		for(const mode of ["weak", "strict"])
			await refuse((records, report) => {
				const bytes = Buffer.from("<?php echo 'forged counts';\n");
				records.set(mode + ".php", bytes); deploymentRecord(records, report, mode + ".php", bytes);
				report.phpWasm.consumerSources[mode] = sha256(bytes);
			});
		for(const arrangement of ["embedded", "composer"])
			await refuse((records, report) => {
				const path = `request-${arrangement}.json`, bytes = Buffer.from('{"module":"WrongModule"}\n');
				records.set(path, bytes); deploymentRecord(records, report, path, bytes); report.phpWasm.requests[arrangement] = sha256(bytes);
			});
		for(const path of ["driver.mjs", "node.mjs", "browser.mjs"])
			await refuse((records, report) => deploymentRecord(records, report, path, Buffer.from("export default 'mock';\n")));
		for(const mutate of [
			model => { model.pointerBits = 64; }
			, model => { model.sourceIdentity.request.contracts = {}; }
			, model => { model.sourceIdentity.request.specializations = {}; }
			, model => { model.exports.find(item => item.name.endsWith(".arrays")).refinements.parameters[0].arguments[0].constructor = "StructuralSubtypes.normalizePositive"; }
			, model => { model.exports.find(item => item.name.endsWith(".nested")).refinements.parameters[0].arguments[0].arguments[0].arguments[0].arguments[1].bound = "3"; }
		]) await refuse((records, report) => {
			for(const position of [0, 1])
			{
				const path = `build-${position}/model.json`, model = load(records, path);
				mutate(model); save(records, path, model); report.builds[position].modelSha256 = sha256(records.get(path));
			}
		});
		for(const mutate of [configuration => { configuration.modules = []; }, configuration => { configuration.targets["php-wasm"].npm.version = "99.0.0"; }])
			await refuse((records, report) => { mutate(report.configuration); save(records, "configuration.json", report.configuration); });
		for(const mutation of ["npm-version", "composer-plugins", "brick-version", "brick-autoload"])
			await refuse((records, report) => {
				const evidence = report.phpWasm;
				if(mutation === "npm-version")
				{
					evidence.npm.lock.packages["node_modules/lean-bridge-structuralsubtypes-wasm"].version = "99.0.0";
					evidence.npm.lockText = canonicalJson(evidence.npm.lock); evidence.npm.lockSha256 = sha256(evidence.npm.lockText);
					deploymentRecord(records, report, "package-lock.json", Buffer.from(evidence.npm.lockText));
				}
				else
				{
					const composer = evidence.composer;
					if(mutation === "composer-plugins") composer.manifest.config["allow-plugins"] = true;
					else
					{
						const key = mutation === "brick-version" ? "version" : "autoload", value = mutation === "brick-version" ? "99.0.0" : { files: ["forged.php"] };
						composer.manifest.repositories[1].package[key] = value;
						for(const list of [composer.lock.packages, composer.installed.packages]) list.find(pkg => pkg.name === "brick/math")[key] = value;
					}
					composer.manifestSha256 = sha256(canonicalJson(composer.manifest));
					deploymentRecord(records, report, "composer.json", Buffer.from(canonicalJson(composer.manifest)));
					for(const [key, path] of [["lock", "composer.lock"], ["installed", "vendor/composer/installed.json"]])
					{
						composer[key + "Text"] = canonicalJson(composer[key]); composer[key + "Sha256"] = sha256(composer[key + "Text"]);
						deploymentRecord(records, report, path, Buffer.from(composer[key + "Text"]));
					}
				}
			});
	}
	t.diagnostic(`${controls} coordinated semantic controls`);
});
