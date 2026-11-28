/** @file Compose pure Willow and effectful Ledger in one installed PHP-Wasm VM. */
import assert from "node:assert/strict";
import { PhpNode } from "php-wasm/PhpNode";
import ledger from "php-wasm-ledger";
import willow from "@example/willow-php-wasm";

const [first, second] = process.argv[2] === "io-first" ? [ledger,willow] : [willow,ledger];
const libs = [], php = new PhpNode({ version: "8.4", autoTransaction: false
	, sharedLibs: [first], dynamicLibs: [second.lazy]
	, locateFile: name => { if(/^(?:liblean_bridge_|php8\.4-lb_)/u.test(name)) libs.push(name); } });
let stdout = "", stderr = "";
php.addEventListener("output",e=>{stdout+=e.detail.join("");});
php.addEventListener("error",e=>{stderr+=e.detail.join("");});
await php.binary;
assert.equal(libs.length,2); // One runtime and the startup component.
const status = await php.run(`<?php
require_once '${first.autoload}'; require_once '${second.autoload}';
\\LeanLedger\\add(\\Brick\\Math\\BigInteger::of(7));
echo \\LeanWillow\\answer(), ':', \\LeanLedger\\read_total();`);
assert.equal(status,0,stderr); assert.equal(stderr,""); assert.equal(stdout,"17:7");
assert.equal(libs.filter(name=>name.startsWith("liblean_bridge_")).length,1);
assert.equal(libs.length,3); assert.equal(new Set(libs).size,3);
console.log("17:7; one runtime, two components");
