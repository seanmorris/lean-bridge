/** @file Relocated consumer process with no compilers on PATH. */
import { readFile } from "node:fs/promises";
import { PhpNode } from "php-wasm/PhpNode";
import { runCallbackHost } from "./callback-host.mjs";

console.log(await runCallbackHost({ Host: PhpNode, fault: process.argv[2]
	, program: await readFile("callbacks.php","utf8")
	, slots: JSON.parse(await readFile("slots.json"))
	, probe: new URL("./snapshot.so",import.meta.url).href }));
