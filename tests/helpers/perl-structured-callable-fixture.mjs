/**
 * Independent Perl consumer assertions and executable documentation examples.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Exercise the actual assertion bodies before trusting installed-test counts.
 *
 * @param perl - Explicit interpreter executable, selected independently of XS.
 */
export const checkPerlStructuredAssertions = async perl => {
	for(const name of ["perl.pl", "perl-faults.pl"])
	{
		const source = await readFile(`tests/fixtures/structured-callable-consumers/${name}`, "utf8");
		const check = source.match(/^sub check \(\$;\$\) \{\n[\s\S]*?^\}/m)?.[0];
		assert.ok(check, `${name}: scalar assertion arguments require a prototype`);
		const script = `use strict; use warnings; use Carp qw(confess);
my $checks = 0; my $context = 'assertion regression';
${check}
my $passed = eval { check('wrong' =~ /expected/, 'regex failure message'); 1 };
die 'false regex accepted' if $passed;
die 'regex failure lost its diagnostic' unless "$@" =~ /regex failure message/;
for my $value (undef, 0, '') {
  my $accepted = eval { check($value, 'false scalar'); 1 };
  die 'false scalar accepted' if $accepted;
}
check('expected' =~ /expected/, 'matching regex');
check(1);
die 'wrong success count' unless $checks == 2;
`;
		const result = await runCopied(perl, ["-e", script], process.cwd());
		assert.equal(result.stderr, ""); assert.equal(result.stdout, "");
	}
};

/**
 * Extract the consumer's exact file example for the source-free installed run.
 *
 * @param source - Complete checked-in Perl consumer guide.
 */
export const perlStructuredDocumentationExample = source => {
	const heading = "### Structured callback values\n";
	assert.equal(source.split(heading).length, 2);
	const section = source.split(heading)[1].split(/^#{1,3} /m)[0];
	const blocks = [...section.matchAll(/```perl\n([\s\S]*?)```/g)];
	assert.equal(blocks.length, 1);
	const example = blocks[0][1];
	assert.match(example, /use LeanBridge::Structured;/);
	assert.match(example, /LeanBridge::Structured::call_array/);
	assert.match(example, /LeanBridge::Structured::make_record/);
	assert.match(example, /\$closure->close/);
	assert.doesNotMatch(example, /LeanBridge::Runtime|XSLoader|DynaLoader|Structured::_/);
	return { filename: "structured-example.pl", source: example
		, sourceSha256: sha256(example), stdout: "copied\n2\n" };
};
