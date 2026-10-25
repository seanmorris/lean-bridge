import assert from "node:assert/strict";
import { readFileSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
const files = [{"path":"tests/helpers/php-wasm-refinement-entry-hosted-replay.mjs","previous":"b82c38fd4967d8cc2c6269b6d904bc180ade03dd5367a436840525e5d297a40f","current":"dd19db364000b77f4398959e63a34e44cf2ac5c301b27acdf43d30a8b4883a64","count":1},{"path":"tests/helpers/php-wasm-refinement-entry-hosted-replay-tests.mjs","previous":"ba479678992bc5c1662791defb907cf309b65a023b35d467cfd7992992bb8eca","current":"8f8a2138a85377951e112a9af9a8036a23680619abf6564c2a2779ab7fac40b4","count":0},{"path":"docs/contributing/testing.md","previous":"d41fbb57b509a24324162da82d00bd80788faf8997b7cafa39a2a15d89082c1a","current":"35229bc22d131919b94a6a3922e0cb3a2e8c2cb7a7d0149dc4390106d0c80aa2","count":11}];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
for(const file of files) assert.equal(hash(readFileSync(file.path)), file.current, file.path);
const selected = new Map(files.filter(file => file.count).map(file => [file.path, { ...file, seen: 0 }]));
const previous = { bytes: 102577221, sha256: "66d8a954207550372f8b41fe59aa06f497bf829b174293f5e714ecc806da8a63" };
const input = createReadStream("docs/type-surface.v1.json"), digest = createHash("sha256"), reverse = createHash("sha256");
let bytes = 0, restoredBytes = 0, mode, pending;
input.on("data", chunk => { bytes += chunk.length; digest.update(chunk); });
for await(const source of createInterface({ input, crlfDelay: Infinity })) {
 let line = source;
 if(line === '      "files": [') mode = "files";
 if(line === '      "artifacts": [') mode = "artifacts";
 if(line === "      ]," || line === "      ]") mode = undefined;
 if(pending) {
  assert.equal(mode, "files"); assert.equal(line, '          "sha256": "' + pending.current + '"');
  line = '          "sha256": "' + pending.previous + '"'; pending.seen++;
 }
 const match = /^ {10}"path": "([^"]+)",$/.exec(source);
 pending = match ? selected.get(match[1]) : undefined;
 const part = Buffer.from(line + "\n"); reverse.update(part); restoredBytes += part.length;
}
assert.deepEqual({bytes: restoredBytes, sha256: reverse.digest("hex")}, previous);
assert.equal(bytes, previous.bytes);
for(const file of selected.values()) assert.equal(file.seen, file.count);
console.log(JSON.stringify({baseCommit: "337744bc2a7c1761fa742ce4eb8f7758a00d63f8", sourcePins: files, inventory: {previous, current: {bytes, sha256: digest.digest("hex")}, refreshedPins: 12, exactInverse: true}}));
