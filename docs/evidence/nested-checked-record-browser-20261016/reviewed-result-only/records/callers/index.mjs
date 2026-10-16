import * as api from "nestedcheckedrecords";
import {checkNestedCheckedRecords} from "./check.mjs";
console.log(JSON.stringify(checkNestedCheckedRecords(api, {resultOnly: true})));
