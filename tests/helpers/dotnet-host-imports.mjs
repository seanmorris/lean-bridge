/** @file Require compiler evidence for application-owned CLR methods before implementing a NuGet provider. */
import { checkNativeHostImports } from "./native-host-import-check.mjs";
checkNativeHostImports("dotnet");
