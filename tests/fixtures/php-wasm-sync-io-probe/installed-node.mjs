/** @file Run from the relocated application's directory without producer tooling. */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PhpNode } from "php-wasm/PhpNode";
import { runInstalled } from "./installed.mjs";

const vendor = [];
const walk = async (dir, rel = "") => {
	for(const entry of await readdir(dir,{ withFileTypes: true }))
	{
		const path = join(dir,entry.name), name = rel+entry.name;
		if(entry.isDirectory()) await walk(path,name+"/");
		else if(entry.isFile()) vendor.push([name,await readFile(path)]);
		else throw new Error("Unexpected vendor entry: "+name);
	}
};
const [, , mode, loading] = process.argv;
if(mode === "composer") await walk("vendor");
console.log(await runInstalled({ Host: PhpNode, loading, program: await readFile("consumer.php","utf8"), vendor: mode === "composer" ? vendor : null }));
