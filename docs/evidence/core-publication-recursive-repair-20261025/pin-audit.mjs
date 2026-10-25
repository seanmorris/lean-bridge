import assert from "node:assert/strict";
import { readFileSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
const files = [{"path":"tests/callback-subtype-promotion.test.mjs","previous":"7f0e8af04431736f05b730ee943053174ba7d189a28c75541093686842b92133","current":"e7fec5e09864b4c8fba7b095ff49a45467eddc8446e55ea6e0dc872b9252eaaa","count":8},{"path":"tests/helpers/ruby-recursive-callable-evidence.mjs","previous":"79ba7ea6e90fb1387bac77ae08677a2742e94e4f4e63e223d54f8035330af70f","current":"7ca8ba2865d5755702058520bc3a36a41cadfc4718b0fad1e347f8c0fe0c2a3b","count":2},{"path":"tests/helpers/rust-recursive-callable-evidence.mjs","previous":"5bb1161dbd76f0ec884d4f9cc12201fe49ac9c928303924c51a62271b079fa59","current":"20b3717c84d789acdd10f53dd2788096307a33223e126f668ed5f930d09d3a74","count":2},{"path":"tests/helpers/python-recursive-callable-evidence.mjs","previous":"446a696ff2f2a94edc727befa742f87b8cbbe1498568bd747765649c7a2bd869","current":"7208a9f1a6ddb8296d41255b9aa0f7f7fd0f5815c4fe6793fefbf62bab086022","count":2},{"path":"tests/helpers/native-recursive-callable-evidence.mjs","previous":"a8ff9904a755f3b4203c4f338a2dbb0b680225e125233226a1e4d70e2023b3b3","current":"84288616e6eeb63e6239bb8cf79475f2abb373abb4fc08ff30d972137feb78c4","count":6},{"path":"tests/checked-javascript.test.mjs","previous":"c8a7d03fd551f4b35a322fe11c738e402dc4dbc09310139300bf3c335e639d41","current":"f1ff6a462cad4a83d4dd6dbbd14e2c7dfa46e94e544fdc4bfd0ea08a0f1669ec","count":0}];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
for(const file of files) assert.equal(hash(readFileSync(file.path)), file.current, file.path);
const selected = new Map(files.filter(file => file.count).map(file => [file.path, { ...file, seen: 0 }]));
const previous = {"bytes":102577221,"sha256":"d201e69262339b996ee4eb1c8aeee69e0730d6d853e8b6d7daaf7b9d52cd21bf"};
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
console.log(JSON.stringify({baseCommit: "0d7af8b94573484ece7b4dd75f9526550c2b964a", sourcePins: files, inventory: {previous, current: {bytes, sha256: digest.digest("hex")}, refreshedPins: 20, exactInverse: true}}));
