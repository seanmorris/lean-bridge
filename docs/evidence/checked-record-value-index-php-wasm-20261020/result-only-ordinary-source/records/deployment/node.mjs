/**
 * Installed public PHP-Wasm package calls from Node.
 *
 * @file
 */
import { PhpNode } from "php-wasm/PhpNode";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { executePhpWasmCorpus } from "./driver.mjs";

const [arrangement, loading, mode, packageName] = process.argv.slice(2);
const { default: api } = await import(packageName);
const root = import.meta.dirname;
const mount = async php => {
	const copy = async (source, target) => {
		await php.mkdir(target);
		for(const entry of await readdir(source, { withFileTypes: true }))
		{
			if(entry.isDirectory()) await copy(join(source, entry.name), target + "/" + entry.name);
			else await php.writeFile(target + "/" + entry.name, await readFile(join(source, entry.name)));
		}
	};
	await copy(join(root, "vendor"), "/vendor");
};
const result = await executePhpWasmCorpus({ Php: PhpNode, api, loading, mode
	, request: await readFile(join(root, "request-" + arrangement + ".json"), "utf8")
	, source: await readFile(join(root, mode + ".php"), "utf8")
	, mount: arrangement === "composer" ? mount : undefined });
console.log(JSON.stringify(result));
