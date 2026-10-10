import request from "./request.json";
export { request };
export const loadApi = async () => {
  const [api, { runtime }] = await Promise.all([import("subtypes"), import("./node_modules/subtypes/internal/runtime.mjs")]);
  return { ...api, raw: (name, args) => runtime.call("lean:Subtypes." + name, args) };
};
