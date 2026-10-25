import assert from "node:assert/strict";
import { readFileSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
const files = [{"path":"tests/helpers/php-wasm-refinement-entry-hosted-replay.mjs","previous":"5249b76489cadc27f75fd5aa193f6c0ffc622fd2db3b375bafef5ea80cfa4044","current":"b82c38fd4967d8cc2c6269b6d904bc180ade03dd5367a436840525e5d297a40f","count":1},{"path":"tests/helpers/php-wasm-refinement-entry-hosted-replay-tests.mjs","previous":"ae3012098eebe79bd3132b354dd1c26868d45e46324aef0628a2f1355b796409","current":"ba479678992bc5c1662791defb907cf309b65a023b35d467cfd7992992bb8eca","count":0},{"path":"docs/contributing/testing.md","previous":"a0231d42c30f635b9b2a2ed2dd19636adbf307f60d3cc4590ef39b86e2d1a4ac","current":"d41fbb57b509a24324162da82d00bd80788faf8997b7cafa39a2a15d89082c1a","count":11}];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
for(const file of files) assert.equal(hash(readFileSync(file.path)), file.current, file.path);
const selected = new Map(files.filter(file => file.count).map(file => [file.path, { ...file, seen: 0 }]));
const previous = { bytes: 102577221, sha256: "03f00b29636bc9a1af28e7da47577226bd51dd3ba3f716ab6b81000d2952d226" };
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
console.log(JSON.stringify({baseCommit: "de7630309f4836ac8a9a82cd4a2e687177cbc97b", sourcePins: files, inventory: {previous, current: {bytes, sha256: digest.digest("hex")}, refreshedPins: 12, exactInverse: true}}));
