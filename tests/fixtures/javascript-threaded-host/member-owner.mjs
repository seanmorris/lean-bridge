/** @file Node host for the platform-independent threaded member exercise. */
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {exerciseThreadedMembers} from "./member-cases.mjs";
const [kit,bin]=process.argv.slice(2);
const {default: create}=await import(pathToFileURL(join(kit,"task.mjs")));
const checks=await exerciseThreadedMembers({create
	, main: await readFile(join(kit,"task.wasm"))
	, components: await Promise.all(["C","D"].map(id=>readFile(join(bin,id+".wasm"))))
	, model: JSON.parse(await readFile(join(bin,"model.json")))});
console.log("threaded member calls verified: "+checks);
