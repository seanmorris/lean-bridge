import assert from "node:assert/strict";
import test from "node:test";

import createStartupModule from "../../../build/link-spike/startup/main.mjs";

test("startup side modules register private symbols into one main runtime", async () => {
  const module = await createStartupModule();
  assert.equal(module.ccall, undefined);
  assert.equal(module._bridge_has_alpha(), 1);
  assert.equal(module._bridge_has_beta(), 1);
  assert.equal(module._bridge_get_counter(), 3030);
  assert.equal(module._bridge_call_alpha(7), 107);
  assert.equal(module._bridge_call_beta(5), 1105);
  assert.equal(module._bridge_get_counter(), 3052);
});
