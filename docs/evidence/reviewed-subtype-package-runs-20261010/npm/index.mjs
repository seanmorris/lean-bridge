import * as api from "subtypes";
import { runtime } from "./node_modules/subtypes/internal/runtime.mjs";
import { checkReviewedSubtype } from "./check.mjs";
console.log(JSON.stringify(checkReviewedSubtype(api, (name, args) => runtime.call("lean:Subtypes." + name, args))));
