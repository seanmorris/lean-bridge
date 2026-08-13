import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
	ComponentBuildPlanError,
	prepareComponentBuildPlan,
	validateComponentBuildPlan,
} from "../src/build/component-plan.mjs";

test("a plain project produces a root-independent shared-runtime component plan", async () => {
  const source = resolve("tests/fixtures/onboarding/small");
  const copyRoot = await mkdtemp(join(tmpdir(), "lean-bridge-component-plan-"));
  const copied = join(copyRoot, "component");
  try
{
    await cp(source, copied, { recursive: true });
    const first = await prepareComponentBuildPlan({ projectRoot: source, engineRoot: process.cwd(), targets: ["npm"] });
    const second = await prepareComponentBuildPlan({ projectRoot: copied, engineRoot: process.cwd(), targets: ["npm"] });
    assert.equal(first.sha256, second.sha256);
    assert.deepEqual(first.document.component, {
      id: "onboarding-small@1.0.0"
      , name: "onboarding-small"
      , version: "1.0.0"
    });
    assert.deepEqual(first.document.bindingIr.declarations, [
      "lean:OnboardingSmall.add"
      , "lean:OnboardingSmall.isEmpty"
    ]);
    assert.equal(first.document.runtime.profile, "side-lazy");
    assert.equal(first.document.runtime.shared, true);
    assert.deepEqual(first.document.policies, {
      compileOnce: true
      , sourceReadOnly: true
      , privateRuntime: false
      , targetSpecificRebuild: false
    });
    assert.ok(first.document.source.inputs.every(item => !item.path.startsWith("/") && !item.path.includes("Alpha")));
    assert.equal(JSON.stringify(first).includes(resolve(".")), false);
    assert.doesNotMatch(JSON.stringify(first), /lean-link-spike|Alpha/);
} finally
{
    await rm(copyRoot, { recursive: true, force: true });
}
});

test("unresolved generic choices fail before a build plan exists", async () => {
  await assert.rejects(
    prepareComponentBuildPlan({
      projectRoot: "tests/fixtures/onboarding/generic"
      , engineRoot: process.cwd()
      , targets: ["npm"]
    }),
    error => error instanceof ComponentBuildPlanError && error.code === "component-binding-ir-required",
  );
});

test("component build plans close runtime and compilation policies", async () => {
  const plan = await prepareComponentBuildPlan({
    projectRoot: "tests/fixtures/onboarding/small"
    , engineRoot: process.cwd()
    , targets: ["npm"]
  });
  const changed = structuredClone(plan.document);
  changed.policies.privateRuntime = true;
  assert.throws(
    () => validateComponentBuildPlan(changed),
    error => error instanceof ComponentBuildPlanError && error.code === "invalid-component-build-plan",
  );
  const schema = JSON.parse(await readFile("schema/component-build-plan.schema.json", "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.source.additionalProperties, false);
  assert.equal(schema.properties.runtime.additionalProperties, false);
  assert.equal(schema.properties.policies.additionalProperties, false);
});
