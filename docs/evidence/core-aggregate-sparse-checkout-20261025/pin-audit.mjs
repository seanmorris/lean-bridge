import assert from "node:assert/strict";
import { readFileSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
const files = [{"path":".github/workflows/quality.yml","previous":"d35f122c03c600842f4cfcbf167d9fbd33a143dd2005635234ea623f4af7fda1","current":"b1daab5edc29356b4428e1446a73a862c10d54d36fa0be429e69e2b85649465f","count":1},{"path":"tests/helpers/core-quality-budget-tests.mjs","previous":"66bc3acd96b6e00ec01ad0d7016f551cae0f9d2a2d5a2cd020a216efacd1d734","current":"1e5a2fa9a807bb873fb14a1ee6be0cc238504824bce9902e866cdecb58b12267","count":0}];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
for(const file of files) assert.equal(hash(readFileSync(file.path)), file.current, file.path);
const selected = new Map(files.filter(file => file.count).map(file => [file.path, { ...file, seen: 0 }]));
const previous = { bytes: 102577221, sha256: "a3dd3938b125bd0abc97ef2e838d4932a5e5a5ffddbbcf77f2f57db17ba135d2" };
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
console.log(JSON.stringify({baseCommit: "c9c6435b7616807cfa9c97280bd9a49848b810dc", sourcePins: files, inventory: {previous, current: {bytes, sha256: digest.digest("hex")}, refreshedPins: 1, exactInverse: true}}));
