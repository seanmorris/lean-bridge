/** @file Combine a guest-owned future and the existing copied-value Packet workers in one Lake project. */
import {appendFile,copyFile,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {prepareStaticWorkerProject} from "./static-worker-project.mjs";
import {witCoreInterface} from "../../src/backends/wit/application-operations.mjs";

/**
 * Reuse the standalone Packet cursor, release gate and error types. For the
 * promise factory, use a continuation that cannot block the object owner.
 *
 * @param project - Fresh project directory.
 */
export const prepareWitObjectCopiedProject=async project=>{
	await prepareStaticWorkerProject(project,"wit-wasi");
	await copyFile("tests/fixtures/wit-canonical-bytes/Packet.lean",join(project,"Packet.lean"));
	await copyFile("tests/fixtures/static-host-workers/PacketCompose.lean",join(project,"PacketCompose.lean"));
	await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname = "Packet"\n\n[[lean_lib]]\nname = "PacketCompose"\n');
	const path=join(project,"lean-bridge.exports.json"),cfg=JSON.parse(await readFile(path,"utf8"));
	cfg.modules.push("Packet","PacketCompose");cfg.exports=["Jobs.echo","PacketCompose.packet","Packet.release","Packet.chunks","Packet.closed"];
	cfg.taskExports=["Jobs.echo","PacketCompose.packet"];delete cfg.taskIOErrors;
	cfg.asyncIterators=[{open: "Packet.chunks",next: "Packet.next",close: "Packet.finish"}];
	cfg.targets["wit-wasi"].asyncAbi="canonical";await writeFile(path,canonicalJson(cfg));
};

/**
 * Build independent component binaries against only the installed public WIT.
 *
 * @param o - Public WIT directory, fresh consumer directory and wasm-tools runner.
 * @param o.wit - Directory containing the installed worlds.
 * @param o.out - Consumer build directory.
 * @param o.run - Invoke wasm-tools in the consumer directory.
 * @param o.copied - Include the byte-array and interleaved applications.
 */
export const buildWitCopiedConsumers=async({wit,out,run,copied=true})=>{
	const owner=join(wit,"deps/objects.wit"),pkg=/^package ([^;]+)@1\.0\.0;/u.exec(await readFile(owner,"utf8"))[1];
	const iface=pkg+"/objects@1.0.0",template=file=>readFile(join("tests/fixtures/static-host-workers",file+".wat.in"),"utf8");
	await writeFile(join(out,"owner.wat"),(await template("guest-box")).replaceAll("@IFACE@",witCoreInterface(iface)));
	await run("component","embed",owner,"--world","owner","owner.wat","-o","owner.core");
	await run("component","new","owner.core","-o","owner.wasm");
	const guests=[["echo",(await template("installed-echo")).replaceAll("@OBJECTS@",iface).replaceAll("@TASKS@","lean-bridge:workshop/object-tasks@1.0.0")]];
	if(copied)
	{
		const client=await readFile("tests/fixtures/wit-canonical-bytes/application.wat","utf8");
		guests.push(["bytes",(await template("installed-packet")).replace("@CLIENT@",()=>client.replace("(component","(component $client"))]);
		guests.push(["overlap",(await template("installed-overlap")).replaceAll("@OBJECTS@",iface)]);
	}
	for(const [name,source] of guests)
	{
		await writeFile(join(out,name+".wat"),source);
		await run("parse",name+".wat","-o",name+".wasm");
		await run("component","targets",wit,"--world","application",name+".wasm");
	}
};
