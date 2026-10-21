/**
 * Strict TypeScript calls for a generic record with independently refined specializations.
 *
 * @file
 */
import * as api from "nominalsubtypes";

const generic: api.GenericNat = { value: 40n, marker: 2n };
const genericTotal: bigint = api.genericUse(generic);
const firstGeneric: api.GenericNat = api.echoGenericFirst(generic);
const secondGeneric: api.GenericNat = api.echoGenericSecond(generic);
// @ts-expect-error The generic record keeps its concrete Nat marker.
api.echoGenericFirst({ value: 40n, marker: "2" });
// @ts-expect-error The specialized record still requires its refined field.
api.echoGenericSecond({ marker: 2n });
void genericTotal; void firstGeneric; void secondGeneric;
