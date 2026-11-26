/** @file Run the application as a file so pthread workers inherit no eval-mode flags. */
import {closeTaskRuntime} from "@lean-bridge/runtime";
import {exerciseObjects} from "./object-app.mjs";
try
{console.log(JSON.stringify(await exerciseObjects()));}
finally
{await closeTaskRuntime();}
