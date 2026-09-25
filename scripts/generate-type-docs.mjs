/**
 * Render consumer conversion tables from position- and path-scoped type evidence.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";

export const typeGuideProfiles = Object.freeze({
	"docs/javascript-typescript.md": ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"]
	, "docs/php.md": ["php-native", "php-wasm"]
	, ...Object.fromEntries(["dotnet", "java", "kotlin", "ruby", "perl", "python", "rust", "c", "cpp", "wit-wasi"]
		.map(profile => [`docs/consume/${profile}.md`, [profile]]))
});

const names = {
	"node-javascript": "Node JavaScript"
	, "node-typescript": "TypeScript"
	, "browser-javascript": "Browser"
	, "browser-react": "React"
	, "browser-worker": "Worker"
	, "php-native": "Native PHP"
	, "php-wasm": "PHP-Wasm"
	, dotnet: "C#"
	, java: "Java"
	, kotlin: "Kotlin"
	, ruby: "Ruby"
	, perl: "Perl"
	, python: "Python"
	, rust: "Rust"
	, c: "C"
	, cpp: "C++"
	, "wit-wasi": "WIT/WASI"
};
const positions = { parameter: "input", result: "result", field: "field", "callback-parameter": "callback input", "callback-result": "callback result", signature: "signature" };
const paths = { "ordinary-source": "Ordinary source", "reviewed-ir": "Reviewed IR" };
const escapeCell = value => String(value).replaceAll("|", "\\|").replace(/\s+/gu, " ").trim();
const inline = value => `\`${String(value).replaceAll("`", "'")}\``;
const table = (headings, rows) => [headings, headings.map(() => "---"), ...rows]
	.map(row => `| ${row.map(escapeCell).join(" | ")} |`).join("\n");
const unique = values => [...new Set(values)];

/**
 * Classify a single cell without borrowing evidence from another stage or position.
 *
 * @param cell - One expanded, validated inventory cell.
 */
export function cellTypeCoverage(cell)
{
	const stages = cell.stages;
	if(stages.installedExecution.state === "passed") return "Installed checks passed";
	if(stages.installedExecution.state === "limited") return "Installed checks: limited";
	if(stages.installedExecution.state === "rejected") return "Installed execution rejected";
	if(stages.packaging.state === "rejected") return "Packaging rejected";
	if(stages.compilation.state === "rejected") return "Compilation rejected";
	if(stages.generation.state === "rejected") return "Generation rejected";
	if(stages.analysis.state === "rejected") return "Analysis rejected";
	if(stages.packaging.state === "passed") return "Packaged; execution unaudited";
	if(stages.compilation.state === "passed") return "Compiled; installation unaudited";
	if(stages.generation.state === "passed") return "Generation tested; compilation unaudited";
	if(stages.generation.state === "limited") return "Generation tested: limited";
	if(stages.generation.state === "inspected") return cell.hostType === null ? "Inspected: no host mapping" : "Generator inspected";
	if(stages.analysis.state === "inspected") return "Analyzer inspected";
	return "Not audited";
}

const groupedProfiles = (profiles, project) => {
	const groups = new Map();
	for(const profile of profiles)
	{
		const value = project(profile);
		if(value === "") continue;
		if(!groups.has(value)) groups.set(value, []);
		groups.get(value).push(names[profile]);
	}
	return [...groups].map(([value, group]) => profiles.length === 1 || group.length === profiles.length
		? value : `${group.join(" / ")}: ${value}`).join("; ");
};

const coverageText = (cells, profiles) => Object.entries(paths).map(([source, label]) => {
	const description = groupedProfiles(profiles, profile => {
		const selected = cells.filter(cell => cell.profile === profile && cell.path === source);
		const groups = new Map();
		for(const cell of selected)
		{
			const state = cellTypeCoverage(cell);
			if(!groups.has(state)) groups.set(state, []);
			groups.get(state).push(positions[cell.position]);
		}
		const descriptions = [...groups].map(([state, sites]) => groups.size === 1
			? state : `${state} (${sites.join(", ")})`);
		return descriptions.join("; ");
	});
	return `${label}: ${description}`;
}).join(". ");

const hostText = (cells, profiles) => groupedProfiles(profiles, profile => {
	const selected = cells.filter(cell => cell.profile === profile && cell.hostType !== null);
	const groups = new Map();
	for(const cell of selected)
	{
		if(!groups.has(cell.hostType)) groups.set(cell.hostType, []);
		groups.get(cell.hostType).push(positions[cell.position]);
	}
	if(groups.size === 0) return "No host mapping recorded";
	return [...groups].map(([type, sites]) => `${inline(type)} (${unique(sites).join(", ")})`).join("; ");
});

/**
 * Render every inventoried shape for an exact set of consumer profiles.
 *
 * @param inventory - Validated inventory and independent contracts.
 * @param inventory.document - Versioned type surface.
 * @param profiles - Exact runtime profiles, not inferred language aliases.
 * @param reference - Relative link to the shared type rules.
 */
export function renderTypeTable({ document, ...contracts }, profiles, reference)
{
	assert.ok(profiles.length > 0 && new Set(profiles).size === profiles.length, "Empty or duplicate type profiles");
	for(const profile of profiles) assert.ok(document.profiles.some(item => item.id === profile), `Unknown type profile ${profile}`);
	const cells = typeSurfaceCells(document, contracts).filter(cell => profiles.includes(cell.profile));
	const rows = document.shapes.map(shape => {
		const selected = cells.filter(cell => cell.shape === shape.id);
		const notes = groupedProfiles(profiles, profile => unique(selected.filter(cell => cell.profile === profile)
			.map(cell => cell.conversionNote).filter(Boolean)).join(" "));
		return [inline(shape.lean), hostText(selected, profiles), coverageText(selected, profiles), `${notes ? notes + " " : ""}Required: ${shape.bounds}`];
	});
	return [
		"### Type conversions"
		, ""
		, `Profiles: ${profiles.map(profile => names[profile]).join(", ")}. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.`
		, ""
		, `The [conversion rules](${reference}#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](${reference.replace(/reference\/types\.md$/u, "type-surface.v1.json")}) records commands, source hashes, limitations and implementation owners.`
		, ""
		, table(["Lean type or source form", "Host representation", "Current evidence", "Conversion rules"], rows)
		, ""
	].join("\n");
}

/**
 * Replace only the generated section, retaining every installation step and old URL.
 *
 * @param source - Existing canonical consumer guide.
 * @param section - Generated Type conversions section.
 */
export function replaceTypeSection(source, section)
{
	const heading = "### Type conversions\n";
	assert.equal(source.split(heading).length, 2, "Each guide needs exactly one Type conversions heading");
	const start = source.indexOf(heading);
	const rest = source.slice(start + heading.length);
	const end = rest.search(/^#{1,3} /mu);
	assert.ok(end >= 0, "The generated type section needs a following guide section");
	return source.slice(0, start) + section + "\n" + rest.slice(end);
}

/**
 * Render guide sections and the shared inventory reference without writing.
 *
 * @param options - Canonical source location.
 * @param options.root - Repository root.
 */
export async function renderTypeDocuments({ root })
{
	const inventory = await readTypeSurface({ repository: root });
	const documents = {};
	for(const [filename, profiles] of Object.entries(typeGuideProfiles))
	{
		const reference = path.posix.relative(path.posix.dirname(filename), "docs/reference/types.md");
		const source = await readFile(path.join(root, filename), "utf8");
		documents[filename] = replaceTypeSection(source, renderTypeTable(inventory, profiles, reference));
	}
	const { document } = inventory;
	const profileRows = document.profiles.map(profile => {
		const guide = Object.entries(typeGuideProfiles).find(([, profiles]) => profiles.includes(profile.id))[0];
		const relative = path.posix.relative("docs/reference", guide);
		return [`[${names[profile.id]}](${relative}#type-conversions)`, profile.context, profile.wordBits === null ? "Not audited" : `${profile.wordBits}-bit Lean target`];
	});
	const shapeRows = document.shapes.map(shape => {
		const rule = document.rules[document.families[shape.family].rule];
		return [inline(shape.lean), shape.meaning, shape.bounds, `${rule.ownership} ${rule.absence} ${rule.failure}`];
	});
	return {
		documents
		, reference: [
			`Inventory ${document.contractVersion} covers ${document.shapes.length} source forms and ${document.profiles.length} consumer profiles. The language tables distinguish ordinary-source packages from reviewed-IR profiles and retain unaudited cells.`
			, ""
			, table(["Consumer table", "Runtime context", "Compiled Lean width"], profileRows)
			, ""
			, table(["Lean type or source form", "Meaning", "Bounds and representation", "Ownership, absence and failure"], shapeRows)
			, ""
			, "Both ordinary-source and compiler-checked reviewed packages have installed corpus runs across all seventeen consumer profiles. The [native](../evidence/reviewed-native-20260918.md) and [Wasm](../evidence/reviewed-wasm-20260918.md) records list tested signatures and gaps. All profiles accept nineteen primitive parameter/result types, including [Char in npm](../evidence/char-npm-20260918.md), [native/PHP-Wasm Char](../evidence/char-native-20260918.md), and [USize/ISize](../evidence/platform-words-20260918.md). All profiles also accept copied arrays and acyclic records containing these primitives."
			, ""
			, "Platform integers follow the compiled Lean target: npm and PHP-Wasm use 32-bit words; native packages and native-backed WIT components use 64-bit words. Host adapters check those ranges before calling Lean. The consumer's pointer width does not select the range. Lean arithmetic still wraps at its compiled word width."
			, ""
			, "All seventeen profiles have installed checks for synchronous primitive callbacks and returned Lean functions on both source paths. The [npm callable record](../evidence/npm-callables-20260919.md) covers Node, strict TypeScript, Chromium and Firefox, including React and workers. These shared callable checks use one through sixteen primitive arguments and a primitive result. All seventeen profiles also accept acyclic copied callback payloads. npm, C, C++, Python and Rust additionally accept recursive callback values. Recursive callbacks in the remaining eight profiles and asynchronous callables require further work."
			, ""
			, "The tables retain the separately audited type/position inventory, including older Alpha-only generator observations. Standalone Binding IR generators and compiler-backed packages have different coverage: Rust's older Alpha resource projection rejects arbitrary-precision integers; its copied-value generator and compiled packages use BigUint and BigInt. npm's [copied-array ABI](../evidence/npm-arrays-20260920.md) supports nested arrays of all nineteen primitives on both source paths in Node, strict TypeScript, Chromium, Firefox and WebKit, including React and workers. Its [record ABI](../evidence/npm-records-20260920.md) adds named copied structures, including primitive fields, nested records and arrays of records in the same contexts. Its [compound ABI](../evidence/npm-compounds-20260920.md) preserves explicit Option tags, Except success/error branches and nested binary products, including arrays and record fields. These constructors are installed-tested on both npm source paths in all three browser engines. [Perl arrays and records](../evidence/perl-collections-20260921.md) have installed checks for all nineteen primitives, nested arrays and seven named structures on both source paths and four pinned ABIs. [C/C++ arrays and records](../evidence/native-collections-20260921.md) have installed checks for all nineteen primitives, seven records and 24 fixed Array levels on both source paths, including independent copies and allocation-failure cleanup. [Ruby arrays and records](../evidence/ruby-collections-20260922.md) have installed checks for every primitive, seven records and 24 fixed Array levels on both source paths, including builtin-bound snapshots, value equality and failure cleanup. [C# arrays and records](../evidence/dotnet-collections-20260922.md) have installed checks for all nineteen primitives, seven records and 24 fixed Array levels on both source paths, including structural record equality, matching hashes, failure cleanup and runtime-only execution. [Python arrays and records](../evidence/python-collections-20260922.md) have installed checks for all nineteen primitives, seven records and 24 fixed Array levels on both source paths across Python 3.11 and 3.12, including automatic typing dependencies, bounded runtime annotations, strict public types and failure cleanup. [Rust arrays and records](../evidence/rust-collections-20260922.md) have installed checks for all nineteen primitives, seven records and 24 fixed Array levels on both source paths, including exact typed callers, independently owned results, allocation/panic cleanup and source-free execution. [C/C++](../evidence/native-compounds-20260920.md), [Python](../evidence/python-compounds-20260920.md), [Rust](../evidence/rust-compounds-20260920.md), [C#](../evidence/dotnet-compounds-20260920.md), [Java/Kotlin](../evidence/jvm-compounds-20260920.md), [Ruby](../evidence/ruby-compounds-20260920.md), [Perl](../evidence/perl-compounds-20260920.md), [native PHP](../evidence/php-native-compounds-20260920.md), [PHP-Wasm](../evidence/php-wasm-compounds-20260920.md) and [WIT/WASI](../evidence/wit-compounds-20260920.md) also have installed compound checks on both source paths. npm also has [installed List checks](../evidence/npm-lists-20260920.md) for all nineteen primitive elements and nested copied values on both source paths in all five npm profiles. Lists retain a distinct IR constructor and use ordinary host arrays. [C/C++ Lists](../evidence/native-lists-20260920.md) have installed checks on both source paths, using typed spans and owned vectors. [Python Lists](../evidence/python-lists-20260920.md) accept exact lists or tuples and return owned tuples, with installed checks on both source paths. [Rust Lists](../evidence/rust-lists-20260920.md) borrow slices and return owned vectors, with installed checks on both source paths. [C# Lists](../evidence/dotnet-lists-20260920.md) use copied typed arrays, with installed checks and SDK-free deployment on both source paths. [Java/Kotlin Lists](../evidence/jvm-lists-20260920.md) use primitive or reference arrays, with independently compiled consumers and runtime-only deployment on both paths. [Ruby Lists](../evidence/ruby-lists-20260921.md) use copied Arrays, with installed checks and relocated gem execution on both paths. [Perl Lists](../evidence/perl-lists-20260921.md) use plain array references, with installed checks on both source paths and all four pinned Perl ABIs. [Native PHP Lists](../evidence/php-native-lists-20260921.md) use consecutive-key arrays, with installed weak/strict checks on both source paths. [PHP-Wasm Lists](../evidence/php-wasm-lists-20260921.md) use consecutive-key arrays with 32-bit PHP mappings, with installed Node/Chromium checks on both source paths. [WIT/WASI Lists](../evidence/wit-lists-20260921.md) use canonical lists through the packaged Wasmtime host, with installed checks on both source paths. Copied Lists and transparent aliases now cover all seventeen consumer profiles, including [WIT/WASI aliases](../evidence/wit-aliases-20260921.md). Concrete, non-recursive tagged variants have installed checks in all five [npm profiles](../evidence/npm-variants-20260921.md), [C++](../evidence/cpp-variants-20260921.md), [C/C-GMP](../evidence/c-variants-20260921.md), [Python](../evidence/python-variants-20260921.md), [Rust](../evidence/rust-variants-20260921.md), [C#](../evidence/dotnet-variants-20260921.md), [Java/Kotlin](../evidence/jvm-variants-20260921.md), [Ruby](../evidence/ruby-variants-20260921.md), [Perl](../evidence/perl-variants-20260921.md), [native PHP](../evidence/php-native-variants-20260921.md), [PHP-Wasm](../evidence/php-wasm-variants-20260921.md) and [WIT/WASI](../evidence/wit-variants-20260921.md). [Recursive npm values](../evidence/npm-recursive-20260922.md) have installed checks on both source paths across all five npm profiles, including Chromium, Firefox and WebKit. [Recursive C/C++ packages](../evidence/native-recursive-packages-20260923.md) also pass installed checks on both source paths, including source-free deployment. [Recursive Rust packages](../evidence/rust-recursive-packages-20260923.md), [Python wheels](../evidence/python-recursive-packages-20260923.md), [Ruby gems](../evidence/ruby-recursive-packages-20260923.md) and [Perl CPAN archives](../evidence/perl-recursive-packages-20260923.md) have installed checks on both source paths. Perl covers four pinned ABIs and both prebuilt-only and generated-XS-only installation. [C#, Java, Kotlin, native PHP and PHP-Wasm](../evidence/recursive-managed-acceptance-20260924.md) also pass installed recursive checks on both source paths. [WIT/WASI acceptance](../evidence/wit-recursive-acceptance-20260924.md) completes the copied family. Recursive copied values have installed checks across all seventeen profiles. [Structured C callbacks](../evidence/c-structured-callables-20260924.md), [C++ callbacks](../evidence/cpp-structured-callables-20260924.md), [Rust callbacks](../evidence/rust-structured-callables-20260924.md), [Python callbacks](../evidence/python-structured-callables-20260924.md), [Ruby callbacks](../evidence/ruby-structured-callables-20260924.md), [C# callbacks](../evidence/dotnet-structured-callables-20260924.md), [Java/Kotlin callbacks](../evidence/jvm-structured-callables-20260925.md), [Perl callbacks](../evidence/perl-structured-callables-20260925.md), [native PHP callbacks](../evidence/php-structured-callables-20260925.md), [PHP-Wasm callbacks](../evidence/php-wasm-structured-callables-20260925.md) and [WIT/WASI callbacks](../evidence/wit-structured-callables-20260925.md) additionally have installed checks for arrays, Lists, options, results, products, acyclic records, variants and aliases. [Structured npm callbacks](../evidence/npm-structured-callables-20260925.md) have installed checks for all nine copied shapes, including recursive values, across Node, TypeScript, Chromium, Firefox and WebKit page, React and worker contexts. C and C++ have [installed recursive callback checks](../evidence/native-recursive-callables-20260925.md), as do [Python](../evidence/python-recursive-callables-20260925.md) and [Rust](../evidence/rust-recursive-callables-20260925.md). Recursive callbacks in the remaining eight profiles and explicitly owned resource aggregates remain assigned work. Missing mappings and positions remain assigned work in the [type inventory](../type-surface.v1.json)."
		].join("\n")
	};
}
