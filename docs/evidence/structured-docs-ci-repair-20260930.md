# Structured callback documentation gate repair

The Node/browser consumer job in [run 36777439799](https://github.com/seanmorris/lean-bridge/actions/runs/36777439799) failed while selecting the JavaScript documentation example. Its selector ended at `### Type conversions`, so the newer `### Consuming inputs` example became a second code block in the selected text.

The shared selector now ends at the next heading at the same or a higher level. It still requires exactly one named section and one JavaScript example. Regression tests cover adjacent level-one, level-two and level-three headings, missing and duplicated sections, extra examples, nested subsections and the current consumer guide.

The installed gate builds both ordinary-source and reviewed-IR packages. It executes the documented example twice per package and runs the existing nine-shape callback corpus in Node, strict TypeScript and Chromium, Firefox and WebKit pages, React and workers. Producer source and build directories are removed before installation. The paired JSON receipt records the completed run and exact source transition.

No generated runtime or public API changes. No additional type-support cells are promoted. Earlier receipts remain unchanged; source reconstruction accepts only the recorded complete-file hashes and exact reversal spans.
