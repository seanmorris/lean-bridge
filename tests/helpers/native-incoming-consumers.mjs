/** @file Execute direct-function clients from relocated Python, Ruby and Rust installs. */
import assert from "node:assert/strict";
import {copyFile, mkdir, readFile, rename, rm} from "node:fs/promises";
import {basename, dirname, join, resolve} from "node:path";
import {verifyNativeFiles} from "../../src/build/native-artifacts.mjs";
import {sha256} from "../../src/capsule/node.mjs";
import {copiedCleanEnvironment} from "./copied-fixture-install.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installPythonWheel} from "./python-wheel-install.mjs";
import {checkStagedQuoteIdentities} from "./staged-quote-project.mjs";

const fixture=resolve("tests/fixtures/structured-types");
const json=async path=>JSON.parse(await readFile(path));
const idle=[1,1,1,1,1,1,0];
const files=async(app,ext)=>{
	const names=["tariff-incoming."+ext,"tariff-incoming-observer."+ext];
	for(const n of names) await copyFile(join(fixture,n),join(app,n));
	return Promise.all(names.map(n=>readFile(join(app,n)).then(sha256)));
};
const validate=async(o,root,meta)=>{
	const pkg=o.pkg, inventory=await json(join(meta,"package-receipt.json"));
	assert.equal(inventory.ecosystem,pkg.target); assert.equal(inventory.name,pkg.name);
	assert.equal(inventory.version,pkg.version); assert.equal(inventory.runtimeIdentity,pkg.runtimeIdentity);
	await verifyNativeFiles(root,inventory.files);
	const component=join(meta,"component"), model=await json(join(component,"model.json"));
	const ir=await json(join(component,"binding-ir.json")), native=await json(join(component,"native-component.json"));
	const pins=checkStagedQuoteIdentities(model,ir,o.profile,o.route,{incoming: true});
	const d=ir.declarations.find(x=>x.source.declaration==="Owned.visitQuote");
	const outer=ir.types.find(t=>t.id===d.parameters[1].type.id), arg=outer.callable.parameters[0];
	assert.equal(arg.ownership,"borrow");assert.equal(arg.lifetime.scope,"call");
	const callback=ir.types.find(t=>t.id===arg.type.id);
	assert.equal(callback.kind,"callback");assert.equal(callback.callable.parameters[0].type.name,"uint32");
	assert.equal(callback.callable.result.type.name,"uint32");
	assert.equal(native.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256,o.sourceSha256);
	const members=Object.entries(inventory.files).filter(([p])=>p.endsWith("/"+native.library));
	assert.equal(members.length,1);assert.equal(members[0][1].sha256,native.nativeLibrary.sha256);
	assert.equal(inventory.bindingIrSha256,pins.bindingIrSha256);
	return {...pins,componentSha256: native.nativeLibrary.sha256, members: Object.keys(inventory.files).length};
};
const python=async o=>{
	const {app,archive,env}=o, prefix=join(app,"prefix"), deploy=join(app,"deployed");
	const installed=await installPythonWheel({root: prefix,archive,python: env.LEAN_BRIDGE_PYTHON});
	await rename(join(prefix,"venv"),deploy);await rm(prefix,{recursive: true});
	const py=join(deploy,"bin/python"), clean={...copiedCleanEnvironment,LEAN_NUM_THREADS: "1"};
	const mod=await run(py,["-I","-B","-c","import lean_tariff_quotes as api; print(api.__file__)"],app,clean);
	assert.ok(mod.startsWith(deploy+"/lib/"));const packageDir=dirname(mod);
	const pins=await validate(o,dirname(packageDir),join(packageDir,"lean_bridge"));
	const [clientSha256,observerSha256]=await files(app,"py");
	const boot="import runpy,sys; import lean_tariff_quotes as api; from lean_tariff_quotes import _assets; "
		+"runpy.run_path(sys.argv[1])['observe'](sys.argv[2],api._OwnedNative._runtime,_assets._LIBRARY)";
	await rm(archive);
	const observed=JSON.parse(await run(py,["-I","-B","-c",boot,"tariff-incoming-observer.py","tariff-incoming.py"],app,clean));
	assert.deepEqual(observed,idle);
	return {...pins,clientSha256,observerSha256,python: installed.python,dependency: installed.dependency,observed};
};
const ruby=async o=>{
	const {app,archive,env}=o, rb=env.LEAN_BRIDGE_RUBY,prefix=join(app,"prefix"),deploy=join(app,"deployed");
	await run(rb,[join(dirname(rb),"gem"),"install","--norc","--local","--no-document","--install-dir",prefix,archive],app,
		{...env,GEM_HOME: prefix,GEM_PATH: prefix});
	await rename(prefix,deploy);
	const clean={...copiedCleanEnvironment,GEM_HOME: deploy,GEM_PATH: deploy,LANG: "C.UTF-8",LEAN_NUM_THREADS: "1"};
	const boot='gem "tariff-quotes","=1.0.0";require "lean_bridge/tariff_quotes";root=Gem.loaded_specs.fetch("tariff-quotes").full_gem_path;';
	const root=await run(rb,["-e",boot+"print root"],app,clean);
	assert.ok(root.startsWith(deploy+"/gems/"));
	assert.equal(sha256(await readFile(join(deploy,"cache",basename(archive)))),o.pkg.artifacts[0].sha256);
	const pins=await validate(o,root,join(root,"lean-bridge")),[clientSha256,observerSha256]=await files(app,"rb");
	const observe='load "./tariff-incoming-observer.rb";rt=LeanBridge::TariffQuotes.const_get(:Native,false).instance_variable_get(:@runtime);'
		+'libs=Dir[File.join(root,"lib/**/liblean_bridge_native.so")];raise "expected one broker" unless libs.one?;'
		+'DirectQuoteObserver.observe("./tariff-incoming.rb",rt,Fiddle.dlopen(libs.first))';
	await rm(archive);
	const observed=JSON.parse(await run(rb,["-e",boot+observe],app,clean));assert.deepEqual(observed,idle);
	return {...pins,clientSha256,observerSha256,ruby: await run(rb,["-v"],app,clean),observed};
};
const rust=async o=>{
	const {app,archive,env,dependencies}=o, build=join(app,"build");
	await mkdir(build);
	const [clientSha256,observerSha256]=await files(build,"rs");
	await rename(join(build,"tariff-incoming.rs"),join(build,"consumer.rs"));
	await run("tar",["-xzf",archive],build,env);
	const root=join(build,o.pkg.name+"-"+o.pkg.version);
	const pins=await validate(o,root,join(root,"lean-bridge"));
	assert.equal(sha256(await readFile(join(root,"Cargo.lock"))),dependencies.lockSha256);
	const manifest=await json(join(root,"binding-manifest.json"));
	assert.ok(manifest.contract.directClosureEntries.some(x=>x.original==="visit_quote" && x.name==="visit_quote_with"));
	const vendored=join(o.depRoot,"rust-dependencies.tar.gz"); assert.equal(dependencies.archive,basename(vendored));
	assert.equal(sha256(await readFile(vendored)),dependencies.sha256);
	await run("tar",["-xzf",vendored],build,env);
	await saveLakeFile(build,".cargo/config.toml",'[source.crates-io]\nreplace-with="prepared"\n[source.prepared]\ndirectory="dependencies"\n');
	await saveLakeFile(build,"Cargo.toml",`[package]
name="consumer"
version="0.0.0"
edition="2021"
[dependencies]
${o.pkg.name}={path="${basename(root)}"}
[[bin]]
name="consumer"
path="consumer.rs"
[[bin]]
name="observer"
path="tariff-incoming-observer.rs"
[profile.dev]
debug=0
incremental=false
`);
	const compile={...copiedCleanEnvironment
		, PATH: "/usr/bin:/bin"
		, CARGO_HOME: join(build,"cargo-home")
		, RUSTC: env.LEAN_BRIDGE_RUSTC
		, CARGO_NET_OFFLINE: "true"
		, CARGO_BUILD_JOBS: "1"};
	await run(env.LEAN_BRIDGE_CARGO,["generate-lockfile","--offline"],build,compile);
	await run(env.LEAN_BRIDGE_CARGO,["build","--offline","--locked","--bins"],build,compile,1_800_000);
	for(const n of ["consumer","observer"]) await rename(join(build,"target/debug",n),join(app,n));
	await rm(build,{recursive: true});await rm(archive);
	const clean={...copiedCleanEnvironment,TMPDIR: app,LEAN_NUM_THREADS: "1"};
	assert.equal(await run(join(app,"consumer"),[],app,clean),"");
	const output=await run(join(app,"observer"),[],app,clean);
	const m=/^held:([1-9]\d*)\nidentities:(0,0,0,0,0,0,0)$/u.exec(output);assert.ok(m,output);
	return {...pins, clientSha256, observerSha256
		, held: Number(m[1]), observed: m[2].split(",").map(Number)
		, dependenciesSha256: dependencies.sha256
		, lockSha256: dependencies.lockSha256};
};

/**
 * Execute one prepared package in a disposable downstream application directory.
 *
 * @param o - Verified release, tools, contract route and isolated consumer root.
 */
export const runIncomingConsumer=async o=>{
	assert.equal(o.pkg.artifacts.length,1);
	await mkdir(o.app);
	const [a]=o.pkg.artifacts,archive=join(o.app,basename(a.path));
	await copyFile(join(o.handoff,a.path),archive);
	assert.equal(sha256(await readFile(archive)),a.sha256);
	return ({pypi: python,rubygems: ruby,cargo: rust})[o.pkg.target]({...o,archive});
};
