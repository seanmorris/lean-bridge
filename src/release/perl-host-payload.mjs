/** @file Regenerate the CPAN host payload from the captured source and compiled interface. */
import {parseBindingIr,hashBindingIr} from "../binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {nativeEffectPolicy} from "../analyze/native-host-effects.mjs";
import {reconcileHostExports} from "../analyze/host-export-model.mjs";
import {generatePerlHostExports} from "../backends/perl/host-exports.mjs";
import {renderPerlHostLoader,renderPerlIOBuild,validatePerlIOSettings} from "../backends/perl/sync-io.mjs";
import {perlHostComponentIdentity,perlHostHeaders} from "../build/perl-host-component.mjs";
import {perlHostTaskKernel} from "../build/perl-host-task-kernel.mjs";
import {validateNativeElf} from "../build/native-artifacts.mjs";

const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
const digest=v=>typeof v==="string" && /^[a-f0-9]{64}$/u.test(v);
const fail=m=>{throw new TypeError("CPAN host imports: "+m);};
const build = async ({name,version,api,evidence,hostSource,reviewSource,nativeRuntimeIdentity,bytes,readLedger},pins) => {
	validatePerlIOSettings({name,version});
	const s=evidence.selection, modules=s?.exportModules, mixed=Boolean(s?.taskExports?.length || s?.asyncIterators?.length);
	if(![nativeRuntimeIdentity,pins.runtimeIdentity,evidence.compilerSha256,evidence.extractorSha256,evidence.sourceTreeSha256,evidence.configurationSha256].every(digest)
		|| s?.hostModule!=="LeanBridge.Host.Perl" || !Array.isArray(modules) || !modules.length || s.nativeEffectPolicy!==nativeEffectPolicy
		|| (mixed?s.perlTaskObjects!==true:s.perlTaskObjects!==undefined) || s.leanResources?.length || s.synchronousIO
		|| !evidence.lake?.resolution?.generatedImports?.includes(s.hostModule) || !evidence.interfaces?.some(i=>i.module===s.hostModule)
		|| typeof hostSource!=="string" || sha256(hostSource)!==evidence.hostImportsSourceSha256
		|| (reviewSource===null?null:sha256(reviewSource))!==evidence.reviewedSourceSha256) fail("source evidence differs from the selected profile");
	const ir=parseBindingIr(hostSource), review=reviewSource===null?null:{source: reviewSource};
	const checked=reconcileHostExports({...evidence,ir,review,component: api.component});
	if(!same(checked.api,api)) fail("public API differs from compiler evidence");
	const options={name,version,ir,api,evidence,runtimeIdentity: nativeRuntimeIdentity,modules,entries: checked.entries};
	const worker=mixed?await perlHostTaskKernel({...options,checked: {...checked,evidence}}):null;
	const headers=await perlHostHeaders(worker), componentIdentity=perlHostComponentIdentity(options,headers,worker);
	const generated=generatePerlHostExports({...options,entries: checked.entries.filter(e=>!e.delivery),identity: componentIdentity,worker});
	let ledger=null, ledgerBytes;
	if(worker)
	{
		ledgerBytes=readLedger(worker.ledger.name); validateNativeElf(ledgerBytes);
		ledger={id: worker.ledger.id,library: worker.ledger.name,sha256: sha256(ledgerBytes)};
		if(!bytes.includes(Buffer.from("perl-worker-ledger:"+ledger.id+":"+ledger.sha256+"\0"))
			|| !bytes.includes(Buffer.from(ledger.library+"\0")) || !worker.wire.symbols.every(n=>bytes.includes(Buffer.from(n+"\0")))
			|| !["begin","end","create","borrow","release"].every(n=>bytes.includes(Buffer.from(worker.scope+n+"\0")))
			|| !["create","borrow","release"].every(n=>ledgerBytes.includes(Buffer.from("lb_task_resource_"+ledger.id+"_"+n+"\0"))))
			fail("worker library or ledger differs from the compiled binding");
	}
	validateNativeElf(bytes);
	if(!bytes.includes(Buffer.from(componentIdentity+"\0")) || !generated.symbols.every(sym=>bytes.includes(Buffer.from(sym+"\0"))))
		fail("native image does not identify this component");
	const library="liblbc_perl_"+sha256(name)+".so", librarySha256=sha256(bytes);
	const contract={schemaVersion: 1
		, profile: mixed?"native-perl-task-v1":"native-perl-host-v1"
		, component: api.component
		, componentIdentity
		, bindingIrSha256: hashBindingIr(api)
		, elaborationSha256: sha256(canonicalJson(evidence))
		, hostImportsSha256: sha256(hostSource)
		, reviewedSourceSha256: evidence.reviewedSourceSha256
		, library
		, librarySha256,...ledger?{resourceLedger: ledger}:{} };
	const dir="lib/"+name.replaceAll("::","/");
	const files=new Map(Object.entries(headers));
	files.set("Component.xs",generated.xsSource); files.set("ph-interface.h",generated.interfaceHeader);
	files.set(dir+".pm",renderPerlHostLoader({...options,generated,library,librarySha256,resourceLedger: ledger},pins));
	if(ledger) files.set(dir+"/native/"+ledger.library,ledgerBytes);
	files.set(dir+"/native/"+library,bytes); files.set("host-imports.json",hostSource);
	if(reviewSource!==null) files.set("reviewed-api.json",reviewSource);
	files.set("binding-ir.json",canonicalJson(api)); files.set("elaboration.json",canonicalJson(evidence));
	files.set("binding-manifest.json",canonicalJson(contract));
	return {files,contract};
};
/**
 * Stage the original authored and reviewed bytes, not a replacement inferred signature.
 *
 * @param o - Producer output and captured project inputs.
 * @param pins - Verified CPAN runtime release coordinate.
 */
export const preparePerlHostFiles = async (o,pins) => {
	const payload=await build({...o
		, readLedger: ()=>o.ledgerBytes
		, nativeRuntimeIdentity: o.runtimeIdentity
		, hostSource: o.projectContract.hostImportsSource
		, reviewSource: o.projectContract.review?.source??null},pins);
	if(payload.contract.componentIdentity!==o.componentIdentity || payload.contract.bindingIrSha256!==o.bindingIrSha256)
		fail("compiled identity differs from its captured sources");
	return payload;
};
/**
 * Verify the generated projections independently of the outer inventory hashes.
 *
 * @param manifest - Prepared package coordinates and inventory.
 * @param files - Verified files from the distribution.
 * @param installer - Checked shared installer template.
 */
export const verifyPerlHostFiles = async (manifest,files,installer) => {
	const {module: name,version,nativeRuntimeIdentity,runtimeVersion,runtimeIdentity}=manifest;
	const get=path=>files.get(path)??fail("missing "+path), library="liblbc_perl_"+sha256(name)+".so";
	const bytes=get("lib/"+name.replaceAll("::","/")+"/native/"+library);
	const payload=await build({name,version
		, api: JSON.parse(get("binding-ir.json"))
		, evidence: JSON.parse(get("elaboration.json"))
		, hostSource: get("host-imports.json").toString()
		, reviewSource: files.get("reviewed-api.json")?.toString()??null
		, nativeRuntimeIdentity,bytes,readLedger: n=>get("lib/"+name.replaceAll("::","/")+"/native/"+n)},{runtimeVersion,runtimeIdentity});
	if(manifest.ownedValues || manifest.syncIO || manifest.taskDelivery || manifest.xs!=="Component.xs" || manifest.include!=="."
		|| !same(payload.contract,manifest.hostImports) || get("LeanBridgeBuild.pm").toString()!==renderPerlIOBuild(installer,name,library,Boolean(payload.contract.resourceLedger),payload.contract.resourceLedger,true)) fail("manifest or installer mismatch");
	for(const [path,expected] of payload.files) if(!get(path).equals(Buffer.isBuffer(expected)?expected:Buffer.from(expected))) fail("generated payload differs: "+path);
	const artifacts=new Set(), stem=name.split("::").at(-1);
	for(const v of manifest.prebuilt)
	{
		const key=sha256(JSON.stringify(JSON.parse(canonicalJson(v.abi))));
		if(v.abiKey!==key || v.path!=="prebuilt/"+key+"/"+stem+".so" || artifacts.has(v.path)) fail("ambiguous XS ABI or path");
		const binary=get(v.path), receiptPath="prebuilt/"+key+"/receipt.json", xs=JSON.parse(get(receiptPath));
		validateNativeElf(binary);
		if(xs.schemaVersion!==1 || xs.operation!=="generated-xs-only" || !same(xs.abi,v.abi) || xs.runtimeIdentity!==runtimeIdentity
			|| xs.sourceSha256!==sha256(get("Component.xs")) || xs.outputSha256!==sha256(binary) || !digest(xs.generatedCSha256))
			fail("XS compile receipt differs from its source, runtime or output");
		artifacts.add(v.path); artifacts.add(receiptPath);
	}
	// An extra module in lib/ would otherwise be installed by MakeMaker, even
	// if it wasn't one of the projections regenerated above.
	const common=new Set(["MANIFEST","META.json","Makefile.PL","t/00-load.t","inc/LeanBridge/Runtime/Platform.pm","LeanBridgeBuild.pm"]);
	for(const path of files.keys()) if(!path.startsWith("notices/") && !common.has(path) && !payload.files.has(path) && !artifacts.has(path))
		fail("unexpected installed file: "+path);
};
