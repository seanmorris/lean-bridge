#!/usr/bin/env node

import { buildPinnedBuilderImage } from "../src/build/canonical-build.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";

const result = await buildPinnedBuilderImage({ projectRoot: process.cwd() });
process.stdout.write(canonicalJson(result));
