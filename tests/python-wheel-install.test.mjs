/**
 * Metadata-only pip fixtures, not compiled Lean acceptance evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { createDeterministicZip } from "../src/release/deterministic-zip.mjs";
import { generateCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { installPythonWheel, pythonTypingWheels } from "./helpers/python-wheel-install.mjs";
import { checkPythonCollectionTypes } from "./helpers/python-collection-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_PYTHON_WHEEL_INSTALL_TEST === "1";

test("offline pip resolves a conditional dependency and preserves precise installed Python types", { skip: !enabled, timeout: 120_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-python-wheel-metadata-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const generated = generateCopiedPythonPackage(collectionReviewedIr());
	const source = generated["lean_collections/__init__.py"].replace("from . import _native\n", "");
	const wheelRoot = join(working, "metadata-only"), info = "typing_fixture-1.0.0.dist-info";
	await saveLakeFile(wheelRoot, "lean_collections/__init__.py", source);
	await saveLakeFile(wheelRoot, "lean_collections/__init__.pyi", generated["lean_collections/__init__.pyi"]);
	await saveLakeFile(wheelRoot, "lean_collections/py.typed", "");
	await saveLakeFile(wheelRoot, `${info}/METADATA`, 'Metadata-Version: 2.4\nName: typing-fixture\nVersion: 1.0.0\nRequires-Python: >=3.11\nRequires-Dist: typing_extensions (<5,>=4.6); python_version < "3.12"\n\nMetadata-only fixture. No native algorithm is included.\n');
	await saveLakeFile(wheelRoot, `${info}/WHEEL`, "Wheel-Version: 1.0\nGenerator: dependency-fixture\nRoot-Is-Purelib: true\nTag: py3-none-any\n");
	await saveLakeFile(wheelRoot, `${info}/RECORD`, "");
	const archive = join(working, "typing_fixture-1.0.0-py3-none-any.whl");
	await saveLakeFile(working, "typing_fixture-1.0.0-py3-none-any.whl", await createDeterministicZip({ directory: wheelRoot, sourceDateEpoch: 315532800 }));
	const originalHash = sha256(await readFile(archive));
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	const hints = await readFile("tests/fixtures/collection-consumers/python-hints.py", "utf8");
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	assert.match((await runCopied(checker, ["-I", "-m", "mypy", "--version"], process.cwd())).stdout, /^mypy 2\.3\.1\b/);
	for(const [name, python, typingVersion] of [["minimum", interpreters[0], "4.6.0"], ["current", interpreters[0], "4.16.0"], ["standard", interpreters[1], "4.16.0"]])
	{
		const root = join(working, name);
		const installed = await installPythonWheel({ root, archive, python, typingVersion });
		assert.equal(installed.resolvedOffline, true);
		assert.equal(installed.dependency?.sha256 ?? null, name === "standard" ? null : pythonTypingWheels[typingVersion]);
		await assert.rejects(() => access(join(root, "dependency-feed")), { code: "ENOENT" });
		await saveLakeFile(root, "hints.py", hints);
		const result = await runCopied(installed.command, ["-I", "-B", "hints.py"], root);
		assert.equal(result.stderr, "");
		const observed = JSON.parse(result.stdout);
		assert.equal(observed.depth, 24); assert.equal(observed.shallow_primitives, 19);
		assert.ok(observed.type_hints_ms < 2000);
		for(const name of ["python-typed.py", "python-invalid.py"])
			await saveLakeFile(root, name, await readFile(`tests/fixtures/collection-consumers/${name}`, "utf8"));
		const checked = await checkPythonCollectionTypes({ checker, command: installed.command, root });
		assert.equal(checked.rejectedCalls, 13);
		assert.equal(sha256(await readFile(archive)), originalHash);
		t.diagnostic(`${installed.python}, ${installed.dependency?.version ?? "standard library"}: offline resolution, runtime annotations and strict installed stubs passed`);
		await rm(root, { recursive: true, force: true });
	}
});
