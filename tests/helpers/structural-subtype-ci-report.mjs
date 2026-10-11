/**
 * Require an exact installed structural Subtype lane, author route and original TAP.
 *
 * @file
 */
import assert from "node:assert/strict";

export const structuralSubtypeCiLanes = Object.freeze([
	"c-cpp", "python311", "python312", "rust", "ruby", "dotnet", "jvm"
	, "php-native", "wit-wasi", "perl", "node-browser", "php-wasm"
]);
const implementations = {
	"c-cpp": ["native", "Native"]
	, python311: ["python", "Python"], python312: ["python", "Python"]
	, rust: ["rust", "Rust"], ruby: ["ruby", "Ruby"]
	, dotnet: ["dotnet", "Dotnet"], jvm: ["jvm", "Jvm"]
	, "php-native": ["php", "Php"], "wit-wasi": ["wit", "Wit"]
	, perl: ["perl", "Perl"], "node-browser": ["browser", "Browser"]
	, "php-wasm": ["php-wasm", "PhpWasm"]
};

/**
 * Names select installed producers, not their source-only or archive tests.
 *
 * @param lane - Explicit required CI host lane.
 * @param route - Ordinary source or independent review.
 */
export const structuralSubtypeCiTestName = (lane, route) => {
	assert.ok(structuralSubtypeCiLanes.includes(lane)); assert.ok(["ordinary", "reviewed"].includes(route));
	if(lane === "c-cpp") return `installed structural Subtypes reproduce and relocate ${route}`;
	if(lane === "node-browser") return `installed npm structural Subtypes reproduce and relocate ${route}`;
	if(lane === "perl") return `installed structural-subtype Perl packages reproduce and relocate both delivery modes for ${route}`;
	const host = {
		python311: "Python 3.11", python312: "Python 3.12", rust: "Rust"
		, ruby: "Ruby", dotnet: "Dotnet", jvm: "JVM", "php-native": "PHP"
		, "wit-wasi": "WIT", "php-wasm": "PHP-Wasm"
	}[lane];
	return `installed structural Subtypes ${host} ${route} reproduce and relocate`;
};

/**
 * Parse a closed option set before opening any records.
 *
 * @param args - Arguments following the executable script name.
 */
export const parseStructuralSubtypeCiArgs = args => {
	const usage = "Usage: check-structural-subtype-ci.mjs --lane <lane> --route ordinary|reviewed --producer <commit> --directory <records> --tap <original-tap> [--glibc 2.36|2.38]";
	const allowed = ["lane", "route", "producer", "directory", "tap", "glibc"], selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string" && value.length > 0 && !value.startsWith("--") && !value.includes("\0"), usage);
		selected[key] = value;
	}
	for(const key of allowed.filter(key => key !== "glibc")) assert.ok(Object.hasOwn(selected, key), usage);
	structuralSubtypeCiTestName(selected.lane, selected.route);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.equal(Object.hasOwn(selected, "glibc"), !["node-browser", "php-wasm"].includes(selected.lane), usage);
	if(selected.glibc) assert.ok(["2.36", "2.38"].includes(selected.glibc), usage);
	return selected;
};

/**
 * A matching success line is insufficient without exactly one complete, zero-skip TAP run.
 *
 * @param source - Original combined producer output.
 * @param lane - Required host lane.
 * @param route - Required author route.
 */
export const assertStructuralSubtypeCiTap = (source, lane, route) => {
	const name = structuralSubtypeCiTestName(lane, route);
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
};

/**
 * Use the full installed report checker for each lane; never reopen recorded producer paths.
 *
 * @param options - Closed parsed lane and producer options.
 * @param original - Original TAP bytes and route-relative file reader.
 * @param original.tap - Combined producer stdout/stderr.
 * @param original.read - Archive-relative records, not reported historical locations.
 */
export const checkStructuralSubtypeCiRecords = async (options, { tap, read }) => {
	const selected = parseStructuralSubtypeCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertStructuralSubtypeCiTap(tap, selected.lane, selected.route);
	const report = JSON.parse(await read("report.json"));
	assert.equal(report.route, selected.route); assert.equal(report.producerCommit, selected.producer);
	if(selected.glibc) assert.equal(selected.lane === "perl" ? report.glibcMinimumVersion : report.declaredGlibcFloor, selected.glibc);
	const [module, name] = implementations[selected.lane];
	const checker = (await import(`./structural-subtype-${module}-report.mjs`))[`checkStructuralSubtype${name}Report`];
	assert.equal(typeof checker, "function");
	const result = await checker(read, {
		route: selected.route, producerCommit: selected.producer
		, ...selected.lane.startsWith("python") ? { minor: selected.lane === "python311" ? "3.11" : "3.12" } : {} });
	return { lane: selected.lane, ...result };
};
