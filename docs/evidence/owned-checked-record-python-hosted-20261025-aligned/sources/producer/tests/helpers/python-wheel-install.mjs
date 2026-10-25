/**
 * Resolve declared Python dependencies from a checksummed, offline wheel feed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const pythonTypingWheels = {
	"4.6.0": "6ad00b63f849b7dcc313b70b6b304ed67b2b2963b3098a33efe18056b1a9a223"
	, "4.16.0": "481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8"
};

/**
 * Install an original wheel with pip's dependency resolver and no registry access.
 *
 * @param options - Task-owned deployment, original archive and selected interpreter.
 * @param options.root - Consumer directory, never a producer working tree.
 * @param options.archive - Original publisher archive.
 * @param options.python - Absolute Python interpreter.
 * @param options.typingVersion - Pinned offline dependency, when required by metadata.
 */
export const installPythonWheel = async ({ root, archive, python, typingVersion = "4.16.0" }) => {
	await mkdir(root, { recursive: true });
	const inspect = `import email, json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    names = [name for name in archive.namelist() if name.endswith('.dist-info/METADATA')]
    assert len(names) == 1
    metadata = email.message_from_bytes(archive.read(names[0]))
print(json.dumps({'python': list(sys.version_info[:3]), 'requires': metadata.get_all('Requires-Dist', [])}))
`;
	const inspected = await runCopied(python, ["-I", "-B", "-c", inspect, archive], root);
	assert.equal(inspected.stderr, "");
	const { python: version, requires } = JSON.parse(inspected.stdout);
	assert.ok(version[0] === 3 && version[1] >= 11);
	assert.ok(requires.length <= 1);
	if(requires.length) assert.equal(requires[0], 'typing_extensions (<5,>=4.6); python_version < "3.12"');
	const feed = join(root, "dependency-feed"); await mkdir(feed);
	let dependency = null;
	if(requires.length && version[1] === 11)
	{
		assert.ok(Object.hasOwn(pythonTypingWheels, typingVersion), "Select a reviewed typing_extensions wheel");
		const name = `typing_extensions-${typingVersion}-py3-none-any.whl`;
		const source = join(resolve(process.env.LEAN_BRIDGE_PYTHON_TYPING_WHEELS ?? "build/python-typing-wheels"), typingVersion, name);
		const bytes = await readFile(source).catch(error => {
			error.message += "; prepare the pinned offline wheels with the documented pip download commands"; throw error;
		});
		assert.equal(sha256(bytes), pythonTypingWheels[typingVersion], "Offline Python dependency differs from reviewed PyPI wheel");
		await saveLakeFile(feed, name, bytes);
		dependency = { name: "typing_extensions", version: typingVersion, archive: name, bytes: bytes.length, sha256: sha256(bytes) };
	}
	const command = join(root, "venv/bin/python");
	await runCopied(python, ["-I", "-m", "venv", join(root, "venv")], root);
	await runCopied(command, ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--find-links", feed, "--only-binary=:all:", "--no-cache-dir", "--no-compile", "--report", "pip-install.json", archive], root);
	const report = JSON.parse(await readFile(join(root, "pip-install.json")));
	assert.equal(report.install.length, dependency ? 2 : 1);
	assert.equal(report.install.filter(item => item.requested).length, 1);
	const component = report.install.find(item => item.requested);
	assert.equal(component.download_info.archive_info.hashes.sha256, sha256(await readFile(archive)));
	if(dependency)
	{
		const resolved = report.install.find(item => !item.requested);
		assert.equal(resolved.metadata.name.replaceAll("-", "_"), dependency.name);
		assert.equal(resolved.metadata.version, dependency.version);
		assert.equal(resolved.download_info.archive_info.hashes.sha256, dependency.sha256);
	}
	const checked = await runCopied(command, ["-I", "-m", "pip", "--isolated", "check"], root);
	assert.equal(checked.stdout.trim(), "No broken requirements found.");
	await rm(feed, { recursive: true, force: true });
	return { command, python: version.join("."), dependency, requires, resolvedOffline: true };
};

/**
 * Run the existing independent copied fixture after normal offline pip resolution.
 *
 * @param options - Same handoff contract as the shared copied-value harness.
 * @param options.consumer - Task-owned consumer root.
 * @param options.handoff - Verified package-set archive directory.
 * @param options.packages - Original publisher package entries.
 * @param options.environment - Interpreter selection.
 * @param options.fixture - Independent caller and result assertions.
 */
export const installCopiedPythonConsumer = async ({ consumer, handoff, packages, environment, fixture }) => {
	const root = join(consumer, "python"), pkg = packages.find(item => item.role === "component");
	const archive = join(handoff, pkg.artifacts[0].path);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	const source = await fixture.source("python", "py", 64);
	await saveLakeFile(root, "consumer.py", source);
	const { command, ...installation } = await installPythonWheel({ root, archive, python: environment.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3" });
	const result = await runCopied(command, ["-I", "-B", "consumer.py"], root);
	assert.equal(result.stderr, "");
	const observation = fixture.parseResult?.(result.stdout);
	if(!fixture.parseResult) assert.match(result.stdout.trim(), new RegExp(`^${fixture.success}:[0-9]+$`));
	const checks = observation?.checks ?? Number(result.stdout.trim().split(":")[1]); assert.ok(checks >= 100);
	return { checks, ...(observation ? { result: observation } : {}), installation, consumerSha256: sha256(source), command, offlineInstall: true, compilerFreePath: true };
};
