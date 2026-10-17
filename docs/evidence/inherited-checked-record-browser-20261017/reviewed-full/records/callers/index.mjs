import * as api from "inheritedcheckedrecords";
import {checkInheritedCheckedRecords} from "./check.mjs";
console.log(JSON.stringify(checkInheritedCheckedRecords(api, {resultOnly: false})));
