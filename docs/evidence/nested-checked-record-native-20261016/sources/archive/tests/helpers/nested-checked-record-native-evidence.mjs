/**
 * Fixed identities and historical source closure for nested checked-record C/C++ evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

export const nestedCheckedRecordNativeEvidence
	= "docs/evidence/nested-checked-record-native-20261016";
export const nestedCheckedRecordNativeProducer
	= "170199a8212af2d3107cf0769902a8e374ff89c5";
export const nestedCheckedRecordNativeSelections = Object.freeze([
	Object.freeze({ route: "ordinary", mode: "full"
		, root: "build/vo1501-nested-native-ordinary-full-r1-170199a8212a/ordinary/full" })
	, Object.freeze({ route: "ordinary", mode: "result-only"
		, root: "build/vo1501-nested-native-ordinary-result-only-r1-170199a8212a/ordinary/result-only" })
	, Object.freeze({ route: "reviewed", mode: "full"
		, root: "build/vo1501-nested-native-reviewed-full-r1-170199a8212a/reviewed/full" })
	, Object.freeze({ route: "reviewed", mode: "result-only"
		, root: "build/vo1501-nested-native-reviewed-result-only-r1-170199a8212a/reviewed/result-only" })
]);
export const nestedCheckedRecordNativeSourceEntries = Object.freeze([
	"tests/nested-checked-record-native.test.mjs"
]);
export const nestedCheckedRecordNativeSourceData = Object.freeze([
	"LICENSE"
	, "poc/lean-link-spike/bindings/alpha.binding-ir.json"
	, "poc/lean-link-spike/graph-lock.json"
	, "src/analyze/NativeExports.lean"
	, "src/backends/c/gmp.source.tar.xz"
	, "src/backends/cpp/boost.source.json"
	, ...["LICENSE", "NestedCheckedRecords.lean", "lakefile.toml", "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/nested-checked-records/${path}`)
	, ...["c.c", "cpp.cpp"]
		.map(path => `tests/fixtures/nested-checked-record-consumers/${path}`)
].sort());

const source = new Map();

/**
 * Read one exact producer file without consulting the current worktree.
 *
 * @param path - Repository-relative producer path.
 */
export const nestedCheckedRecordNativeOriginal = path => {
	assert.equal(posix.normalize(path), path);
	assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
	if(!source.has(path)) source.set(path, execFileSync("git", ["show"
		, `${nestedCheckedRecordNativeProducer}:${path}`], { maxBuffer: 64 * 1024 * 1024 }));
	return Buffer.from(source.get(path));
};

let closure;

/**
 * Resolve the producer's relative JavaScript module closure from historical bytes.
 * Explicit data files cover inputs reached through filesystem reads rather than imports.
 */
export const nestedCheckedRecordNativeSelectedSources = () => {
	if(closure) return [...closure];
	const found = new Set();
	const visit = path => {
		assert.equal(posix.normalize(path), path);
		if(found.has(path)) return;
		found.add(path);
		const bytes = nestedCheckedRecordNativeOriginal(path);
		if(!/\.[cm]?js$/u.test(path)) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			let child = posix.normalize(posix.join(posix.dirname(path), specifier));
			if(posix.extname(child) === "") child += ".mjs";
			visit(child);
		}
	};
	for(const path of nestedCheckedRecordNativeSourceEntries) visit(path);
	for(const path of nestedCheckedRecordNativeSourceData) found.add(path);
	closure = Object.freeze([...found].sort());
	return [...closure];
};
