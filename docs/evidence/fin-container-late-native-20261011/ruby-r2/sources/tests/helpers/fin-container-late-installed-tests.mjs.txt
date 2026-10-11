/**
 * Opt-in installed supplements for complete late-input preservation on nine native hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { checkInstalledFinContainerEdges, finContainerEdgeSelection } from "./fin-container-edge-install.mjs";
import { finLateProfiles } from "./fin-container-late-consumers.mjs";

const profiles = finContainerEdgeSelection(process.env.LEAN_BRIDGE_FIN_LATE_PROFILES);
assert.ok(profiles.every(profile => finLateProfiles.includes(profile)), "WIT uses its independent installed late-input supplement");

test("installed native packages preserve both complete late Fin inputs through rejection and relocated recovery", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const path = resolve(process.env.LEAN_BRIDGE_FIN_LATE_REPORT ?? `build/fin-container-late-inputs/edges-${profiles.join("-")}.json`);
	await checkInstalledFinContainerEdges(t, profiles, path, { lateInputs: true });
});
