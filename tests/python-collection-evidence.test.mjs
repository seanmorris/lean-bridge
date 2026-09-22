/**
 * Bind original installed Python collections to public calls and bounded typing.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { pythonTypingWheels } from "./helpers/python-wheel-install.mjs";

test("Python collection evidence binds original wheels, offline dependencies and public types", async () => {
	const record = JSON.parse(await readFile("docs/evidence/python-collections-20260922.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.profiles, ["python"]);
	assert.equal(record.hostGlibc, "2.36"); assert.equal(record.packageGlibcFloor, "2.36");
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(collectionSignatures));
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(collectionReviewedIr())));
	const reports = record.executions.map(({ signaturesSha256, ...run }) => {
		assert.equal(signaturesSha256, sha256(canonicalJson(record.signatures)));
		return { ...run, signatures: record.signatures };
	});
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports })));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "python"); assert.equal(run.sourceRemovedBeforeInstallation, true);
		assert.equal(run.checkerVersion, "mypy 2.3.1 (compiled: yes)");
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256"])
			assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "pypi"); assert.equal(pkg.ecosystem, "pypi");
		assert.equal(pkg.name, "collections-api"); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/collections_api-1.0.0-py3-none-manylinux_2_36_x86_64.whl");
		assert.deepEqual(run.installations.map(item => item.name), ["3.11-minimum", "3.11-current", "3.12-standard"]);
		for(const installation of run.installations)
		{
			const { public: observed, hints, faults, strictTypecheck } = installation;
			assert.equal(observed.checks, 158365); assert.equal(observed.calls, 3225); assert.equal(observed.rejected, 119);
			assert.deepEqual(observed.primitives.map(item => item.name), ["unit", "bool", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "nat", "int", "float32", "float64", "string", "bytes", "char", "usize", "isize"]);
			assert.ok(observed.primitives.every(item => item.checks > 100 && item.rejected_cases > 0));
			assert.deepEqual(observed.recordTypes, ["Primitives", "Empty", "Single", "Count", "Pair", "Reversed", "Packet"]);
			for(const key of ["offlineInstall", "resolvedOffline", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "repeatExecution", "installedFilesUnchanged", "installedDependencyUnchanged", "isolatedInMemoryFaultProbe"])
				assert.equal(installation[key], true, key);
			assert.match(installation.installedReceiptSha256, /^[a-f0-9]{64}$/);
			assert.equal(Object.keys(installation.installedFiles).length, 28);
			assert.equal(observed.loadedLibraries.length, 4);
			for(const { path, ...identity } of observed.loadedLibraries) assert.deepEqual(identity, installation.installedFiles[path]);
			assert.deepEqual(installation.requires, ['typing_extensions (<5,>=4.6); python_version < "3.12"']);
			if(installation.name === "3.12-standard")
			{
				assert.equal(installation.python, "3.12.14"); assert.equal(installation.dependency, null);
				assert.equal(installation.installedDependency, null);
			}
			else
			{
				const version = installation.name === "3.11-minimum" ? "4.6.0" : "4.16.0";
				assert.equal(installation.python, "3.11.16");
				assert.equal(installation.dependency.version, version);
				assert.equal(installation.dependency.name, "typing_extensions");
				assert.equal(installation.dependency.archive, `typing_extensions-${version}-py3-none-any.whl`);
				assert.equal(installation.dependency.sha256, pythonTypingWheels[version]);
				assert.equal(installation.installedDependency.version, version);
				assert.ok(Object.hasOwn(installation.installedDependency.files, "typing_extensions.py"));
			}
			assert.equal(hints.depth, 24); assert.equal(hints.shallow_primitives, 19);
			assert.ok(hints.type_hints_ms >= 0 && hints.type_hints_ms < 2000);
			assert.deepEqual(strictTypecheck, { executed: true, memoryLimitMiB: 1024, rejectedCalls: 13, timeoutSeconds: 30 });
			assert.deepEqual(faults, { allocationFailures: 80, checks: 2935, clears: 405, conversionFailures: 305, malformedValues: 7, partialInputs: 64 });
			for(const [file, hash] of Object.entries(installation.sourceHashes))
				assert.equal(hash, record.sourceHashes[`tests/fixtures/collection-consumers/${file}`]);
			assert.deepEqual(observed, run.installations[0].public);
			assert.deepEqual(installation.installedFiles, run.installations[0].installedFiles);
		}
		assert.deepEqual(run.installations[0].public.loadedLibraries, record.executions.find(other => other.path !== run.path).installations[0].public.loadedLibraries);
	}
	for(const key of ["archivesIdentical", "installedFilesIdentical", "publicObservationsIdentical", "documentationIdentical"])
		assert.equal(record.reproduction[key], true);
	assert.equal(record.reproduction.runs.length, 2);
	for(const previous of record.reproduction.runs)
	{
		const run = record.executions.find(run => run.path === previous.path); assert.ok(run);
		assert.equal(previous.packagesSha256, sha256(canonicalJson(run.packages)));
		assert.equal(previous.installations.length, 3);
		for(const identity of previous.installations)
		{
			const installation = run.installations.find(item => item.name === identity.name); assert.ok(installation);
			for(const key of ["installedFiles", "public", "faults", "strictTypecheck", "dependency"])
				assert.equal(identity[`${key}Sha256`], sha256(canonicalJson(installation[key])));
		}
	}
	const { firstLog, secondLog } = record.reproduction; assert.notEqual(firstLog.sha256, secondLog.sha256);
	for(const log of [firstLog, secondLog])
	{
		assert.equal(log.sha256, sha256(log.text));
		assert.match(log.text, /# tests 2\n# suites 0\n# pass 2\n# fail 0/);
		assert.match(log.text, /# ordinary-source: compiling Python collections/);
		assert.match(log.text, /# reviewed-ir: compiling Python collections/);
	}
	assert.doesNotMatch(await readFile("tests/fixtures/collection-consumers/python.py", "utf8"), /ctypes|_native|_from\d+|_to\d+/);
});

test("Python collection documentation runs against the original relocated wheel", async () => {
	const { documentation, reproduction } = JSON.parse(await readFile("docs/evidence/python-collections-20260922.json"));
	assert.equal(reproduction.documentationSha256, sha256(canonicalJson(documentation)));
	const publisher = await readFile("docs/publish/pypi.md", "utf8"), consumer = await readFile("docs/consume/python.md", "utf8");
	assert.equal(documentation.sourceHashes.lean, sha256(publisher.match(/## Export arrays and records\n[^]*?```lean\n([^]*?)\n```/)[1]));
	assert.equal(documentation.sourceHashes.python, sha256(consumer.match(/### Arrays and records\n[^]*?```python\n([^]*?)\n```/)[1]));
	assert.equal(documentation.expectedOutput, "Seeds: 7, 2\n");
	assert.deepEqual(documentation.installation, { dependency: null, python: "3.11.16", requires: [], resolvedOffline: true });
	for(const key of ["sourceRemovedBeforeInstallation", "relocatedInstallation", "producerHandoffRemoved", "compilerFreeExecution", "repeatExecution", "installedFilesUnchanged"])
		assert.equal(documentation[key], true);
	assert.equal(documentation.packages.length, 1);
	assert.equal(documentation.packages[0].name, "parcels-api");
	assert.equal(documentation.packages[0].artifacts.length, 1);
	assert.equal(documentation.packages[0].artifacts[0].path, "archives/parcels_api-1.0.0-py3-none-manylinux_2_36_x86_64.whl");
});

test("Python collections advance only copied reviewed positions and require original CI artifacts", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("python-collections-installed"));
	assert.equal(observed.length, 22);
	for(const cell of observed)
	{
		assert.equal(cell.profile, "python"); assert.equal(cell.path, "reviewed-ir");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["array", "record"].includes(cell.shape) || cell.position === "field" && document.irFacets.primitive.includes(cell.shape));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["python-collections-installed"]); }
	}
	for(const cell of cells.filter(cell => cell.profile === "python" && ["array", "record"].includes(cell.shape) && cell.position.startsWith("callback-")))
		assert.notEqual(cell.stages.installedExecution.state, "passed");
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_COLLECTION_TEST=1 node --test tests/python-collections.test.mjs"));
	for(const report of ["python", "python-docs"])
	{
		assert.ok(workflow.includes(`test -s build/collections/${report}.json`));
		assert.ok(workflow.split("path: |\n").some(block => block.includes(`build/collections/${report}.json`)));
	}
});
