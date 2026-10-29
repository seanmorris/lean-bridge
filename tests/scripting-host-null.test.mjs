/**
 * Installed Perl, Python and Ruby HostNull packages on both author routes.
 *
 * @file
 */
import test from "node:test";
import {
	runHostNullScriptingAcceptance
} from "./helpers/host-null-scripting-installed.mjs";

const enabled = process.env.LEAN_BRIDGE_SCRIPTING_HOST_NULL_TEST === "1";

test("installed scripting HostNull preserves all five positions on both author routes"
	, { skip: !enabled, timeout: 1_800_000 }
	, async t => runHostNullScriptingAcceptance(t));
