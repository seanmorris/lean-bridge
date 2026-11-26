import type * as Owned from "owned-aggregates";
export function exercise(alternate: boolean, invoke?: typeof Owned.withFunction): {
  value: number; visits: number; expired: number; recovered: boolean; baseline: number; active: number; after: number;
};
