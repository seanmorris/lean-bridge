/**
 * Start the scoped a-star controller on the standalone source page.
 *
 * @file
 */

import { mountWorkbench } from "./workbench.mjs";
import { createWorkbenchScope } from "../shared/workbench-scope.mjs";

const root = document.querySelector("main");
const scope = createWorkbenchScope(root, { fail: error => console.error(error) });
void mountWorkbench(root, scope).catch(scope.fail);
