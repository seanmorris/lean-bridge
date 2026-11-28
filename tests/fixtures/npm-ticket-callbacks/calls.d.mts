import type * as Owned from "owned-aggregates";
export function exercise(alternate: boolean, construct?: typeof Owned.construct, factory?: typeof Owned.factory): {
    argument: number; reply: number; seen: number; replies: number; failed: boolean; after: number;
};
