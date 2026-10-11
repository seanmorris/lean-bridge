/**
 * Check every CI lane against original installed records, plus explicit synthetic TAP controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { structuralSubtypeCiLanes, structuralSubtypeCiTestName, parseStructuralSubtypeCiArgs, assertStructuralSubtypeCiTap, checkStructuralSubtypeCiRecords } from "./structural-subtype-ci-report.mjs";

const syntheticTap = (lane, route) => {
	const name = structuralSubtypeCiTestName(lane, route);
	return `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
};
const argsFor = (lane, route = "ordinary") => ["--lane", lane, "--route", route
	, "--producer", "a".repeat(40), "--directory", "records", "--tap", "run.tap"
	, ...["node-browser", "php-wasm"].includes(lane) ? [] : ["--glibc", "2.38"]];

test("structural CI selection is closed and requires the exact native floor and author route", () => {
	assert.equal(structuralSubtypeCiLanes.length, 12);
	for(const lane of structuralSubtypeCiLanes) for(const route of ["ordinary", "reviewed"])
	{
		const args = argsFor(lane, route), selected = parseStructuralSubtypeCiArgs(args);
		assert.equal(selected.lane, lane); assert.equal(selected.route, route);
		for(const invalid of [
			args.slice(0, -1), [...args, "--unknown", "x"]
			, [...args, "--lane", lane]
			, args.map((value, index) => index === 1 ? "missing" : value)
			, args.map((value, index) => index === 3 ? "missing" : value)
			, args.map((value, index) => index === 5 ? "HEAD" : value)
			, args.map((value, index) => index === 7 ? "" : value)
			, args.map((value, index) => index === 9 ? "\0" : value)])
			assert.throws(() => parseStructuralSubtypeCiArgs(invalid));
		if(selected.glibc)
		{
			assert.throws(() => parseStructuralSubtypeCiArgs(args.slice(0, -2)));
			assert.throws(() => parseStructuralSubtypeCiArgs([...args.slice(0, -1), "2.99"]));
		}
		else assert.throws(() => parseStructuralSubtypeCiArgs([...args, "--glibc", "2.38"]));
	}
});

test("structural CI TAP controls reject skips, partial success, duplicate runs and wrong installed selection", () => {
	for(const lane of structuralSubtypeCiLanes) for(const route of ["ordinary", "reviewed"])
	{
		const tap = syntheticTap(lane, route);
		assertStructuralSubtypeCiTap(tap, lane, route);
		const mutations = [tap + tap, tap.replace("TAP version 13\n", "")
			, tap.replace("ok 1 -", "not ok 1 -"), tap + "Bail out! stopped\n"
			, tap.replace("1..1", "1..0 # SKIP"), tap + "# TODO untested\n"
			, tap.replace(/^ok 1 - .+$/mu, "ok 1 - different installed test")
			, tap.replace(/^# Subtest: .+\n/mu, "")];
		for(const name of ["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"])
		{
			mutations.push(tap.replace(new RegExp(`^# ${name} [0-9]+\\n`, "mu"), ""));
			mutations.push(tap + `# ${name} 0\n`);
			mutations.push(tap.replace(new RegExp(`^# ${name} [0-9]+$`, "mu"), `# ${name} 9`));
		}
		for(const invalid of mutations) assert.throws(() => assertStructuralSubtypeCiTap(invalid, lane, route));
	}
});

test("structural CI report dispatch rechecks both original author routes for every host lane", async t => {
	const archives = {
		"c-cpp": "native", python311: "python", python312: "python"
		, rust: "rust", ruby: "ruby", dotnet: "dotnet", jvm: "jvm"
		, "php-native": "php", "wit-wasi": "wit", perl: "perl"
		, "node-browser": "browser", "php-wasm": "php-wasm"
	};
	let accepted = 0, refused = 0;
	for(const lane of structuralSubtypeCiLanes)
	{
		const root = `docs/evidence/structural-subtype-${archives[lane]}-20261011`;
		const index = JSON.parse(await readFile(root + "/index.json"));
		for(const route of ["ordinary", "reviewed"])
		{
			const run = index.runs.find(row => row.route === route && (!lane.startsWith("python") || row.minor === (lane === "python311" ? "3.11" : "3.12")));
			assert.ok(run);
			const records = `${root}/${run.label ?? route}/records`, files = new Map();
			for(const entry of index.files.filter(entry => entry.path.startsWith(`${run.label ?? route}/records/`)))
				files.set(entry.path.slice(`${run.label ?? route}/records/`.length), await readFile(`${root}/${entry.path}`));
			const report = JSON.parse(files.get("report.json"));
			const options = {
				lane, route, producer: run.producerCommit, directory: records
				, tap: "synthetic.tap"
				, ...["node-browser", "php-wasm"].includes(lane) ? {} : { glibc: report.glibcMinimumVersion ?? report.declaredGlibcFloor } };
			const tap = syntheticTap(lane, route), read = async path => { assert.ok(files.has(path), path); return files.get(path); };
			const result = await checkStructuralSubtypeCiRecords(options, { tap, read });
			assert.equal(result.lane, lane); assert.equal(result.route, route); accepted++;
			for(const changed of [
				{ producer: "0".repeat(40) }
				, { route: route === "ordinary" ? "reviewed" : "ordinary" }
				, ...options.glibc ? [{ glibc: options.glibc === "2.36" ? "2.38" : "2.36" }] : []]) {
				const selected = { ...options, ...changed };
				await assert.rejects(checkStructuralSubtypeCiRecords(selected, { tap: syntheticTap(lane, selected.route), read })); refused++;
				}
			await assert.rejects(checkStructuralSubtypeCiRecords(options, {
				tap
				, read: async path => {
					if(path === "build-0/" + (lane === "node-browser" ? "binding/binding-ir.json" : "model.json")) throw new Error("missing compiler model");
					return read(path);
				}
			})); refused++;
		}
	}
	t.diagnostic(`${accepted} original installed reports accepted; ${refused} wrong selections or missing models refused. TAP in this test is explicitly synthetic.`);
});
