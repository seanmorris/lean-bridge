/**
 * Bind recursive Cargo metadata to the frozen lock and vendored manifests.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { recursiveCheckedRecordRustLockedPackages } from "./recursive-checked-record-rust-dependency-records.mjs";
import {
	recursiveCheckedRecordRustFeatures, recursiveCheckedRecordRustPackage
} from "./recursive-checked-record-rust-fixture.mjs";

const registry = "registry+https://github.com/rust-lang/crates.io-index";
const consumerName = "recursive-consumer";
const features = {
	"crypto-common": ["std"]
	, digest: ["alloc", "block-buffer", "core-api", "default", "std"]
	, "generic-array": ["more_lengths"]
	, "num-bigint": ["default", "std"]
	, "num-integer": ["i128", "std"]
	, "num-traits": ["i128", "std"]
	, sha2: ["default", "std"]
};
const within = (path, root) => assert.ok(typeof path === "string"
	&& path.startsWith(root + "/") && posix.normalize(path) === path
	&& !/[\0\r\n]/u.test(path));

/**
 * Check every resolved edge, package origin, target path and public dependency.
 *
 * @param options - Original Cargo output and authenticated records.
 * @param options.run - Original successful Cargo metadata result.
 * @param options.root - Recorded consumer root, never reopened by this checker.
 * @param options.lock - Frozen crate Cargo.lock.
 * @param options.read - Retained original member reader.
 * @param options.fixture - Recursive or mutually recursive graph.
 * @param options.route - Ordinary source or reviewed Binding IR.
 */
export const checkRecursiveCheckedRecordRustMetadata = async ({
	run, root, lock, read, fixture, route
}) => {
	assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
	assert.equal(run.code, 0);
	assert.equal(run.stderr, "");
	const metadata = JSON.parse(run.stdout);
	const publicPackage = recursiveCheckedRecordRustPackage(fixture);
	const packages = recursiveCheckedRecordRustLockedPackages(lock, fixture);
	packages.push({
		name: consumerName, version: "0.0.0", source: null
		, dependencies: [publicPackage.name]
	});
	assert.deepEqual(Object.keys(metadata).sort(), [
		"metadata", "packages", "resolve", "target_directory", "version"
		, "workspace_default_members", "workspace_members", "workspace_root"
	]);
	assert.equal(metadata.version, 1);
	assert.equal(metadata.metadata, null);
	assert.equal(metadata.workspace_root, root);
	assert.equal(metadata.target_directory, root + "/target");
	const directory = pkg => pkg.name === consumerName ? root
		: root + "/vendor/" + (pkg.source ? "dependencies/" : "")
			+ `${pkg.name}-${pkg.version}`;
	const id = pkg => pkg.source ? `${registry}#${pkg.name}@${pkg.version}`
		: `path+file://${directory(pkg)}#${pkg.name}@${pkg.version}`;
	const byName = new Map(packages.map(pkg => [pkg.name, pkg]));
	const consumerId = id(byName.get(consumerName));
	assert.deepEqual(metadata.workspace_members, [consumerId]);
	assert.deepEqual(metadata.workspace_default_members, [consumerId]);
	assert.deepEqual(metadata.packages.map(pkg => pkg.name).sort(), [...byName.keys()].sort());
	for(const pkg of metadata.packages)
	{
		const pinned = byName.get(pkg.name);
		const path = directory(pinned);
		assert.equal(pkg.version, pinned.version);
		assert.equal(pkg.source, pinned.source);
		assert.equal(pkg.id, id(pinned));
		assert.equal(pkg.manifest_path, path + "/Cargo.toml");
		let paths;
		if(pkg.source)
			paths = Object.keys(JSON.parse(await read(
				`dependency-manifests/${pkg.name}-${pkg.version}.json`)).files);
		else paths = pkg.name === publicPackage.name ? ["src/lib.rs"] : ["src/main.rs"];
		assert.ok(pkg.targets.length > 0);
		for(const target of pkg.targets)
		{
			within(target.src_path, path);
			assert.ok(paths.includes(target.src_path.slice(path.length + 1)));
		}
		if(!pkg.source)
		{
			assert.deepEqual(pkg.targets.map(target => [
				target.name, target.kind, target.crate_types, target.src_path
			]), [[pkg.name, [pkg.name === consumerName ? "bin" : "lib"]
				, [pkg.name === consumerName ? "bin" : "lib"]
				, path + (pkg.name === consumerName ? "/src/main.rs" : "/src/lib.rs")]]);
			assert.deepEqual(pkg.features, pkg.name === consumerName
				? { mutual: [], reviewed: [] } : {});
			assert.deepEqual(pkg.dependencies.map(dependency => [
				dependency.name, dependency.rename, dependency.source, dependency.req
				, dependency.kind, dependency.optional, dependency.uses_default_features
				, dependency.features, dependency.path ?? null
			]), pkg.name === consumerName ? [[
				publicPackage.name, "checkedrecords", null, "*", null, false, true, []
				, directory(byName.get(publicPackage.name))
			]] : [
				["num-bigint", null, registry, "=0.4.6", null, false, true, [], null]
				, ["sha2", null, registry, "=0.10.9", null, false, true, [], null]
			]);
		}
	}
	assert.deepEqual(Object.keys(metadata.resolve).sort(), ["nodes", "root"]);
	assert.equal(metadata.resolve.root, consumerId);
	assert.deepEqual(metadata.resolve.nodes.map(node => node.id).sort()
		, packages.map(id).sort());
	for(const node of metadata.resolve.nodes)
	{
		assert.deepEqual(Object.keys(node).sort(), ["dependencies", "deps", "features", "id"]);
		const pkg = packages.find(item => id(item) === node.id);
		const publicRecord = metadata.packages.find(item => item.id === node.id);
		const edges = pkg.dependencies.map(name => id(byName.get(name))).sort();
		assert.deepEqual(node.dependencies, edges);
		assert.deepEqual(node.deps.map(dependency => dependency.pkg).sort(), edges);
		assert.deepEqual(node.features, pkg.name === consumerName
			? recursiveCheckedRecordRustFeatures(route, fixture) : features[pkg.name] ?? []);
		for(const edge of node.deps)
		{
			assert.deepEqual(Object.keys(edge).sort(), ["dep_kinds", "name", "pkg"]);
			const dependency = packages.find(item => id(item) === edge.pkg);
			assert.equal(edge.name, pkg.name === consumerName && dependency.name === publicPackage.name
				? "checkedrecords" : dependency.name.replaceAll("-", "_"));
			const kinds = publicRecord.dependencies.filter(item => item.name === dependency.name
				&& item.kind !== "dev").map(item => ({ kind: item.kind, target: item.target }));
			assert.ok(kinds.length > 0);
			assert.deepEqual(edge.dep_kinds, kinds);
		}
	}
	return metadata;
};
