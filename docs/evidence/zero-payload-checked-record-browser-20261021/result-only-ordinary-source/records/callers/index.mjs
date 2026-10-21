import * as api from "zeropayloadcheckedrecords";
import {checkZeroPayloadRecords} from "./check.mjs";
console.log(JSON.stringify(checkZeroPayloadRecords(api, true)));
