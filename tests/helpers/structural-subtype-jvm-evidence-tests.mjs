/**
 * Authenticate both Jvm author routes; refuse incomplete or altered acceptance claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkStructuralSubtypeJvmReport, structuralSubtypeJvmRecords } from "./structural-subtype-jvm-report.mjs";

const root = "docs/evidence/structural-subtype-jvm-20261011";
const indexSha256 = "3efb5151e5c195ab2154a470e69a067ee1166eb0a6a879e2b6f83c700bb702c6";
const checkArchive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "structural-subtype-jvm-installed-v1");
	assert.deepEqual(index.runs.map(run => run.route), ["ordinary", "reviewed"]);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes("..")); assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};

test("structural Jvm originals authenticate both installed and relocated selections", async () => {
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
		for(const path of structuralSubtypeJvmRecords) assert.ok(files.has(`${run.label}/records/${path}`));
		const read = async path => files.get(`${run.label}/records/${path}`), checked = await checkStructuralSubtypeJvmReport(read, run);
		assert.deepEqual(checked, Object.fromEntries(Object.entries(run).filter(([key]) => !["label", "tapSha256", "reportSha256"].includes(key))));
		assert.equal(run.reportSha256, sha256(await read("report.json")));
	}
});

test("structural Jvm archive rejects every missing and corrupted original", async t => {
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

test("Jvm structural report checker rejects false isolation, host selection and coordinated counts", async t => {
	const { index, files } = await checkArchive(path => readFile(`${root}/${path}`));
	let controls = 0;
	for(const run of index.runs)
	{
		const prefix = `${run.label}/records/`;
		const originals = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const changes = [
			report => { report.independentBuilds = 1; }
			, ...["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"].map(key => report => { report[key] = false; })
			, report => { report.dispatch.observed = true; }
			, report => { report.consumers.pop(); }
			, report => { report.builds[1].modelSha256 = "0".repeat(64); }
		];
		for(const position of [0, 1])
		{
			const mutations = [
				consumer => { consumer.profile = "unselected"; }
				, consumer => { consumer.javaVersion = "openjdk 21.0.1"; }
				, ...["offlineInstall", "compilerFreePath"].map(key => consumer => { consumer.installed[key] = false; })
				, consumer => { consumer.installed.consumerSha256 = "0".repeat(64); }
				, consumer => { consumer.observations.pop(); }
				, consumer => { consumer.observations[1].relocated = false; }
				, consumer => { consumer.observations[0].run.code = 1; }
				, consumer => { consumer.observations[1].run.stderr = "warning"; }
				, consumer => { consumer.observations[1].closure.interpreterSha256 = "0".repeat(64); }
				, consumer => { consumer.installed.jvmEnvironment.receiptBytes += "\\n"; }
				, ...["checks", "rejections", "snapshotControls"].map(key => consumer => {
					for(const observation of consumer.observations)
					{
						observation.counts[key] = 0;
						observation.run.stdout = JSON.stringify(observation.counts) + "\n";
					}
					consumer.installed.result[key] = 0;
				})
				, ...["changed-jar", "missing-output", "extra-classpath", "changed-source"].map(mutation => consumer => {
					const environment = consumer.installed.jvmEnvironment;
					if(mutation === "changed-jar") environment.files["component.jar"].sha256 = "0".repeat(64);
					if(mutation === "missing-output") delete environment.files[consumer.profile === "java" ? "classes/Consumer.class" : "consumer.jar"];
					if(mutation === "extra-classpath") environment.files[consumer.profile === "java" ? "classes/Plugin.class" : "plugin.jar"] = { bytes: 1, sha256: "0".repeat(64) };
					if(mutation === "changed-source") environment.files[consumer.profile === "java" ? "consumer.java" : "consumer.kt"].sha256 = "0".repeat(64);
					for(const observation of consumer.observations) observation.closure.classpathFilesSha256 = sha256(canonicalJson(environment.files));
				})
			];
			for(const mutation of mutations) changes.push(report => mutation(report.consumers[position]));
		}
		for(const change of changes)
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			change(report); altered.set("report.json", Buffer.from(canonicalJson(report)));
			for(const consumer of report.consumers) for(const [position, observation] of consumer.observations.entries())
				altered.set(consumer.profile + "/" + (position ? "relocated" : "installed") + ".json", Buffer.from(canonicalJson(observation)));
			await assert.rejects(checkStructuralSubtypeJvmReport(async path => altered.get(path), run)); controls++;
		}
		const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
		for(const position of [0, 1])
		{
			const path = `build-${position}/model.json`, model = JSON.parse(altered.get(path));
			model.exports.find(item => item.name.endsWith(".arrays")).refinements.parameters[0].arguments[0].constructor = "StructuralSubtypes.normalizePositive";
			const bytes = Buffer.from(canonicalJson(model)); altered.set(path, bytes); report.builds[position].modelSha256 = sha256(bytes);
		}
		altered.set("report.json", Buffer.from(canonicalJson(report)));
		await assert.rejects(checkStructuralSubtypeJvmReport(async path => altered.get(path), run)); controls++;
		for(const mutation of ["missing-kotlin-api", "missing-kotlin-metadata", "changed-kotlin-version"])
		{
			const altered = new Map(originals), report = JSON.parse(altered.get("report.json"));
			const compiled = JSON.parse(altered.get("build-0/native-jvm.json"));
			const missing = mutation === "missing-kotlin-api" ? "org/leanbridge/structuralsubtypes/kotlin/Api.class"
				: "META-INF/" + compiled.kotlin.module + ".kotlin_module";
			if(mutation === "changed-kotlin-version") compiled.kotlin.standardLibraryVersion = "2.3.0";
			else delete compiled.files["classes/" + missing];
			const compiledBytes = Buffer.from(canonicalJson(compiled));
			for(const position of [0, 1]) altered.set("build-" + position + "/native-jvm.json", compiledBytes);
			for(const consumer of report.consumers)
			{
				const environment = consumer.installed.jvmEnvironment, receipt = JSON.parse(environment.receiptBytes);
				if(mutation === "changed-kotlin-version") receipt.kotlin.standardLibraryVersion = "2.3.0";
				else delete receipt.files[missing];
				receipt.compiledProjectionSha256 = sha256(compiledBytes);
				receipt.files["META-INF/lean-bridge/native-jvm.json"] = { bytes: compiledBytes.length, sha256: sha256(compiledBytes) };
				environment.receiptBytes = canonicalJson(receipt);
				environment.packageFileSetSha256 = sha256(canonicalJson([...Object.keys(receipt.files), "META-INF/lean-bridge/package-receipt.json"].sort()));
				for(const [position, observation] of consumer.observations.entries())
				{
					observation.closure.receiptSha256 = sha256(environment.receiptBytes);
					observation.closure.packageFileSetSha256 = environment.packageFileSetSha256;
					altered.set(consumer.profile + "/" + (position ? "relocated" : "installed") + ".json", Buffer.from(canonicalJson(observation)));
				}
			}
			altered.set("report.json", Buffer.from(canonicalJson(report)));
			await assert.rejects(checkStructuralSubtypeJvmReport(async path => altered.get(path), run)); controls++;
		}
	}
	t.diagnostic(`${controls} coordinated report/contract controls`);
});
