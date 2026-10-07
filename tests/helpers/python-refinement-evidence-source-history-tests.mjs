/**
 * Authenticate the Python refinement evidence change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeContainerHostDispatchSource } from "./container-host-dispatch-source-history.mjs";
import { beforePythonRefinementEvidenceSource, pythonRefinementEvidenceChangedPaths
	, pythonRefinementEvidenceHistoryPath, reversePythonRefinementEvidenceUpdate } from "./python-refinement-evidence-source-history.mjs";

test("Python refinement evidence history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(pythonRefinementEvidenceHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "3cedfb9cc794f9f337f21a215a6dded2aca08c05");
	assert.deepEqual(record.updates.map(item => item.path), pythonRefinementEvidenceChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeContainerHostDispatchSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePythonRefinementEvidenceUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePythonRefinementEvidenceSource(update.path, source)), update.previousSha256);
		assert.equal(beforePythonRefinementEvidenceSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforePythonRefinementEvidenceSource(update.path, changed), changed);
		assert.throws(() => reversePythonRefinementEvidenceUpdate(changed, update));
		assert.throws(() => reversePythonRefinementEvidenceUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Python evidence adds only ordinary-source parameter/result and specialization cells", async () => {
	const path = "docs/type-surface.v1.json", source = beforeContainerHostDispatchSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforePythonRefinementEvidenceSource(path, source));
	const added = current.evidence.filter(entry => !previous.evidence.some(item => item.id === entry.id));
	const ids = ["python-fin-installed", "native-specializations-python-installed", "native-fin-containers-python-installed", "native-subtype-python-installed"];
	assert.deepEqual(added.map(entry => entry.id), ids);
	const kinds = ["native-fin", "native-specializations", "native-fin-containers", "native-subtype"];
	for(const [index, evidence] of added.entries())
	{
		assert.equal(evidence.kind, "installed");
		assert.equal(evidence.revision, "7f7bd65104050efddd328377389072f4c4272ac0");
		assert.match(evidence.command, /PYTHON_FIN_TEST=1|PROFILES=python/u);
		const reportPath = `docs/evidence/python-refinements-20261007/${kinds[index]}.json`;
		const record = JSON.parse(await readFile(reportPath, "utf8"));
		assert.ok(evidence.files.some(file => file.path === reportPath));
		assert.ok(evidence.files.some(file => file.path === "tests/helpers/python-refinement-evidence-tests.mjs"));
		assert.deepEqual(evidence.artifacts, Object.entries(record.archives).map(([path, sha256]) => ({ path: `python/${kinds[index]}/${path}`, sha256 })));
	}
	const cells = current.observations.filter(entry => !previous.observations.some(item => item.id === entry.id));
	assert.deepEqual(cells.map(entry => entry.id), ["native-fin-python-ordinary-source", "native-specializations-python-ordinary-source", "native-subtype-python-ordinary-source"]);
	for(const [index, cell] of cells.entries())
	{
		assert.deepEqual(cell.profiles, ["python"]);
		assert.equal(cell.path, "ordinary-source");
		assert.deepEqual(cell.positions, index === 1 ? ["signature"] : ["parameter", "result"]);
		assert.deepEqual(cell.shapes, [["fin"], ["generic", "implicit", "instance"], ["subtype"]][index]);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence, [[ids[0], ids[2]], [ids[1]], [ids[3]]][index]);
		}
	}
	assert.deepEqual(current.observations.filter(entry => !cells.includes(entry)), previous.observations);
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(current[key], previous[key], key);
	for(const entry of previous.evidence)
	{
		const now = current.evidence.find(item => item.id === entry.id);
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [index, file] of entry.files.entries())
		{
			if(now.files[index].sha256 === file.sha256) continue;
			assert.ok(pythonRefinementEvidenceChangedPaths.includes(file.path));
			const source = beforeContainerHostDispatchSource(file.path, await readFile(file.path, "utf8"));
			assert.equal(file.sha256, sha256(beforePythonRefinementEvidenceSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(source));
		}
	}
});
