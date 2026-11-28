export function observeTariff<T>(load: () => Promise<T>): Promise<{api: T, live(): number}>;
