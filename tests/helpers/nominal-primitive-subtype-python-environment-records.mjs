/**
 * Rebuild the installed Python closure from the pre-pip baseline and original receipt.
 * No historical executable, environment directory or wheel path is reopened.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { nominalPrimitiveSubtypePythonMinors, nominalPrimitiveSubtypePythonPackage } from "./nominal-primitive-subtype-python-fixture.mjs";
import { nominalPrimitiveSubtypePythonReceipt } from "./nominal-primitive-subtype-python-wheel.mjs";

const file = bytes => ({ kind: "file", bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const safe = path => assert.ok(typeof path === "string" && !/[\\\0\r\n]/u.test(path)
	&& path.split("/").every(part => part && part !== "." && part !== ".."), `Unsafe recorded environment path: ${path}`);
const entries = values => {
	assert.ok(values && typeof values === "object" && !Array.isArray(values));
	for(const [path, value] of Object.entries(values))
	{
		safe(path);
		if(value.kind === "directory") assert.deepEqual(value, { kind: "directory" });
		else if(value.kind === "symlink")
		{
			assert.deepEqual(Object.keys(value).sort(), ["kind", "target"]);
			assert.equal(typeof value.target, "string"); assert.ok(value.target.length > 0);
			assert.doesNotMatch(value.target, /[\0\r\n]/u);
		}
		else
		{
			assert.equal(value.kind, "file"); assert.deepEqual(Object.keys(value).sort(), ["bytes", "kind", "sha256"]);
			assert.ok(Number.isSafeInteger(value.bytes) && value.bytes >= 0); assert.match(value.sha256, /^[a-f0-9]{64}$/u);
		}
	}
};
const add = (values, path, identity) => {
	safe(path); assert.ok(!Object.hasOwn(values, path), `Package replaced a bootstrap entry: ${path}`);
	values[path] = identity;
	for(let parent = posix.dirname(path); parent !== "."; parent = posix.dirname(parent))
	{
		if(Object.hasOwn(values, parent)) assert.deepEqual(values[parent], { kind: "directory" });
		else values[parent] = { kind: "directory" };
	}
};

/**
 * Check the actual interpreter observation without trusting its requested minor label.
 *
 * @param value - Recorded interpreter identity and original subprocess output.
 * @param minor - Independently selected supported minor.
 */
export const assertNominalPrimitiveSubtypePythonInterpreter = (value, minor) => {
	assert.ok(nominalPrimitiveSubtypePythonMinors.includes(minor)); assert.equal(value.minor, minor);
	assert.deepEqual(Object.keys(value).sort(), ["binary", "identity", "interpreter", "minor", "run"]);
	assert.ok(posix.isAbsolute(value.binary)); assert.doesNotMatch(value.binary, /[\0\r\n]/u);
	assert.deepEqual(Object.keys(value.identity).sort(), ["implementation", "pointerBits", "python"]);
	assert.match(value.identity.python, /^3\.(?:11|12)\.[0-9]+$/u);
	assert.equal(value.identity.python.split(".").slice(0, 2).join("."), minor);
	assert.equal(value.identity.implementation, "cpython"); assert.equal(value.identity.pointerBits, 64);
	assert.deepEqual(Object.keys(value.interpreter).sort(), ["bytes", "kind", "sha256"]);
	assert.equal(value.interpreter.kind, "file"); assert.match(value.interpreter.sha256, /^[a-f0-9]{64}$/u);
	assert.ok(Number.isSafeInteger(value.interpreter.bytes) && value.interpreter.bytes > 0);
	assert.deepEqual(Object.keys(value.run).sort(), ["code", "stderr", "stdout"]);
	assert.equal(value.run.code, 0); assert.equal(value.run.stderr, "");
	assert.deepEqual(JSON.parse(value.run.stdout), value.identity);
};

/**
 * Accept exactly the original baseline plus receipt files and named inert pip metadata.
 *
 * @param options - Original environment records and authenticated package bytes.
 * @param options.baseline - Captured before installing the wheel.
 * @param options.installed - Receipt-extended environment.
 * @param options.pip - Original offline pip invocation and result.
 * @param options.pipMetadata - Exact installed pip metadata text.
 * @param options.receiptBytes - Original wheel package receipt bytes.
 * @param options.interpreter - Independently checked process identity.
 * @param options.artifact - Original package-set wheel subject.
 */
export const checkNominalPrimitiveSubtypePythonEnvironment = ({ baseline, installed, pip, pipMetadata, receiptBytes, interpreter, artifact }) => {
	const minor = interpreter.minor, site = `lib/python${minor}/site-packages`;
	assertNominalPrimitiveSubtypePythonInterpreter(interpreter, minor);
	assert.deepEqual(Object.keys(baseline).sort(), ["baselineSha256", "binary", "entries", "expectedSha256", "interpreter", "python", "site", "venv"]);
	assert.deepEqual(Object.keys(installed).sort(), [...Object.keys(baseline), "receiptSha256"].sort());
	assert.equal(baseline.site, site); assert.equal(baseline.binary, interpreter.binary);
	assert.equal(baseline.python, interpreter.identity.python); assert.deepEqual(baseline.interpreter, interpreter.interpreter);
	assert.ok(posix.isAbsolute(baseline.venv)); assert.doesNotMatch(baseline.venv, /[\0\r\n]/u);
	entries(baseline.entries); entries(installed.entries);
	assert.equal(baseline.baselineSha256, sha256(canonicalJson(baseline.entries)));
	assert.equal(baseline.expectedSha256, baseline.baselineSha256);
	for(const key of ["baselineSha256", "binary", "interpreter", "python", "site", "venv"])
		assert.deepEqual(installed[key], baseline[key]);
	assert.ok(!Object.keys(baseline.entries).some(path => path.startsWith(`${site}/${nominalPrimitiveSubtypePythonPackage}`)));
	const receipt = JSON.parse(receiptBytes), expected = structuredClone(baseline.entries);
	for(const [path, value] of Object.entries(receipt.files)) add(expected, `${site}/${path}`, { kind: "file", ...value });
	add(expected, `${site}/${nominalPrimitiveSubtypePythonReceipt}`, file(receiptBytes));
	assert.equal(installed.receiptSha256, sha256(receiptBytes));
	const metadata = `${site}/nominalprimitivesubtypes-1.0.0.dist-info/`;
	assert.deepEqual(Object.keys(pipMetadata).sort(), ["INSTALLER", "RECORD", "REQUESTED", "direct_url.json"].map(name => metadata + name));
	assert.equal(pipMetadata[metadata + "INSTALLER"], "pip\n"); assert.equal(pipMetadata[metadata + "REQUESTED"], "");
	for(const [path, text] of Object.entries(pipMetadata))
	{ assert.equal(typeof text, "string"); add(expected, path, file(text)); }
	assert.deepEqual(installed.entries, expected); assert.equal(installed.expectedSha256, sha256(canonicalJson(expected)));
	assert.deepEqual(pip.environment, copiedCleanEnvironment);
	const args = pip.arguments;
	assert.deepEqual(args.slice(0, 3), ["-I", "-B", "-X"]);
	assert.ok(args[3].startsWith(`pycache_prefix=${posix.dirname(baseline.venv)}/.nominal-python-pip-bytecode-`));
	assert.deepEqual(args.slice(4, -1), ["-m", "pip", "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir", "--no-compile"]);
	assert.ok(posix.isAbsolute(args.at(-1)) && args.at(-1).endsWith(`/${artifact.path}`));
	assert.deepEqual(Object.keys(pip.run).sort(), ["code", "stderr", "stdout"]);
	assert.equal(pip.run.code, 0); assert.match(pip.run.stdout, /Successfully installed nominalprimitivesubtypes-1\.0\.0\n/u);
	const direct = JSON.parse(pipMetadata[metadata + "direct_url.json"]);
	assert.equal(direct.url, pathToFileURL(args.at(-1)).href);
	assert.deepEqual(direct.archive_info.hashes, { sha256: artifact.sha256 });
	if(direct.archive_info.hash !== undefined) assert.equal(direct.archive_info.hash, `sha256=${artifact.sha256}`);
	const record = pipMetadata[metadata + "RECORD"].replaceAll("\r\n", "\n");
	assert.ok(record.endsWith("\n")); assert.doesNotMatch(record, /\r/u);
	const rows = record.slice(0, -1).split("\n").map(line => line.split(","));
	const installedFiles = Object.keys(receipt.files).concat(nominalPrimitiveSubtypePythonReceipt, Object.keys(pipMetadata).map(path => path.slice(site.length + 1))).sort();
	assert.deepEqual(rows.map(row => row[0]).sort(), installedFiles);
	for(const [path, digest, bytes, ...rest] of rows)
	{
		assert.deepEqual(rest, []);
		if(path === "nominalprimitivesubtypes-1.0.0.dist-info/RECORD")
		{ assert.equal(digest, ""); assert.equal(bytes, ""); }
		else
		{
			const identity = expected[`${site}/${path}`]; assert.equal(identity.kind, "file");
			assert.equal(digest, `sha256=${Buffer.from(identity.sha256, "hex").toString("base64url")}`); assert.equal(bytes, String(identity.bytes));
		}
	}
	return { baselineSha256: baseline.baselineSha256
		, environmentSha256: installed.expectedSha256
		, interpreterSha256: interpreter.interpreter.sha256
		, python: interpreter.identity.python };
};
