/** @file Exercise the packages inside a dedicated Chromium module worker. */
import {exercise} from "./calls.mjs";
globalThis.postMessage(exercise(true));
