/**
 * Bind Cargo's resolved package graph and compiler messages to the frozen lock.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { inheritedCheckedRecordRustLockedPackages } from "./inherited-checked-record-rust-dependency-records.mjs";

const registry = "registry+https://github.com/rust-lang/crates.io-index";
const inputNames = [
	"first", "normalized", "pair", "aliased", "nested", "echo"
];
const features = {
	"crypto-common": ["std"]
	, digest: ["alloc", "block-buffer", "core-api", "default", "std"]
	, "generic-array": ["more_lengths"], "num-bigint": ["default", "std"]
	, "num-integer": ["i128", "std"], "num-traits": ["i128", "std"]
	, sha2: ["default", "std"]
};
const within = (path, root) => assert.ok(typeof path === "string" && path.startsWith(root + "/") && posix.normalize(path) === path && !/[\0\r\n]/u.test(path));

/**
 * Check every resolved edge, package origin, target path and public dependency.
 *
 * @param options - Original Cargo output and authenticated lock/member records.
 * @param options.run - Original successful metadata command result.
 * @param options.root - Recorded consumer root, never opened by this checker.
 * @param options.lock - Frozen crate Cargo.lock.
 * @param options.read - Retained original member reader.
 */
export const checkInheritedCheckedRecordRustMetadata = async ({ run, root, lock, read }) => {
	assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
	assert.equal(run.code, 0); assert.equal(run.stderr, "");
	const metadata = JSON.parse(run.stdout), packages = inheritedCheckedRecordRustLockedPackages(lock);
	packages.push({ name: "inherited-consumer", version: "0.0.0", source: null, dependencies: ["inheritedcheckedrecords"] });
	assert.deepEqual(Object.keys(metadata).sort(), ["metadata", "packages", "resolve", "target_directory", "version", "workspace_default_members", "workspace_members", "workspace_root"]);
	assert.equal(metadata.version, 1); assert.equal(metadata.metadata, null);
	assert.equal(metadata.workspace_root, root); assert.equal(metadata.target_directory, root + "/target");
	const directory = pkg => pkg.name === "inherited-consumer" ? root : root + "/vendor/" + (pkg.source ? "dependencies/" : "") + `${pkg.name}-${pkg.version}`;
	const id = pkg => pkg.source ? `${registry}#${pkg.name}@${pkg.version}` : `path+file://${directory(pkg)}#${pkg.name}@${pkg.version}`;
	const byName = new Map(packages.map(pkg => [pkg.name, pkg])), consumerId = id(byName.get("inherited-consumer"));
	assert.deepEqual(metadata.workspace_members, [consumerId]); assert.deepEqual(metadata.workspace_default_members, [consumerId]);
	assert.deepEqual(metadata.packages.map(pkg => pkg.name).sort(), [...byName.keys()].sort());
	for(const pkg of metadata.packages)
	{
		const pinned = byName.get(pkg.name), path = directory(pinned);
		assert.equal(pkg.version, pinned.version); assert.equal(pkg.source, pinned.source); assert.equal(pkg.id, id(pinned));
		assert.equal(pkg.manifest_path, path + "/Cargo.toml");
		let paths;
		if(pkg.source) paths = Object.keys(JSON.parse(await read(`dependency-manifests/${pkg.name}-${pkg.version}.json`)).files);
		else if(pkg.name === "inheritedcheckedrecords") paths = ["src/lib.rs"];
		else paths = ["src/main.rs", "src/bin/api-probe.rs"];
		assert.ok(pkg.targets.length > 0);
		for(const target of pkg.targets)
		{
			within(target.src_path, path); assert.ok(paths.includes(target.src_path.slice(path.length + 1)));
		}
		if(!pkg.source)
		{
			assert.deepEqual(pkg.targets.map(target => [target.name, target.kind, target.crate_types, target.src_path]).sort(), pkg.name === "inheritedcheckedrecords"
				? [["inheritedcheckedrecords", ["lib"], ["lib"], path + "/src/lib.rs"]]
				: [["api-probe", ["bin"], ["bin"], path + "/src/bin/api-probe.rs"], ["inherited-consumer", ["bin"], ["bin"], path + "/src/main.rs"]]);
			assert.deepEqual(pkg.features, pkg.name === "inherited-consumer" ? { "result-only": [], reviewed: [] } : {});
			assert.deepEqual(pkg.dependencies.map(dependency => [dependency.name, dependency.source, dependency.req, dependency.kind, dependency.optional, dependency.uses_default_features, dependency.features, dependency.path ?? null]), pkg.name === "inherited-consumer"
				? [["inheritedcheckedrecords", null, "*", null, false, true, [], directory(byName.get("inheritedcheckedrecords"))]]
				: [["num-bigint", registry, "=0.4.6", null, false, true, [], null], ["sha2", registry, "=0.10.9", null, false, true, [], null]]);
		}
	}
	assert.deepEqual(Object.keys(metadata.resolve).sort(), ["nodes", "root"]); assert.equal(metadata.resolve.root, consumerId);
	assert.deepEqual(metadata.resolve.nodes.map(node => node.id).sort(), packages.map(id).sort());
	for(const node of metadata.resolve.nodes)
	{
		assert.deepEqual(Object.keys(node).sort(), ["dependencies", "deps", "features", "id"]);
		const pkg = packages.find(pkg => id(pkg) === node.id), publicRecord = metadata.packages.find(item => item.id === node.id);
		const edges = pkg.dependencies.map(name => id(byName.get(name))).sort();
		assert.deepEqual(node.dependencies, edges); assert.deepEqual(node.deps.map(dep => dep.pkg).sort(), edges);
		assert.deepEqual(node.features, features[pkg.name] ?? []);
		for(const edge of node.deps)
		{
			assert.deepEqual(Object.keys(edge).sort(), ["dep_kinds", "name", "pkg"]);
			const dependency = packages.find(item => id(item) === edge.pkg);
			assert.equal(edge.name, dependency.name.replaceAll("-", "_"));
			const kinds = publicRecord.dependencies.filter(item => item.name === dependency.name && item.kind !== "dev").map(item => ({ kind: item.kind, target: item.target }));
			assert.ok(kinds.length > 0); assert.deepEqual(edge.dep_kinds, kinds);
		}
	}
	return metadata;
};

/**
 * Accept only the expected API probe and complete compiler JSON stream.
 *
 * @param options - Original diagnostics and verified Cargo metadata.
 * @param options.run - Complete original Cargo check output.
 * @param options.metadata - Independently reconciled Cargo metadata.
 * @param options.mode - Full or result-only API selection.
 */
export const checkInheritedCheckedRecordRustCompilerRecords = ({ run, metadata, mode }) => {
	assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
	const stderr = run.stderr.trimEnd().split("\n"), terminal = stderr.pop(), checked = [];
	if(mode === "full") assert.match(terminal, /^ +Finished `dev` profile \[unoptimized\] target\(s\) in [0-9.]+s$/u);
	else assert.equal(terminal, 'error: could not compile `inherited-consumer` (bin "api-probe") due to 1 previous error');
	for(const line of stderr)
	{
		const match = line.match(/^ +Checking ([a-z0-9_-]+) v([0-9.]+)(?: \(([^)]+)\))?$/u); assert.ok(match);
		const pkg = metadata.packages.find(pkg => pkg.name === match[1]); assert.ok(pkg); assert.equal(match[2], pkg.version);
		assert.equal(match[3], pkg.source === null ? posix.dirname(pkg.manifest_path) : undefined); checked.push(pkg.name);
	}
	assert.deepEqual(checked.sort(), metadata.packages.filter(pkg => !["libc", "autocfg", "version_check"].includes(pkg.name)).map(pkg => pkg.name).sort());
	const messages = run.stdout.trim().split("\n").map(line => JSON.parse(line));
	const finished = { reason: "build-finished", success: mode === "full" };
	assert.deepEqual(messages.at(-1), finished);
	assert.deepEqual(messages.filter(item => item.reason === "build-finished"), [finished]);
	const errors = [], notes = [];
	for(const message of messages.slice(0, -1))
	{
		assert.ok(["compiler-artifact", "compiler-message", "build-script-executed"].includes(message.reason));
		const pkg = metadata.packages.find(pkg => pkg.id === message.package_id); assert.ok(pkg);
		if(message.reason === "build-script-executed")
		{ within(message.out_dir, metadata.target_directory); assert.ok(pkg.source); continue; }
		assert.equal(message.manifest_path, pkg.manifest_path);
		assert.deepEqual(message.target, pkg.targets.find(target => target.name === message.target.name));
		if(message.reason === "compiler-message")
		{
			assert.equal(pkg.name, "inherited-consumer"); assert.equal(message.target.name, "api-probe");
			if(message.message.level === "failure-note")
			{
				assert.equal(message.message.message, "For more information about this error, try `rustc --explain E0432`.");
				assert.deepEqual(message.message.spans, []); notes.push(message.message);
			}
			else
			{ assert.equal(message.message.level, "error"); errors.push(message.message); }
		}
		else
		{
			assert.ok(message.filenames.length > 0);
			for(const file of message.filenames) within(file, metadata.target_directory);
			assert.equal(message.profile.debuginfo, 0);
		}
	}
	assert.ok(messages.some(item => item.reason === "compiler-artifact" && item.target.name === "inheritedcheckedrecords"));
	if(mode === "full")
	{
		assert.equal(run.code, 0); assert.deepEqual(errors, []); assert.deepEqual(notes, []);
		assert.ok(messages.some(item => item.reason === "compiler-artifact" && item.target.name === "api-probe"));
		return { present: inputNames, absent: [] };
	}
	assert.equal(mode, "result-only"); assert.equal(run.code, 101); assert.equal(errors.length, 1); assert.equal(notes.length, 1);
	const error = errors[0]; assert.equal(error.code?.code, "E0432");
	const primary = error.spans.filter(span => span.is_primary); assert.ok(primary.length > 0);
	assert.ok(primary.every(span => span.file_name === "src/bin/api-probe.rs"));
	assert.deepEqual([...error.message.matchAll(/`inheritedcheckedrecords::([A-Za-z_0-9]+)`/gu)].map(match => match[1]).sort(), [...inputNames].sort());
	return { present: [], absent: inputNames };
};
