/**
 * Authenticate both PHP author routes; refuse incomplete or altered acceptance claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkStructuralSubtypePhpReport, structuralSubtypePhpRecords } from "./structural-subtype-php-report.mjs";
import { generateCopiedPhpPackage } from "../../src/backends/php/copied-values.mjs";
import { structuralSubtypePhpGenerators } from "./structural-subtype-php-generators.mjs";

const root = "docs/evidence/structural-subtype-php-20261011";
const indexSha256 = "a745724cce2e53f0064c352d346d42ce2413221aa4406c22e4bfa067b0aa05cd";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "structural-subtype-php-installed-v1");
	assert.deepEqual(index.runs.map(run => run.route), ["ordinary", "reviewed"]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes("..")); assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};

test("structural PHP originals authenticate both installed and relocated selections", async () => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	for(const source of index.selectedSources)
		assert.deepEqual(files.get(`sources/${source}`), execFileSync("git", ["show", `${index.producerCommit}:${source}`], { maxBuffer: 16 * 1024 * 1024 }));
	for(const run of index.runs)
	{
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.revision, run.producerCommit); assert.equal(start.route, run.route);
		assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
		assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
		assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
		assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
		for(const path of structuralSubtypePhpRecords) assert.ok(files.has(`${run.label}/records/${path}`));
		const read = async path => files.get(`${run.label}/records/${path}`), checked = await checkStructuralSubtypePhpReport(read, run);
		assert.deepEqual(checked, Object.fromEntries(Object.entries(run).filter(([key]) => !["label", "tapSha256", "reportSha256"].includes(key))));
		assert.equal(run.reportSha256, sha256(await read("report.json")));
	}
});

test("structural PHP replay keeps original result documentation and rejects substituted public code", async () => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	const original = await structuralSubtypePhpGenerators(index.producerCommit);
	assert.equal(await structuralSubtypePhpGenerators(index.producerCommit), original);
	assert.throws(() => structuralSubtypePhpGenerators("HEAD"));
	for(const run of index.runs)
	{
		const prefix = `${run.label}/records/`, read = async path => files.get(prefix + path);
		const model = JSON.parse(await read("build-0/model.json"));
		const api = (await read("package/src/Api.php")).toString();
		const generated = original.generateCopiedPhpPackage(model.bindingIr);
		assert.equal(generated["src/Api.php"], api);
		const current = generateCopiedPhpPackage(model.bindingIr)["src/Api.php"];
		assert.notEqual(current, api);
		assert.match(api, /result\[\*\] checked by StructuralSubtypes.checkedPositive/u);
		assert.match(current, /result\[\*\] projects the Subtype base value/u);
		for(const replacement of [current
			, api.replace("return Internal\\Native::call0", "return Internal\\Native::call1")
			, api.replace("StructuralSubtypes.checkedPositive", "StructuralSubtypes.wrongConstructor")]) {
			assert.notEqual(replacement, api);
			const manifest = JSON.parse(await read("package/binding-manifest.json"));
			manifest.filesSha256["src/Api.php"] = sha256(replacement);
			await assert.rejects(checkStructuralSubtypePhpReport(async path => {
				if(path === "package/src/Api.php") return Buffer.from(replacement);
				if(path === "package/binding-manifest.json") return Buffer.from(canonicalJson(manifest));
				return read(path);
			}, run), /Public API must match its recorded producer/u);
			}
	}
});

test("structural PHP archive rejects every missing and corrupted original", async t => {
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


test("PHP structural reports reject missing modes, false isolation and coordinated Composer changes", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = `${run.label}/records/`;
		const originals = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const changes = [
			report => { report.independentBuilds = 1; }
			, ...["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"].map(key => report => { report[key] = false; })
			, report => { report.php = "8.1.0"; }
			, report => { report.installation.name = "another/package"; }
			, report => { report.observations.pop(); }
			, report => { report.observations[2].relocated = false; }
			, report => { report.observations[0].mode = "strict"; }
			, report => { report.observations[3].mode = "weak"; }
			, report => { report.observations[0].run.code = 1; }
			, report => { report.observations[1].run.stderr = "warning"; }
			, report => { report.observations[1].closure.toolsSha256 = "0".repeat(64); }
			, report => { report.dispatch.observed = true; }
			, report => { report.installation.inputs["consumer.php"].sha256 = "0".repeat(64); }
			, report => { report.installation.receiptBytes += "\\n"; }
			, report => { report.builds[1].modelSha256 = "0".repeat(64); }
			, report => { report.installation.runtimeFlags[0] = "-c"; }
			, report => { report.installation.runtimeFlags.push("-d", "auto_prepend_file=extra.php"); }
			, report => { delete report.installation.tools[report.installation.command]; }
			, ...["checks", "rejections", "snapshotControls"].map(key => report => {
				for(const observation of report.observations)
				{ observation.counts[key] = 0; observation.run.stdout = JSON.stringify(observation.counts) + "\n"; }
			})
			, ...["missing-public", "changed-dependency", "extra-autoloader", "changed-archive", "missing-generated"].map(mutation => report => {
				const environment = report.installation;
				if(mutation === "missing-public") delete environment.vendorFiles[`${environment.name}/src/Api.php`];
				if(mutation === "changed-dependency") environment.dependencyFiles["composer.json"].sha256 = "0".repeat(64);
				if(mutation === "extra-autoloader") environment.vendorFiles["evil/plugin.php"] = { bytes: 1, sha256: "0".repeat(64) };
				if(mutation === "changed-archive") environment.feedFiles["component.zip"].sha256 = "0".repeat(64);
				if(mutation === "missing-generated") delete environment.generatedFiles["vendor/composer/autoload_files.php"];
				for(const observation of report.observations)
					for(const key of ["vendorFiles", "generatedFiles", "dependencyFiles"])
						observation.closure[key + "Sha256"] = sha256(canonicalJson(environment[key]));
			})
		];
		const storeReport = (altered, report) => {
			altered.set("report.json", Buffer.from(canonicalJson(report)));
			for(const [position, observation] of report.observations.entries())
			{
				const place = position < 2 ? "installed" : "relocated", mode = position % 2 ? "strict" : "weak";
				altered.set(`${place}-${mode}.json`, Buffer.from(canonicalJson(observation)));
			}
		};
		for(const change of changes)
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			change(report); storeReport(altered, report);
			await assert.rejects(checkStructuralSubtypePhpReport(async path => altered.get(path), run)); controls++;
		}
		for(const mutation of ["extra-plugin", "changed-version", "extra-repository", "changed-autoload"])
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			const composerPath = "installation/composer.json", composer = JSON.parse(altered.get(composerPath));
			const lockPath = "installation/composer.lock", lock = JSON.parse(altered.get(lockPath));
			const installedPath = "installation/vendor/composer/installed.json", installed = JSON.parse(altered.get(installedPath));
			if(mutation === "extra-plugin") composer.config["allow-plugins"] = true;
			if(mutation === "extra-repository") composer.repositories.push({ type: "composer", url: "https://example.invalid" });
			if(mutation === "changed-version" || mutation === "changed-autoload")
			{
				const key = mutation === "changed-version" ? "version" : "autoload";
				const value = mutation === "changed-version" ? "99.0.0" : { files: ["evil.php"] };
				composer.repositories[1].package[key] = value;
				for(const entries of [lock.packages, installed.packages]) entries.find(pkg => pkg.name === "brick/math")[key] = value;
			}
			for(const [path, value] of [[composerPath, composer], [lockPath, lock], [installedPath, installed]])
			{
				const bytes = Buffer.from(canonicalJson(value)); altered.set(path, bytes);
				const relative = path.slice("installation/".length);
				const entry = { bytes: bytes.length, sha256: sha256(bytes) };
				if(relative === "composer.json") report.installation.inputs[relative] = entry;
				else report.installation.generatedFiles[relative] = entry;
				if(relative.startsWith("vendor/")) report.installation.vendorFiles[relative.slice(7)] = entry;
			}
			for(const observation of report.observations)
				for(const key of ["generatedFiles", "vendorFiles"]) observation.closure[key + "Sha256"] = sha256(canonicalJson(report.installation[key]));
			storeReport(altered, report);
			await assert.rejects(checkStructuralSubtypePhpReport(async path => altered.get(path), run)); controls++;
		}
		const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
		for(const position of [0, 1])
		{
			const path = `build-${position}/model.json`, model = JSON.parse(altered.get(path));
			model.exports.find(item => item.name.endsWith(".arrays")).refinements.parameters[0].arguments[0].constructor = "StructuralSubtypes.normalizePositive";
			const bytes = Buffer.from(canonicalJson(model)); altered.set(path, bytes); report.builds[position].modelSha256 = sha256(bytes);
		}
		storeReport(altered, report);
		await assert.rejects(checkStructuralSubtypePhpReport(async path => altered.get(path), run)); controls++;
	}
	t.diagnostic(`${controls} coordinated report/contract controls`);
});
