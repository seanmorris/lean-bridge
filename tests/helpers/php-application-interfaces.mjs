/** @file Reflect the generated PHP functions and ownership methods without loading native code. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {generateOwnedPhpPackage} from "../../src/backends/php/owned-package.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";
import {leasedClosureFieldReviewedIr} from "./owned-aggregate-fixture.mjs";

test("PHP application functions and Ticket resources expose the generated public methods",async t=>{
	const root=await mkdtemp(join(tmpdir(),"php-app-surface-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const ir=leasedClosureFieldReviewedIr({staged: true,hostFunctions: true,ticketExchange: true});
	const {files}=generateOwnedPhpPackage(ir);
	for(const [path,bytes] of Object.entries(files))if(path.endsWith(".php"))await saveLakeFile(root,path,bytes);
	const php=process.env.LEAN_BRIDGE_PHP??"/usr/bin/php";
	for(const name of ["tariff-application.php","tariff-application-observer.php"])
		await runNativeTool(php,["-n","-l",resolve("tests/fixtures/structured-types",name)],root,process.env);
	const result=await runNativeTool(php,["-n","-r"
	, String.raw`
require 'src/Api.php';
$ns='LeanTariffQuotes\\';
$function=static fn($name)=>new ReflectionFunction($ns.$name);
$methods=static function($cls,$names) {
    foreach ($names as $m) if (!(new ReflectionMethod($cls,$m))->isPublic()) throw new LogicException($m);
};
$arity=[];
foreach (['flat_quote','make_tariff','pass_application_quote','visit_application_quote','staged_quote','with_recovery','new_ticket','ticket_serial','exchange_ticket'] as $name)
    $arity[]=$function($name)->getNumberOfRequiredParameters();
$methods($function('pass_application_quote')->getReturnType()->getName(),['__invoke','retain','close']);
$methods($function('new_ticket')->getReturnType()->getName(),['close','retain','sameIdentity']);
echo json_encode($arity);
`],root,process.env);
	assert.deepEqual(JSON.parse(result),[3,1,1,3,3,2,1,1,2]);
});
