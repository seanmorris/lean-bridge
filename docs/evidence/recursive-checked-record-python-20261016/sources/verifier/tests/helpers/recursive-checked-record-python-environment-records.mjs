/**
 * Check one retained venv inventory against the original wheel and interpreter selection.
 *
 * @file
 */
import assert from "node:assert/strict";

// Interpreter-bundled bootstrap entries; versions vary between local and hosted interpreters.
const bootstrap = {
	"3.11": [
		/^_distutils_hack$/u, /^distutils-precedence\.pth$/u, /^pip$/u
		, /^pip-[0-9.]+\.dist-info$/u, /^pkg_resources$/u, /^setuptools$/u
		, /^setuptools-[0-9.]+\.dist-info$/u
	]
	, "3.12": [/^pip$/u, /^pip-[0-9.]+\.dist-info$/u]
};
const pipMetadata = new Set(["INSTALLER", "REQUESTED", "direct_url.json", "RECORD"]);

/**
 * Require the exact installed closure: wheel bytes, declared dependency and bootstrap only.
 *
 * @param options - Retained inventory and its independently authenticated inputs.
 * @param options.inventory - Original venv inventory (path to kind, size, digest).
 * @param options.wheel - Authenticated wheel record whose members match the archive.
 * @param options.selection - Interpreter and typing_extensions selection.
 * @param options.interpreter - Probed base interpreter record.
 * @param options.name - Distribution name.
 * @param options.version - Distribution version.
 */
export const checkRecursiveCheckedRecordPythonEnvironment = ({ inventory, wheel, selection, interpreter, name, version }) => {
	const { minor, typingVersion } = selection, site = `lib/python${minor}/site-packages/`;
	const moduleDir = `lean_${name}/`, distInfo = `${name}-${version}.dist-info/`;
	assert.deepEqual(inventory["bin/python"], { kind: "symlink", target: `python${minor}` });
	assert.deepEqual(inventory["bin/python3"], { kind: "symlink", target: `python${minor}` });
	assert.deepEqual(inventory[`bin/python${minor}`], { kind: "symlink", target: interpreter.binary });
	assert.deepEqual(inventory.lib64, { kind: "symlink", target: "lib" });
	assert.equal(inventory["pyvenv.cfg"]?.kind, "file");
	for(const [path, entry] of Object.entries(inventory))
	{
		assert.ok(["file", "directory", "symlink"].includes(entry.kind), path);
		if(entry.kind === "symlink")
			assert.ok(["bin/python", "bin/python3", `bin/python${minor}`, "lib64"].includes(path), `Unexpected symlink: ${path}`);
		assert.doesNotMatch(path, /(?:^|\/)(?:sitecustomize|usercustomize)\.py$/u, path);
		if(path.endsWith(".pth")) assert.equal(path, `${site}distutils-precedence.pth`, path);
	}
	const top = new Set(Object.keys(inventory).filter(path => path.startsWith(site)).map(path => path.slice(site.length).split("/")[0]));
	const expectedTop = [moduleDir.slice(0, -1), distInfo.slice(0, -1)
		, ...typingVersion === null ? [] : ["typing_extensions.py", `typing_extensions-${typingVersion}.dist-info`]];
	for(const entry of expectedTop) assert.ok(top.delete(entry), `Missing installed entry: ${entry}`);
	for(const entry of top) assert.ok(bootstrap[minor].some(pattern => pattern.test(entry)), `Unexpected installed entry: ${entry}`);
	assert.equal(bootstrap[minor].filter(pattern => [...top].some(entry => pattern.test(entry))).length
		, bootstrap[minor].length, "Interpreter bootstrap closure differs");
	// Package and metadata bytes must be the wheel's own; pip may add only its four records.
	const installedFiles = prefix => Object.entries(inventory).filter(([path, entry]) =>
		path.startsWith(site + prefix) && entry.kind === "file").map(([path]) => path.slice(site.length));
	const wheelMembers = prefix => Object.keys(wheel.files).filter(path => path.startsWith(prefix));
	assert.deepEqual(installedFiles(moduleDir).sort(), wheelMembers(moduleDir).sort());
	for(const path of wheelMembers(moduleDir))
	{
		const { bytes, sha256 } = inventory[site + path];
		assert.deepEqual({ bytes, sha256 }, wheel.files[path], path);
	}
	const metadata = installedFiles(distInfo);
	for(const path of wheelMembers(distInfo).filter(path => path !== `${distInfo}RECORD`))
	{
		assert.ok(metadata.includes(path), path);
		const { bytes, sha256 } = inventory[site + path];
		assert.deepEqual({ bytes, sha256 }, wheel.files[path], path);
	}
	for(const path of metadata.filter(path => !wheelMembers(distInfo).includes(path) || path === `${distInfo}RECORD`))
		assert.ok(pipMetadata.has(path.slice(distInfo.length)), `Unexpected installed metadata: ${path}`);
	assert.ok(!Object.keys(inventory).some(path => path.startsWith(site + moduleDir) && path.includes("__pycache__"))
		, "Compiled bytecode is absent from the installed package");
	return { site, files: Object.values(inventory).filter(entry => entry.kind === "file").length };
};
