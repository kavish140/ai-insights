import assert from "node:assert/strict";
import vm from "node:vm";
import {
  defaultReadingSettings,
  parseReadingSettings,
  parseReadingList,
  readingBootstrap,
} from "../src/lib/reading-settings.ts";

for (const raw of [null, "broken json", "null", "7", '"hello"', "[]"]) {
  assert.deepEqual(parseReadingSettings(raw), defaultReadingSettings);
}
assert.deepEqual(
  parseReadingSettings(
    JSON.stringify({
      theme: "injected",
      size: 900,
      focus: "true",
      motion: "false",
      font: "comic",
      spacing: "bad",
    }),
  ),
  defaultReadingSettings,
);
for (const theme of ["light", "dark", "sepia", "system"]) {
  for (const darkSystem of [false, true]) {
    const settings = {
      theme,
      size: 22,
      font: "serif",
      spacing: "compact",
      width: "wide",
      focus: true,
      motion: false,
    };
    assert.deepEqual(parseReadingSettings(JSON.stringify(settings)), settings);
    const dataset = {};
    const styles = {};
    const classes = new Map();
    vm.runInNewContext(readingBootstrap, {
      localStorage: { getItem: () => JSON.stringify(settings) },
      matchMedia: () => ({ matches: darkSystem }),
      document: {
        documentElement: {
          dataset,
          classList: { toggle: (name, on) => classes.set(name, on) },
          style: { setProperty: (name, value) => (styles[name] = value) },
        },
      },
    });
    const expectedTheme = theme === "system" ? (darkSystem ? "dark" : "light") : theme;
    assert.equal(dataset.theme, expectedTheme);
    assert.equal(classes.get("dark"), expectedTheme === "dark");
    assert.equal(styles["--reader-size"], "22px");
    assert.equal(dataset.readerFocus, "true");
    assert.equal(dataset.readerMotion, "false");
  }
}
assert.doesNotThrow(() =>
  vm.runInNewContext(readingBootstrap, {
    localStorage: {
      getItem: () => {
        throw Error("Storage blocked");
      },
    },
  }),
);
const item = {
  slug: "useful-guide",
  title: "Useful guide",
  category: "Automation",
  minutes: 5,
  progress: 42,
};
assert.deepEqual(
  parseReadingList(JSON.stringify([item, item, null, {}, { ...item, slug: "bad", progress: 101 }])),
  [item],
);
assert.deepEqual(parseReadingList("broken"), []);
assert.deepEqual(parseReadingList("{}"), []);
assert.equal(
  parseReadingList(
    JSON.stringify(
      Array.from({ length: 150 }, (_, index) => ({ ...item, slug: `guide-${index}` })),
    ),
  ).length,
  100,
);
console.log(
  "Passed: settings validation, every theme/system combination, pre-paint theme bootstrap, blocked storage, bookmark validation, deduplication and storage limits.",
);
