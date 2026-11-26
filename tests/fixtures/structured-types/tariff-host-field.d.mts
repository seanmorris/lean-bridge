import type {TariffInput} from "@example/tariff-quotes";
export function hostField(api: typeof import("@example/tariff-quotes"),
  makeInput?: (callback: (units: number) => number) => TariffInput
): {visits: number; innerCalls: number; first: number; second: number; recovered: number};
