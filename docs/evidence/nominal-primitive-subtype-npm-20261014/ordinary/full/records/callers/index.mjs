import * as api from "nominalprimitivesubtypes";
import {checkNominalPrimitiveSubtypes} from "./fixtures/nominal-primitive-subtype-consumers/javascript.mjs";
console.log(JSON.stringify(checkNominalPrimitiveSubtypes(api, {resultOnly: false})));
