#!/usr/bin/env node
/**
 * Print one canonical native value-index runtime identity.
 *
 * @file
 */
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	observeCheckedRecordValueIndexNativeRuntime
} from "../tests/helpers/checked-record-value-index-native-runtime.mjs";

process.stdout.write(canonicalJson(
	observeCheckedRecordValueIndexNativeRuntime()));
