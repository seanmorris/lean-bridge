/** @file Assemble a PHP-Wasm task host module and a matching Composer API from an authenticated worker. */
import {mkdir,mkdtemp,rm,writeFile} from "node:fs/promises";
import {dirname,join} from "node:path";
import {assertExportConfigurationCapabilities} from "../analyze/export-configuration.mjs";
import {composerPackageMetadata} from "../analyze/package-metadata.mjs";
import {generatePhpWasmTaskFiles} from "../backends/php/php-wasm-task-files.mjs";
import {brickMathRequirement} from "../backends/php/brick-math.mjs";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {componentNpmIdentity} from "./component-package-receipt.mjs";
import {createDeterministicZip} from "./deterministic-zip.mjs";

export const phpWasmTaskProfile="php-wasm-threaded-task-v1";
/**
 * Validate this target's grants before compiling.
 *
 * @param configuration - Checked Lean project settings.
 */
export const assertPhpWasmTaskConfiguration=configuration=>{
	assertExportConfigurationCapabilities(configuration,{target: "php-wasm",fields: ["package","modules","exports","resources","nativeEffects","asyncIterators","taskExports","taskIOErrors","hostImports"],targetFields: ["npm","composer"]});
	if(configuration.nativeEffects?.length) throw new Error("PHP-Wasm workers support only in-memory effects");
};
/**
 * Resolve both ecosystem coordinates for the same PHP interface.
 *
 * @param api - Compiled interface.
 * @param configuration - Selected package settings.
 */
export const phpTaskCoordinates=(api,configuration)=>{
	const version=api.component.version==="0.0.0-local"?"0.0.0":api.component.version,settings=configuration.targets?.["php-wasm"]??{};
	return {npm: componentNpmIdentity({name: "php-wasm-"+api.component.name,version},settings.npm)
		, composer: {name: "lean-bridge/"+api.component.name.replaceAll("_","-")+"-php-wasm",version,...settings.composer}};
};
/**
 * Replace the JS entry point with the PHP host descriptor and emit the companion's Composer archive.
 *
 * @param options - Closed compiled inputs, generated component file map and private staging directory.
 * @param options.api - Source-authenticated Binding IR.
 * @param options.worker - Private JS scheduler view of the same source.
 * @param options.componentIdentity - Compiled worker fingerprint.
 * @param options.configuration - Project's selected package targets.
 * @param options.files - Component npm archive file map.
 * @param options.coordinate - Matching npm name and version.
 * @param options.root - Private release staging directory.
 * @param options.runtimeIdentity - Exact pthread runtime fingerprint.
 * @param options.hosts - Captured PHP class import contract, when present.
 */
export const attachPhpTaskPackages=async({api,worker,componentIdentity,configuration,files,coordinate,root,runtimeIdentity,hosts=null})=>{
	const {composer}=phpTaskCoordinates(api,configuration),{files: generated,php,autoload,namespace}=await generatePhpWasmTaskFiles(api,componentIdentity,composer,worker,hosts);
	const metadata=configuration.package??{}, pkg=JSON.parse(files.get("package.json"));
	if(!hosts) files.set("component.mjs",files.get("index.mjs"));
	for(const [k,v] of Object.entries(generated)) files.set(k,v);
	files.set("index.d.ts","export declare const autoload: string;\ndeclare const host: { readonly autoload: string; readonly extensions: { getLibs(): never[]; getFiles(php: object): never[] }; getLibs(): never[]; getFiles(php: object): {path:string;url:URL}[] };\nexport default host;\n");
	files.set("README.md","# "+coordinate.name+"\n\nImport the default PHP-Wasm descriptor, include it in sharedLibs, then require "+autoload+" from PHP. The Composer companion supplies the same API; use the descriptor's extensions member when mounting Composer's vendor directory.\n");
	files.set("package.json",canonicalJson({...pkg,files: [...new Set([...pkg.files,...hosts?[]:["component.mjs"],"php","bridge"])],leanBridge: {...pkg.leanBridge,profile: phpWasmTaskProfile}}));
	const temp=await mkdtemp(join(root,".composer-api-"));
	try
	{
		const source=Object.fromEntries(Object.entries(php).filter(([k])=>k.startsWith("src/")));
		source["composer.json"]=canonicalJson({...composer,type: "library",description: api.documentation.summary,...composerPackageMetadata(metadata),require: {php: ">=8.4 <8.5",...brickMathRequirement},autoload: {files: ["src/Api.php"]},extra: {"lean-bridge": {profile: phpWasmTaskProfile,componentIdentity,runtimeIdentity,npm: coordinate,namespace}}});
		for(const [p,bytes] of files) if(p.startsWith("notices/")) source[p]=bytes;
		for(const [p,bytes] of Object.entries(source))
		{await mkdir(dirname(join(temp,p)),{recursive: true});await writeFile(join(temp,p),bytes,{flag: "wx"});}
		const bytes=await createDeterministicZip({directory: temp,sourceDateEpoch: 315532800}), path=composer.name.replace("/","-")+"-"+composer.version+".zip";
		await writeFile(join(root,path),bytes,{flag: "wx"});return {...composer,artifact: {path,bytes: bytes.length,sha256: sha256(bytes)}};
	} finally
	{await rm(temp,{recursive: true,force: true});}
};
