import {exercise} from "./calls.mjs";
import type * as Owned from "owned-aggregates";
const api = await import("owned-aggregates");
let inputs = 0, outputs = 0;
const construct: typeof Owned.construct = (ticket, visit) => api.construct(ticket, actual => {
    inputs++;
    if (api.serial(actual) !== api.serial(ticket)) throw new Error("wrong typed Ticket argument");
    return visit(actual);
});
const factory: typeof Owned.factory = callback => {
    const result: Owned.Ticket = api.factory(callback);
    if (api.serial(result) !== 43n) throw new Error("wrong typed Ticket result");
    outputs++;
    return result;
};
const result = exercise(false, construct, factory);
if (inputs !== 1 || outputs !== 1) throw new Error("typed callback positions were not reached");
console.log(JSON.stringify(result));
