# Proven Lean Aho–Corasick demo

This demo compiles a generic finite-alphabet Aho–Corasick matcher from Lean to WebAssembly. The web adapter specializes tokens to UTF-8 bytes and presents three applications: operations logs, moderation rules, and threat signatures.

The automaton uses dense transitions, breadth-first failure links, and inherited terminal outputs. Empty patterns are rejected; empty input is accepted; overlaps and duplicate patterns remain distinct. `scanCertified` checks both directions of the result: every emitted triple is a real occurrence, and every occurrence is present.

```bash
bash demos/lean-aho-corasick/build.sh
node --test demos/lean-aho-corasick/test.mjs
node demos/lean-aho-corasick/benchmark.mjs --assert
```

The timed scan excludes pattern compilation. The streaming facade retains only the maximum-pattern suffix between chunks, so boundary-spanning matches are preserved without keeping the full input.
