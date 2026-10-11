import * as api from "nominalsubtypes";
import {checkNominalSubtypes} from "./fixtures/nominal-subtype-consumers/javascript.mjs";
console.log(JSON.stringify(checkNominalSubtypes(api, {resultOnly: false})));
