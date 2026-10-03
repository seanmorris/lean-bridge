/**
 * Check raw and whole Perl callback replies and every generated XS signature.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateOwnedPerlXs } from "../../src/backends/perl/owned-xs.mjs";
import { ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultCombinedReviewedIr } from "./owned-dotnet-callback-result-fixture.mjs";
import { ownedCppCompositionReviewedIr } from "./owned-cpp-composition-fixture.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

const namespace = "LeanBridge::OwnedProbe";
const projection = (combined, hostCallbacks) => generateOwnedPerlXs(
	(combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)()
	, namespace, {
		callbackResultAnchors: true, hostCallbacks
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined
	}
);

test("Perl callback-result conversions authenticate whole replies before native copying", () => {
	for(const combined of [false, true])
	{
		const model = projection(combined, true);
		assert.match(model.declarations, /mg_findext\(SvRV\(value\), PERL_MAGIC_ext, &lpo_wrapper_magic\)/u);
		assert.match(model.declarations, /lpo_get_fetched\(aTHX_ value, type\)/u);
		assert.match(model.declarations, /if \(!fetched\) SvGETMAGIC\(value\);\n {2}sv_setsv_flags\(snapshot, value, SV_NOSTEAL\);/u);
		assert.match(model.declarations, /if \(lpo_closed\(wrapper\) \|\| !wrapper->payload\) lpo_status\(aTHX_ 4\);/u);
		assert.match(model.declarations, /lpo_pin_owner\(aTHX_ wrapper->owner\);\n {2}return lpg_pin\(aTHX_ wrapper->payload\);/u);
		for(const callback of model.c.callbacks)
		{
			const node = model.types.find(item => item.id === callback.id);
			assert.ok(model.declarations.includes(`lpo_borrow(aTHX_ lpo_callback_value(aTHX_ frame->scope, value, ${node.index}, 1), ${node.index})`));
			if(callback.anchor === undefined) continue;
			const result = model.types.find(item => item.id === callback.result);
			assert.ok(model.declarations.includes(`lpo_callback_value(aTHX_ frame->scope, slots[1], ${result.index}, 0)`));
			assert.ok(model.xs.includes(`lpo_callback_value(aTHX_ scope, returned, ${result.index}, 0)`));
		}
		if(combined)
		{
			const body = model.xs.split("move_twice(...)\n")[1].split("MODULE =")[0];
			const host = body.indexOf("lpo_host"), arm = body.indexOf("lpo_arm_inputs");
			const call = body.indexOf("_move_twice(");
			assert.ok(host >= 0 && arm >= 0 && call >= 0);
			assert.ok(host < arm && arm < call);
		}
		const native = projection(combined, false);
		assert.doesNotMatch(native.declarations, /lpo_callback_value|descriptor\.closure|descriptor\.recovery/u);
		assert.doesNotMatch(native.xs, /\n_owned_callback_/u);
	}
});

test("Perl callback-result opt-in preserves legacy XS bytes without anchored callbacks", () => {
	const ir = ownedCppCompositionReviewedIr();
	for(const hostCallbacks of [false, true])
	{
		const before = generateOwnedPerlXs(ir, namespace, { hostCallbacks });
		const after = generateOwnedPerlXs(ir, namespace, { hostCallbacks, callbackResultAnchors: true });
		for(const key of ["declarations", "xs", "valuesSource"]) assert.equal(after[key], before[key], key);
		assert.equal(after.c.header, before.c.header);
	}
});

test("Perl callback-result native and host signatures compile on every selected XS ABI", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 240000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-perl-callback-result-signatures-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const environment = { PATH: "/usr/bin:/bin" };
	let checks = 0;
	for(const perl of perlGraphCommands())
	{
		const config = JSON.parse((await runCopied(perl, [
			"-MConfig", "-MText::ParseWords", "-MJSON::PP", "-e"
			, 'print encode_json({include => "$Config{archlibexp}/CORE", flags => [Text::ParseWords::shellwords($Config{ccflags} . " " . $Config{cccdlflags})]})'
		], directory, environment)).stdout);
		for(const combined of [false, true]) for(const hostCallbacks of [false, true])
		{
			const model = projection(combined, hostCallbacks), name = `${combined}-${hostCallbacks}`;
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
			checks++;
		}
	}
	assert.equal(checks, perlGraphCommands().length * 4);
	t.diagnostic(`${checks} callback-result XS/header compilations; no native execution claim.`);
});
