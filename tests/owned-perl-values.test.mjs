/**
 * Check owned Perl declarations independently of native transport admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateOwnedPerlValues } from "../src/backends/perl/owned-values.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const namespace = "LeanBridge::OwnedValues";

test("owned Perl declarations retain finite types, identity leaves and transparent aliases", () => {
	const ir = ownedCppCompositionReviewedIr(), before = structuredClone(ir);
	const values = generateOwnedPerlValues(ir, namespace);
	assert.deepEqual(ir, before);
	const { c: repeatedC, ...repeated } = generateOwnedPerlValues(ir, namespace);
	const { c, ...publicValues } = values;
	assert.deepEqual(repeated, publicValues); assert.equal(repeatedC.header, c.header);
	assert.equal(values.types.length, 41); assert.equal(values.functions.length, 31);
	assert.equal(values.types.filter(node => node.identity).length, 8);
	assert.equal(values.types.filter(node => node.kind === "callback").length, 7);
	assert.equal(values.functions.find(fn => fn.name === "newTicket").publicName, "new_ticket");
	assert.match(values.source, /package LeanBridge::OwnedValues::Ticket;/u);
	assert.match(values.source, /package LeanBridge::OwnedValues::Chain::Link;/u);
	assert.match(values.source, /my @required = qw\(ticket next\);/u);
	assert.match(values.source, /BundleAlias = Bundle; Perl: LeanBridge::OwnedValues::Bundle/u);
	assert.match(values.source, /TicketRow = array<option<Ticket>>; Perl: array reference/u);
	assert.deepEqual(values.aliases.map(alias => alias.name), ["BundleAlias", "TicketRow"]);
	assert.ok(values.types.filter(node => node.identity).every(node => values.publicTypes.includes(node.publicType)));
	assert.equal(new Set(values.publicTypes).size, values.publicTypes.length);
	assert.ok(values.source.length < 25000);
	const scalars = generateOwnedPerlValues(ownedPythonScalarsReviewedIr(), namespace);
	assert.equal(scalars.types.find(node => node.name === "Scalars").fields.length, 19);
	assert.equal(scalars.types.filter(node => node.kind === "primitive").length, 19);
	assert.ok(scalars.types.every(node => typeof node.publicType === "string"));
});

test("owned Perl names cannot overwrite helpers, lifecycle methods or constructor fields", () => {
	for(const name of ["Some", "Owned", "Runtime", "DESTROY", "a::b", "a'b"])
	{
		const ir = ownedCppCompositionReviewedIr();
		ir.types.find(node => node.name === "Ticket").name = name;
		assert.throws(() => generateOwnedPerlValues(ir, namespace));
	}
	for(const name of ["new", "DESTROY", "STORABLE_freeze", "can", "isa"])
	{
		const ir = ownedCppCompositionReviewedIr();
		ir.types.find(node => node.name === "Payload").fields[0].name = name;
		assert.throws(() => generateOwnedPerlValues(ir, namespace));
	}
	for(const name of ["LeanBridge::Runtime", "NotLeanBridge::Values", "LeanBridge::a'b"])
		assert.throws(() => generateOwnedPerlValues(ownedCppCompositionReviewedIr(), name));
	const alias = ownedCppCompositionReviewedIr();
	alias.types.find(node => node.name === "BundleAlias").name = "Some";
	assert.throws(() => generateOwnedPerlValues(alias, namespace));
});

test("real Perl constructors preserve branches, field names and nested optional payloads", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 180000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-perl-values-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const values = generateOwnedPerlValues(ownedCppCompositionReviewedIr(), namespace);
	await saveLakeFile(directory, "values.pm", values.source);
	await saveLakeFile(directory, "consumer.pl", `use strict;
use warnings;
use Scalar::Util qw(blessed refaddr);
use JSON::PP;
require './values.pm';
my $checks = 0;
sub check { CORE::die "constructor check " . ($checks + 1) . " failed\\n" unless $_[0]; ++$checks; }
sub rejected {
  my ($code, $message) = @_;
  my $ok = eval { $code->(); 1 };
  check(!$ok && $@ =~ $message);
}
my $some = LeanBridge::OwnedValues::Some->new(undef);
check(blessed($some) eq 'LeanBridge::OwnedValues::Some');
check(!defined $some->value);
check(blessed(LeanBridge::OwnedValues::Some->new($some)->value) eq 'LeanBridge::OwnedValues::Some');
check(ref(LeanBridge::OwnedValues::Some->new([])->value) eq 'ARRAY');
check(blessed(LeanBridge::OwnedValues::Ok->new(undef)) ne blessed(LeanBridge::OwnedValues::Err->new(undef)));
check(blessed(LeanBridge::OwnedValues::Choice::Empty->new) ne blessed(LeanBridge::OwnedValues::Chain::Stop->new));
my $pair = LeanBridge::OwnedValues::Choice::Pair->new(second => 2, first => 1);
check($pair->first == 1 && $pair->second == 2);
check($pair->isa('LeanBridge::OwnedValues::Choice'));
my $payload = LeanBridge::OwnedValues::Payload->new(bytes => "a\\0b", count => Math::BigInt->new(42));
check($payload->count->bstr eq '42');
check($payload->bytes eq "a\\0b");
my $end = LeanBridge::OwnedValues::Chain::Stop->new;
my $link = LeanBridge::OwnedValues::Chain::Link->new(ticket => undef, next => $end);
check(refaddr($link->next) == refaddr($end));
my $tree = LeanBridge::OwnedValues::Tree::Branch->new(children => [LeanBridge::OwnedValues::Tree::Leaf->new(ticket => undef)]);
check(blessed($tree->children->[0]) eq 'LeanBridge::OwnedValues::Tree::Leaf');
check(!LeanBridge::OwnedValues::BundleAlias->can('new'));
check(!LeanBridge::OwnedValues::TicketRow->can('new'));
rejected(sub { LeanBridge::OwnedValues::Ticket->new }, qr/returned by Lean/);
rejected(sub { LeanBridge::OwnedValues::Choice->new }, qr/named variant constructor/);
rejected(sub { LeanBridge::OwnedValues::Some->new }, qr/one payload/);
rejected(sub { LeanBridge::OwnedValues::Some->new(1, 2) }, qr/one payload/);
rejected(sub { LeanBridge::OwnedValues::Payload->new(count => 1) }, qr/schema/);
rejected(sub { LeanBridge::OwnedValues::Payload->new(count => 1, bytes => '', extra => 2) }, qr/schema/);
rejected(sub { LeanBridge::OwnedValues::Payload->new(count => 1, count => 2, bytes => '') }, qr/duplicate/);
rejected(sub { LeanBridge::OwnedValues::Choice::Pair->new(first => 1, first => 2, second => 3) }, qr/duplicate/);
rejected(sub { LeanBridge::OwnedValues::Payload->new(undef, 1, bytes => '') }, qr/invalid field/);
rejected(sub { LeanBridge::OwnedValues::Payload->new([], 1, bytes => '') }, qr/invalid field/);
rejected(sub { LeanBridge::OwnedValues::Choice::Empty->new(extra => 1) }, qr/schema/);
${values.types.filter(node => node.identity).map(node => `check(${node.publicType}->CLONE_SKIP);
rejected(sub { ${node.publicType}->new }, qr/returned by Lean/);
rejected(sub { ${node.publicType}->STORABLE_freeze }, qr/cannot be serialized/);
rejected(sub { ${node.publicType}->STORABLE_thaw }, qr/cannot be deserialized/);`).join("\n")}
print JSON::PP->new->canonical->encode({ checks => $checks, native_transport => JSON::PP::false }), "\\n";
`);
	const result = await runCopied(process.env.LEAN_BRIDGE_PERL ?? "/usr/bin/perl",
		["consumer.pl"], directory, { PATH: "/usr/bin:/bin" });
	assert.equal(result.stderr, "");
	const report = JSON.parse(result.stdout);
	assert.equal(report.checks, 57); assert.equal(report.native_transport, false);
	t.diagnostic(`${report.checks} real Perl declaration checks passed; native transport is not enabled`);
});
