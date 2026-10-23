import * as api from "dependentrecords";
import {checkDependentRecords} from "./check.mjs";
console.log(JSON.stringify(checkDependentRecords(api, true, false)));
