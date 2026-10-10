/**
 * Consumer and author guides cite each accepted scalar Fin entry-counter archive with its measured check
 * counts and keep the scalar-only, local scope (VO #1425).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import test from "node:test";

/** Each canonical guide, its archive, the reports and profile whose checks it states, and its counting method. */
const guides = [
	{ guide: "docs/php.md", archive: "docs/evidence/php-fin-dispatch-20261008", reports: ["php.json", "php-reviewed.json"], profile: "php-native", checks: "2,028", method: "An `LD_PRELOAD` interposer counted the entries", exclusions: "not nested refinements, PHP-Wasm or other platforms" }
	, { guide: "docs/consume/ruby.md", archive: "docs/evidence/ruby-fin-dispatch-20261009", reports: ["ruby.json", "ruby-reviewed.json"], profile: "ruby", checks: "2,029", method: "GDB counted the actual Lean source and adapter entries", exclusions: "not nested refinements or other platforms" }
	, { guide: "docs/consume/dotnet.md", archive: "docs/evidence/dotnet-fin-dispatch-20261009", reports: ["dotnet.json", "dotnet-reviewed.json"], profile: "dotnet", checks: "2,022", method: "The measurement instruments process memory", exclusions: "not nested refinements or other platforms" }
	, { guide: "docs/consume/java.md", archive: "docs/evidence/jvm-fin-dispatch-20261009", reports: ["jvm.json", "jvm-reviewed.json"], profile: "java", checks: "2,023", method: "GDB counted the entries in the one verified directory the JAR extracted", exclusions: "not containers, nested refinements or other platforms" }
	, { guide: "docs/consume/kotlin.md", archive: "docs/evidence/jvm-fin-dispatch-20261009", reports: ["jvm.json", "jvm-reviewed.json"], profile: "kotlin", checks: "2,022", method: "GDB counted the entries in the one verified directory the JAR extracted", exclusions: "not containers, nested refinements or other platforms" }
	, { guide: "docs/consume/wit-wasi.md", archive: "docs/evidence/wit-fin-dispatch-20261008", reports: ["wit.json", "wit-reviewed.json"], profile: "wit-wasi", checks: "2,027", method: "An `LD_PRELOAD` interposer counted the entries", exclusions: "not record or variant fields, containers or other platforms" }
];
const checksOf = item => item.checks ?? item.observation.checks;

test("each consumer guide cites its scalar entry-counter receipt once, with the measured checks and scalar-only scope", async () => {
	for(const { guide, archive, reports, profile, checks, method, exclusions } of guides)
	{
		const text = await readFile(guide, "utf8");
		const paragraphs = text.split("\n\n").filter(paragraph => paragraph.includes("[scalar entry-counter receipt]("));
		assert.equal(paragraphs.length, 1, guide);
		const [paragraph] = paragraphs, link = /\[scalar entry-counter receipt\]\(([^)]+)\)/u.exec(paragraph)[1];
		assert.equal(normalize(join(dirname(guide), link)), `${archive}/receipt.json`, guide);
		await readFile(`${archive}/receipt.json`);
		// Sentence case differs between guides; the measured facts and the scope limits do not.
		const lower = paragraph.toLowerCase();
		for(const phrase of ["ordinary-source and reviewed-IR", "rejected `mirror`", "entered neither", "valid calls, including those after rejected ones, entered their own source and adapter once", `passed ${checks} checks`, "glibc 2.36 package floor", method, `It covers these top-level scalar calls, ${exclusions}.`])
			assert.ok(lower.includes(phrase.toLowerCase()), `${guide}: ${phrase}`);
		// The stated count is every report's own count for this caller, on both routes.
		for(const name of reports)
		{
			const items = JSON.parse(await readFile(`${archive}/${name}`, "utf8")).reports.filter(item => item.profile === profile);
			assert.equal(items.length, 1, `${archive}/${name} ${profile}`);
			assert.equal(checksOf(items[0]).toLocaleString("en-US"), checks, `${archive}/${name} ${profile}`);
		}
	}
});

test("the Java and Kotlin guides cite installed product and field acceptance and keep callbacks rejected", async () => {
	for(const guide of ["docs/consume/java.md", "docs/consume/kotlin.md"])
	{
		const text = await readFile(guide, "utf8");
		assert.ok(!text.includes("Fields, callbacks, products and results are not"), guide);
		assert.ok(text.includes("Top-level parameters and results are supported, including inside `Array`, `List` and `Option`"), guide);
		assert.ok(text.includes("Both ordinary-source and independently reviewed packages also check Fin inside pairs, active `Except` branches and plain record or variant fields, including Array/List/Option compositions."), guide);
		assert.ok(text.includes("[hosted product and field checks](../evidence/fin-native-hosted-20261010/receipt.json)"), guide);
		assert.ok(text.includes("`Fin` in callback signatures is rejected at build time."), guide);
		assert.ok(!text.includes("installed acceptance for those shapes is not yet recorded"), guide);
	}
});

test("the author guide names every measured host's receipt and keeps library identity separate from counts", async () => {
	const text = await readFile("docs/lean/existing-package.md", "utf8");
	const [paragraph] = text.split("\n\n").filter(item => item.startsWith("Separate scalar measurements count actual Lean source and adapter entries"));
	assert.ok(paragraph);
	const links = [...paragraph.matchAll(/\]\(\.\.\/evidence\/([^/]+)\/receipt\.json\)/gu)].map(match => match[1]);
	assert.deepEqual(links, [...new Set(guides.map(item => item.archive.split("/").at(-1)))].sort((a, b) => ["php", "ruby", "dotnet", "jvm", "wit"].indexOf(a.split("-")[0]) - ["php", "ruby", "dotnet", "jvm", "wit"].indexOf(b.split("-")[0])));
	assert.ok(paragraph.includes("Matching bundled library bytes alone does not establish dispatch counts."));
	assert.ok(text.includes("has installed record/variant checks, including records and variants inside arrays, lists, options, pairs and `Except`."));
});
