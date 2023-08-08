// deno run --allow-read --allow-write calculate.ts

import contributors from "./contributors.json" assert { type: "json" };

// calculate % translated by looking at key counts
function count(obj: any, acc = 0) {
  if (typeof obj === "object") {
    for (const key in obj) {
      acc += count(obj[key]);
    }
  }

  return acc + 1;
}

const threshold =
  count(JSON.parse(await Deno.readTextFile("en/common.json"))) - 10;
const below_threshold: string[] = [];

for await (const entry of Deno.readDir(".")) {
  const fn = entry.name;
  if (entry.isDirectory && fn.length === 2) {
    console.log("Processing", fn);
    let isBelowThreshold = false; // Flag to check if the folder is below the threshold

    for await (const subEntry of Deno.readDir(`./${fn}`)) {
      const subFn = subEntry.name;
      if (subFn.endsWith(".json")) {
        const text = await Deno.readTextFile(`./${fn}/${subFn}`);
        const data = JSON.parse(text);

        let isEmptyField = false;

        for (const key in data) {
          if (data[key] === "") {
            isEmptyField = true;
            break;
          }
        }

        if (isEmptyField) {
          isBelowThreshold = true
        }
      }
    }

    if (isBelowThreshold) {
      below_threshold.push(fn);
    }
  }
}

await Deno.writeTextFile(
  "incomplete.js",
  "export default " + JSON.stringify(below_threshold, undefined, "\t")
);

// write verified translations to file
await Deno.writeTextFile(
  "verified.js",
  "export default " +
    JSON.stringify(
      Object.keys(contributors).filter(
        (x) => contributors[x].maintainer.length > 0
      ),
      undefined,
      "\t"
    )
);

// generate new README
import { Languages } from "./Languages.ts";

const u = (s) => `[@${s}](https://github.com/${s})`;

const table = `|   | Language | Maintainers | Contributors |
|:-:|---|---|---|
${Object.keys(Languages)
  .map((key) => {
    const lang = Languages[key];
    const maintainers = [],
      contribs = [];

    const entry = contributors[key];
    if (entry) {
      for (const user of entry.users) {
        if (entry.maintainer.includes(user.github)) {
          maintainers.push(user.github);
        } else {
          contribs.push(user.github);
        }
      }
    }

    return `|${lang.emoji}|${lang.display} / ${key}|${maintainers
      .map(u)
      .join(" ")}|${contribs.map(u).join(" ")}|`;
  })
  .join("\n")}`;

await Deno.writeTextFile(
  "README.md",
  (await Deno.readTextFile("README.template.md")).replace(/{{TABLE}}/g, table)
);
