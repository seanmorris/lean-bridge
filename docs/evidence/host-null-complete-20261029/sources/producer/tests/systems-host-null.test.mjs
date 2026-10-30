/**
 * Installed C, C++, Rust and WIT/WASI HostNull packages on both author routes.
 *
 * @file
 */
import test from "node:test";
import { runHostNullSystemsAcceptance } from "./helpers/host-null-systems-installed.mjs";

const flag = process.env.LEAN_BRIDGE_SYSTEMS_HOST_NULL_TEST;
if(flag !== undefined && !["0", "1"].includes(flag))
	throw new Error("Invalid LEAN_BRIDGE_SYSTEMS_HOST_NULL_TEST");

test("installed systems HostNull preserves all five positions on both author routes", {
	skip: flag !== "1", timeout: 3_600_000
}, t => runHostNullSystemsAcceptance(t));
