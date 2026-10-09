/**
 * The scalar Fin entry-counter references (VO #1425) authenticate all five archives and expose exactly twelve
 * host, caller and source-route selections, refusing every swapped, missing, widened or altered selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertFinDispatchReferences, assertFinDispatchRows, finDispatchArchives, finDispatchReferences, finDispatchScope, finDispatchSelectionIds } from "./helpers/fin-dispatch-references.mjs";

test("five strict archive readers yield exactly twelve distinct host, caller and route selections", async () => {
	const read = [];
	const references = await finDispatchReferences(path => {
		read.push(path);
		return readFile(path);
	});
	assert.deepEqual(references.map(reference => reference.id), finDispatchSelectionIds);
	assert.equal(new Set(references.map(reference => reference.id)).size, 12);
	// Every archive's receipt, queue and reports were read, and so were its current producer sources.
	for(const archive of finDispatchArchives)
		for(const name of ["receipt.json", "queue.json", ...Object.values(archive.reports).map(([file]) => file)])
			assert.ok(read.includes(`${archive.directory}/${name}`), `${archive.directory}/${name}`);
	for(const path of ["tests/php-fin.test.mjs", "tests/wit-fin.test.mjs", "tests/ruby-fin.test.mjs", "tests/dotnet-fin.test.mjs", "tests/jvm-fin.test.mjs"])
		assert.ok(read.includes(path), path);
	// Java and Kotlin stay separate selections over the same JVM report files.
	const jvm = references.filter(reference => reference.host === "jvm");
	assert.deepEqual(jvm.map(reference => [reference.caller, reference.sourcePath, reference.checks]), [["java", "ordinary-source", 2023], ["java", "reviewed-ir", 2023], ["kotlin", "ordinary-source", 2022], ["kotlin", "reviewed-ir", 2022]]);
	assert.ok(references.every(reference => Object.isFrozen(reference) && reference.scope === finDispatchScope && reference.execution === "local" && reference.hostedCi === false));
	// Each caller keeps its own consumer and probe identity on both routes.
	const [java, kotlin] = [jvm[0], jvm[2]];
	assert.notEqual(java.consumerSha256, kotlin.consumerSha256); assert.notEqual(java.probeSha256, kotlin.probeSha256);
	for(const [ordinary, reviewed] of [[jvm[0], jvm[1]], [jvm[2], jvm[3]]])
		assert.deepEqual([reviewed.consumerSha256, reviewed.probeSha256], [ordinary.consumerSha256, ordinary.probeSha256]);
});

test("the references refuse swapped, missing, duplicate, miscounted, altered and widened selections", async () => {
	const references = await finDispatchReferences();
	const changed = (index, change) => {
		const copy = references.map(reference => structuredClone(reference));
		change(copy[index], copy);
		return copy;
	};
	const refused = {
		"swapped host": changed(0, item => { item.host = "ruby"; })
		, "Kotlin labelled as Java": changed(10, item => { item.caller = "java"; })
		, "callers swapped": changed(8, (item, copy) => { [copy[8], copy[10]] = [copy[10], copy[8]]; })
		, "route swapped": changed(4, item => { item.sourcePath = "reviewed-ir"; })
		, "reports swapped": changed(6, (item, copy) => { [item.report, copy[7].report] = [copy[7].report, item.report]; })
		, "missing selection": changed(0, (item, copy) => { copy.splice(5, 1); })
		, "duplicate selection": changed(0, (item, copy) => { copy.splice(5, 1, copy[4]); })
		, "extra selection": changed(0, (item, copy) => { copy.push(copy[11]); })
		, "reordered selections": changed(0, (item, copy) => { copy.reverse(); })
		, "dropped producer source": changed(2, item => { delete item.sources[Object.keys(item.sources)[0]]; })
		, "added producer source": changed(9, item => { item.sources["src/extra.mjs"] = "0".repeat(64); })
		, "fewer checks": changed(4, item => { item.checks--; })
		, "Java checks for Kotlin": changed(10, item => { item.checks = 2023; })
		, "rejection entered a column": changed(1, item => { for(const row of item.rows.slice(1)) row[2][0]++; })
		, "Fin 0 adapter entered": changed(5, item => { for(const row of item.rows.slice(5)) row[2][4]++; })
		, "missed adapter": changed(7, item => { for(const row of item.rows.slice(5)) row[2][3]--; })
		, "rejection reported as success": changed(9, item => { item.rows[3][1] = "ok:0"; })
		, "dropped row": changed(11, item => { item.rows.splice(6, 1); })
		, "WIT adapters on PHP": changed(0, item => { item.columns = item.columns.map((column, k) => k < 3 ? column : references[2].columns[k]); })
		, "other instrument": changed(4, item => { item.instrument = "LD_PRELOAD"; })
		, "other environment": changed(6, item => { item.environment = "Any .NET runtime"; })
		, "other revision": changed(3, item => { item.revision = "0".repeat(40); })
		, "other command": changed(8, item => { item.command = item.command.replace("taskset -c 3 ", ""); })
		, "receipt digest": changed(2, item => { item.receipt.sha256 = "0".repeat(64); })
		, "report digest": changed(1, item => { item.report.sha256 = "0".repeat(64); })
		, "hosted claim": changed(4, item => { item.hostedCi = true; })
		, "hosted execution": changed(6, item => { item.execution = "hosted"; })
		, "wider scope": changed(0, item => { item.scope = "Installed scalar and container Fin calls"; })
		, "changed producer source digest": changed(4, item => { const [path] = Object.keys(item.sources); item.sources[path] = "0".repeat(64); })
		, "renamed producer source": changed(6, item => {
			const [path] = Object.keys(item.sources), digest = item.sources[path];
			delete item.sources[path]; item.sources[`${path}.renamed`] = digest;
		})
		, "Kotlin consumer on Java": changed(8, (item, copy) => { item.consumerSha256 = copy[10].consumerSha256; })
		, "Java probe on Kotlin": changed(11, (item, copy) => { item.probeSha256 = copy[9].probeSha256; })
		, "WIT consumer source": changed(3, item => { item.consumerSha256 = "0".repeat(64); })
		, "start status": changed(5, item => { item.rows[0][1] = "ok:0"; })
		, "successful result": changed(7, item => { item.rows[5][1] = "ok:7"; })
		, "label result": changed(10, item => { item.rows[11][1] = "ok:slot:6"; })
		, "rejected parameter": changed(9, item => { item.rows[4][1] = "rejected:arg0<4"; })
		, "rejected bound": changed(2, item => { item.rows[1][1] = "rejected:arg0<11"; })
		, "PHP error code": changed(1, item => { item.rows[3][1] = "rejected:2:arg0<0"; })
		, "PHP spelling on Ruby": changed(4, item => { item.rows[1][1] = "rejected:1:arg0<10"; })
	};
	for(const [label, copy] of Object.entries(refused))
		assert.throws(() => assertFinDispatchReferences(copy), assert.AssertionError, label);
	assert.throws(() => assertFinDispatchRows(references[0].rows.slice(1)), assert.AssertionError, "missing start row");
});

test("the builder refuses a changed receipt, report or producer source before exposing selections", async () => {
	for(const [target, label] of [
		["docs/evidence/ruby-fin-dispatch-20261009/receipt.json", "receipt"]
		, ["docs/evidence/jvm-fin-dispatch-20261009/jvm-reviewed.json", "report"]
		, ["src/backends/dotnet/verified-assets.mjs", "producer source"]
	])
		await assert.rejects(() => finDispatchReferences(async path => {
			const bytes = await readFile(path);
			return path === target ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), assert.AssertionError, label);
});
