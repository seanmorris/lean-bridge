type RuntimeStats = ReturnType<typeof import("@lean-bridge/runtime").taskRuntimeStats>;
type Reader = {
  open_cursor(n: number): AsyncIterableIterator<number> & {return(): Promise<IteratorResult<number>>};
  pulls(): number; closes(): number; entered(): Promise<number>; finished(): Promise<number>;
  sibling(n: number): Promise<number>; release(n: number): void;
};
export function parked(api: Reader, stats: () => RuntimeStats, idle: () => Promise<unknown>): Promise<{
  successes: number; failures: number; whileParked: {pulls: number; closes: number; drained: boolean; nativeOwners: number};
  late: number; finalizers: number; live: number[];
}>;
