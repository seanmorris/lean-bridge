/**
 * Independent public Perl callers reused across original recursive packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Retain every earlier value assertion while adapting namespace and diagnostics. */
export const perlRecursiveAcyclicConsumer = async () => {
	const values = await readFile("tests/fixtures/structured-callable-consumers/perl-values.pl", "utf8");
	let source = await readFile("tests/fixtures/structured-callable-consumers/perl.pl", "utf8");
	const replacements = [
		["&& $live->{live_wrappers} == $wrappers", "&& $live->{live_wrappers} == 0", 1]
		, ["qr/\\Ainvalid or foreign Lean resource object\\b/", "qr/\\AInvalid or foreign Lean closure\\b/", 1]
		, ["qr/16 MiB/", "qr/storage limit exceeded/", 4]
		, ["qr/expired|retaining/", "qr/expired|retaining|status=1/", 1]
	];
	for(const [before, after, count] of replacements)
	{
		assert.equal(source.split(before).length, count + 1, before);
		source = source.replaceAll(before, after);
	}
	// Graph closures use the native identity broker, not legacy Perl wrappers.
	// The caller still checks the exact broker count for every held closure.
	return (values + "\n" + source).replaceAll("LeanBridge::Structured", "LeanBridge::Recursive")
		.replaceAll("LeanBridge/Structured.pm", "LeanBridge/Recursive.pm");
};
