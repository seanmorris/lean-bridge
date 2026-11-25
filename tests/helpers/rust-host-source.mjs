/** @file Verify Rust-owned member declarations against the ordinary and reviewed Lean source. */
import { checkNativeHostImports } from "./native-host-import-check.mjs";

checkNativeHostImports("rust");
