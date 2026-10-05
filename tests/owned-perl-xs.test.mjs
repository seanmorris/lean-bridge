/**
 * Check the complete owned Perl call surface and all generated callback ABIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateOwnedPerlXs } from "../src/backends/perl/owned-xs.mjs";
import { ownedPerlNamespace } from "../src/build/owned-perl-projection.mjs";
import { ownedHostCallbackReviewedIr } from "./helpers/owned-host-callback-fixture.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import "./helpers/owned-perl-callback-result-xs-tests.mjs";
import "./helpers/owned-perl-callback-result-runtime-tests.mjs";
import "./helpers/owned-perl-callback-result-fault-tests.mjs";
import "./helpers/owned-perl-callback-result-lifetime-tests.mjs";
import "./helpers/owned-perl-callback-result-mutant-tests.mjs";
import "./helpers/owned-perl-callback-result-sanitizer-tests.mjs";
import "./helpers/owned-perl-callback-result-runtime-evidence-tests.mjs";
import "./helpers/owned-perl-callback-result-fault-evidence-tests.mjs";
import "./helpers/owned-perl-callback-result-lifetime-evidence-tests.mjs";
import "./helpers/owned-perl-callback-result-mutant-evidence-tests.mjs";
import "./helpers/owned-perl-callback-result-sanitizer-evidence-tests.mjs";
import "./helpers/owned-perl-callback-result-package-evidence-tests.mjs";
import "./helpers/owned-perl-callback-result-combined-evidence-tests.mjs";
import "./helpers/owned-perl-callback-result-installed-smoke.mjs";
import "./helpers/owned-perl-callback-result-history-tests.mjs";
import "./helpers/owned-perl-callback-result-ci-tests.mjs";
import "./helpers/owned-perl-callback-result-acceptance-tests.mjs";
import "./helpers/owned-perl-callback-result-variant-evidence-tests.mjs";
import "./helpers/owned-perl-callback-result-variant-history-tests.mjs";
import "./helpers/owned-perl-callback-result-variant-acceptance-tests.mjs";

const fixtures = {
	callbacks: ownedHostCallbackReviewedIr
	, compositions: ownedCppCompositionReviewedIr
	, signatures: ownedDotnetCallbacksReviewedIr
	, scalars: ownedPythonScalarsReviewedIr
};

test("owned CPAN namespaces remain a validated host projection", () => {
	const component = { name: "owned-aggregates", id: "owned-aggregates@1.0.0", version: "1.0.0" };
	const before = structuredClone(component);
	assert.equal(ownedPerlNamespace(component), "LeanBridge::OwnedAggregates");
	assert.equal(ownedPerlNamespace(component, { module: "LeanBridge::Example::Owned" }), "LeanBridge::Example::Owned");
	assert.deepEqual(component, before);
	for(const module of ["", "Example::Owned", "LeanBridge::Runtime", "LeanBridge::Runtime::Owned", "LeanBridge::Bad;die", "LeanBridge::"])
		assert.throws(() => ownedPerlNamespace(component, { module }), /invalid or reserved/u);
});

test("owned Perl emits every function, identity method and scoped callback boundary", () => {
	for(const fixture of Object.values(fixtures))
	{
		const ir = fixture(), before = structuredClone(ir), generated = generateOwnedPerlXs(ir, "LeanBridge::OwnedCalls");
		assert.deepEqual(ir, before);
		assert.equal(generated.xs, generateOwnedPerlXs(ir, "LeanBridge::OwnedCalls").xs);
		for(const fn of generated.functions) assert.ok(generated.xs.includes("\n" + fn.publicName + "(...)\n"));
		for(const node of generated.types.filter(node => node.identity))
		{
			assert.ok(generated.xs.includes("PACKAGE = " + node.publicType + "\n"));
			if(node.kind === "callback") assert.ok(generated.xs.includes("\n_owned_callback_" + node.index + "(...)\n"));
		}
		assert.match(generated.xs, /SP = PL_stack_base \+ ax - 1/u);
		assert.doesNotMatch(generated.xs, /SP -= items/u);
		if(generated.c.callbacks.length)
		{
			assert.match(generated.xs, /lpo_begin_owner\(aTHX_ 1\)/u);
			assert.match(generated.xs, /\*invocation->owner = reply->result; reply->result = NULL;/u);
			assert.match(generated.valuesSource, /Runtime::Callback/u);
		}
		assert.match(generated.declarations, /G_VOID \| G_EVAL/u);
		assert.match(generated.declarations, /frame->error = GvSV\(PL_errgv\)/u);
	}
});

test("all owned Perl call and callback signatures compile on each supported XS ABI", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 240000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-perl-xs-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const environment = { PATH: "/usr/bin:/bin" };
	let checks = 0;
	for(const perl of perlGraphCommands())
	{
		const config = JSON.parse((await runCopied(perl, [
			"-MConfig", "-MText::ParseWords", "-MJSON::PP", "-e"
			, 'print encode_json({include => "$Config{archlibexp}/CORE", flags => [Text::ParseWords::shellwords($Config{ccflags} . " " . $Config{cccdlflags})]})'], directory, environment)).stdout);
		for(const [name, fixture] of Object.entries(fixtures))
		{
			const model = generateOwnedPerlXs(fixture(), "LeanBridge::OwnedCalls");
			await saveLakeFile(directory, model.c.prefix + ".h", model.c.header);
			await saveLakeFile(directory, name + ".xs", model.declarations + "\n" + model.xs);
			await runCopied(perl, ["-MExtUtils::ParseXS", "-e"
				, 'ExtUtils::ParseXS::process_file(filename => $ARGV[0], output => $ARGV[1], prototypes => 0)'
				, name + ".xs", name + ".c"], directory, environment);
			await runCopied("/usr/bin/cc", [
				"-std=gnu11", "-Wall", "-Wextra", "-Werror", "-Wno-unused-function"
				, "-fsyntax-only", ...config.flags
				, "-I", config.include, "-I", directory, name + ".c"
			], directory, environment);
			++checks;
		}
	}
	t.diagnostic(`${checks} full XS API/header checks; native execution is tested separately.`);
});
