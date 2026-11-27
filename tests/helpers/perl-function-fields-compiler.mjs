/** @file Check XS readers against the compiler's C layout for two mixed callback inputs. */
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {generateOwnedPerlXs} from "../../src/backends/perl/owned-xs.mjs";
import {runCopied} from "./copied-fixture-install.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {leasedClosureFieldReviewedIr} from "./owned-aggregate-fixture.mjs";
import {perlGraphCommands} from "./perl-graph-probes.mjs";

test("Perl XS compiles two record arguments with independent function, text and scalar fields", {timeout: 300000}, async t => {
	const ir=leasedClosureFieldReviewedIr({exchange: true});
	const row=ir.types.find(n => n.name==="Tariff"), fn=ir.declarations.find(f => f.name==="applyTariff");
	const field=(name,type) => ({...row.fields[0],name,type});
	row.fields.push(field("rebate",row.fields[0].type)
		, field("label",{kind: "primitive",name: "string"})
		, field("base",{kind: "primitive",name: "uint32"}));
	ir.aggregatePolicy.closureFields.push("Owned.Tariff.rebate");
	fn.parameters[1]={...fn.parameters[0],name: "other"};
	const model=generateOwnedPerlXs(ir,"LeanBridge::TariffQuotes");
	const selected=model.functions.find(f => f.publicName==="apply_tariff_with_host_fields");
	assert.deepEqual(selected.hostRecordSlots.map(f => f.index),[0,1]);
	const rec=model.types.find(n => n.id===row.id), view=rec.hostInput;
	assert.equal(view.publicType,"LeanBridge::TariffQuotes::TariffInput");
	const checks=rec.fields.map((f,i) => `_Static_assert(offsetof(${view.inputType}, ${f.name}) == ${[0,32,64,80][i]}, "offset");`);
	await compileXs(t,model,checks);
});

test("Perl XS compares live callback argument identities without result anchors", {timeout: 300000}, async t=>{
	const model=generateOwnedPerlXs(leasedClosureFieldReviewedIr({staged: true,incoming: true}),"LeanBridge::TariffQuotes");
	assert.ok(model.c.callbackArgumentViews && !model.wholeOwners);
	assert.match(model.xs,/same_identity\(value, other\)/u);
	await compileXs(t,model,[]);
});

test("Perl XS compiles the public application-coderef and direct Ticket exchange entry points", {timeout: 300000}, async t=>{
	const ir=leasedClosureFieldReviewedIr({staged: true,hostFunctions: true,ticketExchange: true});
	const model=generateOwnedPerlXs(ir,"LeanBridge::TariffQuotes");
	for(const name of ["pass_application_quote","visit_application_quote","staged_quote","new_ticket","exchange_ticket","ticket_serial"])
		assert.ok(model.functions.some(fn=>fn.publicName===name),name);
	await compileXs(t,model,[]);
});

/**
 * Compile the generated XS against the matching public C header.
 *
 * @param t - Test scratch cleanup.
 * @param model - Generated Perl binding.
 * @param checks - Additional C layout assertions.
 */
async function compileXs(t,model,checks)
{
	const w=await mkdtemp(join(tmpdir(),"perl-input-fields-"));t.after(()=>rm(w,{recursive: true,force: true}));
	await saveLakeFile(w,model.c.prefix+".h",model.c.header);
	await saveLakeFile(w,"Probe.xs",model.declarations+"\n"+checks.join("\n")+"\n"+model.xs);
	const perl=perlGraphCommands()[0], env={PATH: "/usr/bin:/bin"};
	const describe='print encode_json({inc=>"$Config{archlibexp}/CORE",flags=>[Text::ParseWords::shellwords("$Config{ccflags} $Config{cccdlflags}")]})';
	const cfg=JSON.parse((await runCopied(perl,["-MConfig","-MText::ParseWords","-MJSON::PP","-e",describe],w,env)).stdout);
	await runCopied(perl,["-MExtUtils::ParseXS","-e","ExtUtils::ParseXS::process_file(filename=>'Probe.xs',output=>'Probe.c',prototypes=>0)"],w,env);
	await runCopied("/usr/bin/cc",["-std=gnu11","-Wall","-Wextra","-Werror"
		, "-Wno-unused-function","-fsyntax-only",...cfg.flags
		, "-I",cfg.inc,"-I",w,"Probe.c"],w,env);
}
