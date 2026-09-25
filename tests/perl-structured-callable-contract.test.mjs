/**
 * Typed copied Perl callback admission and independent failure coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { generatePerlBindingPackage, validatePerlModel } from "../src/backends/perl/generate.mjs";
import { nativeCallbackDefault, nativeTypeKey } from "../src/build/native-model.mjs";
import { assertPerlStructuredCodegenRegression, perlStructuredContractModels, perlStructuredRegressionReceipt, perlStructuredRegressionModels } from "./helpers/perl-structured-callable-regression.mjs";
import { assertPerlStructuredFaults } from "./helpers/perl-structured-callable-faults.mjs";
import { checkPerlStructuredAssertions, perlStructuredDocumentationExample } from "./helpers/perl-structured-callable-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { beforePerlRecursiveCallables } from "./helpers/perl-recursive-callable-source-history.mjs";

test("Perl structured callbacks change predecessor XS only for writable scalar storage", async () => {
	const record = JSON.parse(await readFile("docs/evidence/perl-structured-codegen-regression-20260925.json"));
	for(const [path, expected] of Object.entries(record.sourceHashes))
	{
		const source = await readFile(path, "utf8");
		assert.equal(sha256(beforePerlRecursiveCallables(path, source, expected)), expected, path);
		const unrelated = source + "\n/* unrelated source change */\n";
		assert.equal(beforePerlRecursiveCallables(path, unrelated, expected), unrelated);
		assert.notEqual(sha256(unrelated), expected, path);
	}
	assertPerlStructuredCodegenRegression(record);
	const changed = structuredClone(record);
	Object.values(changed.fixtures[0].files)[0].sha256 = "0".repeat(64);
	assert.throws(() => assertPerlStructuredCodegenRegression(changed));
});

test("Perl copied Unit, Bool and absent options use writable independent scalar slots", () => {
	const files = generatePerlBindingPackage(perlStructuredRegressionModels.scalars(), perlStructuredRegressionReceipt);
	const xs = files["Component.xs"];
	assert.match(xs, /return lbp_mortal\(newSV\(0\)\)/);
	assert.match(xs, /return lbp_mortal\(newSVsv\(boolSV\(value != 0\)\)\)/);
	assert.match(xs, /if \(!present\) return lbp_mortal\(newSV\(0\)\)/);
	assert.doesNotMatch(xs, /return &PL_sv_undef|return boolSV\(/);
});

test("Perl structured callbacks and closures use copied converters and representation-safe fallbacks", () => {
	for(const position of ["parameter", "result"])
		for(const [shape, model] of Object.entries(perlStructuredContractModels(position)))
		{
			validatePerlModel(model);
			const files = generatePerlBindingPackage(model, perlStructuredRegressionReceipt);
			const xs = files["Component.xs"], pm = files["lib/LeanBridge/Sample.pm"];
			const callback = model.types.find(type => type.kind === "callback");
			assert.ok(callback, shape);
			assert.ok(xs.includes(`if (!ok || !frame.returned) return ${nativeCallbackDefault(callback.result)};`));
			assert.ok(xs.includes(`frame->result = lb_read_${nativeTypeKey(callback.result)}(aTHX_ scope, returned);`));
			assert.ok(xs.includes(`SV *argument0 = lb_write_${nativeTypeKey(callback.parameters[0])}(aTHX_ scope, frame->argument0);`));
			assert.ok(xs.includes(`lb_t${callback.key}_call`));
			assert.match(xs, /lbp_finish\(aTHX_ scope\)/);
			assert.doesNotMatch(xs, /lean_ctor_|lean_obj_tag|JSON|dispatch/);
			assert.match(pm, /=head1 STRUCTURED CALLBACKS/);
			assert.doesNotMatch(pm, /Compound callbacks and resources|List callback payloads remain unsupported|compound callables and identity-bearing/);
			assert.deepEqual(files, generatePerlBindingPackage(structuredClone(model), perlStructuredRegressionReceipt));
			const changed = { ...model, types: model.types.map(type => ({ ...type })) };
			changed.types[0].key = "0".repeat(20);
			assert.throws(() => validatePerlModel(changed), /native type identity changed/);
		}
});

test("Perl structured fault receipts require both error modes at all 160 paths", () => {
	const shapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias"];
	const scenarios = shapes.flatMap(shape => [0, 1, 2, 3].flatMap(seed =>
			["callback", "twice", "create", "create-call", "held-call"].map(path => ({
				shape, seed, path, checkpoints: 5
				, baseline: { count: 5, live_scopes: 0, live_owners: 0
				, keeps: 1, callbacks: 0, resources: 0, borrows: 0 } }))));
	const report = { schemaVersion: 1, checks: 10001, failures: 1600
		, errorModes: { message: 800, object: 800 }, scenarios
		, deferredClose: 4, liveScopes: 0, liveOwners: 0
		, liveCallbacks: 0, liveIdentities: 0 };
	assertPerlStructuredFaults(report);
	for(const mutate of [
		value => { value.scenarios.pop(); }
		, value => { value.scenarios[0].shape = "alias"; }
		, value => { value.scenarios[0].seed = 4; }
		, value => { value.scenarios[0].path = "held-call"; }
		, value => { value.scenarios[0].checkpoints = 0; }
		, value => { value.scenarios[0].baseline.live_owners = 1; }
		, value => { value.scenarios[0].baseline.live_scopes = 1; }
		, value => { value.scenarios[0].baseline.keeps = -1; }
		, value => { value.failures--; }
		, value => { value.errorModes.object = 0; }
		, value => { value.deferredClose = 3; }
		, value => { value.liveScopes = 1; }
		, value => { value.liveOwners = 1; }
		, value => { value.liveCallbacks = 1; }
		, value => { value.liveIdentities = 1; }
	]) {
		const changed = structuredClone(report); mutate(changed);
		assert.throws(() => assertPerlStructuredFaults(changed));
	}
});

const perl = process.env.LEAN_BRIDGE_CORPUS_PERL ?? "/usr/bin/perl";
test("Perl structured assertion helpers reject false regexes and false scalars", { skip: !existsSync(perl) }, async () => {
	await checkPerlStructuredAssertions(perl);
});

test("Perl callback leak probes use fresh captured closures instead of cached constant CVs", { skip: !existsSync(perl) }, async () => {
	const source = await readFile("tests/fixtures/structured-callable-consumers/perl-faults.pl", "utf8");
	const callback = source.match(/^ {4}my \$capture = .+;\n {4}my \$code = .+;$/m)?.[0];
	assert.ok(callback);
	const script = `use strict; use warnings; use Scalar::Util qw(weaken);
for my $shape (qw(array record)) {
  for my $seed (0 .. 2) {
${callback}
    die 'callback changed its argument' unless $code->('payload') eq 'payload';
    my $weak = $code; weaken($weak); undef $code;
    die 'test callback itself retains its CV' if defined($weak);
  }
}
`;
	const result = await runCopied(perl, ["-e", script], process.cwd());
	assert.equal(result.stderr, ""); assert.equal(result.stdout, "");
});

test("Perl primitive and compound regression callers reject false regex assertions", { skip: !existsSync(perl) }, async () => {
	for(const family of ["callable", "compound"])
	{
		const source = await readFile(`tests/fixtures/${family}-consumers/perl.pl`, "utf8");
		const helper = source.match(/^sub check \(\$;\$\) .*$/m)?.[0];
		assert.ok(helper);
		const rejection = source.match(/^sub rejected \{\n[\s\S]*?^\}/m)?.[0];
		assert.ok(rejection);
		const script = `use strict; use warnings; my $checks = 0;
${helper}
sub recovered {}
${rejection}
my $accepted = eval { check('wrong' =~ /expected/, 'regex diagnostic'); 1 };
die 'false regex accepted' if $accepted;
die 'missing regex diagnostic' unless "$@" =~ /regex diagnostic/;
for my $value (undef, 0, '') {
  my $accepted = eval { check($value, 'false scalar'); 1 };
  die 'false scalar accepted' if $accepted;
}
check('expected' =~ /expected/, 'matching regex');
check(1);
my $wrong_error = eval { rejected(sub { die 'wrong error' }, qr/expected error/); 1 };
die 'wrong exception accepted' if $wrong_error;
my $no_error = eval { rejected(sub { return 1 }, qr/expected error/); 1 };
die 'missing exception accepted' if $no_error;
rejected(sub { die 'expected error' }, qr/expected error/);
die 'wrong count' unless $checks == 3;
`;
		const result = await runCopied(perl, ["-e", script], process.cwd());
		assert.equal(result.stderr, ""); assert.equal(result.stdout, "");
	}
});

test("Perl structured documentation supplies a complete installed public example", async () => {
	const guide = await readFile("docs/consume/perl.md", "utf8");
	const example = perlStructuredDocumentationExample(guide);
	assert.equal(example.stdout, "copied\n2\n");
	assert.equal(example.sourceSha256, sha256(example.source));
	assert.throws(() => perlStructuredDocumentationExample(guide + "\n### Structured callback values\n"));
	assert.throws(() => perlStructuredDocumentationExample(guide.replace("### Structured callback values", "### Missing example")));
});
