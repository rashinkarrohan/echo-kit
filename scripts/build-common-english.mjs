// Builds engine/data/common-english.json: everyday English words (4+ letters), used so an
// ordinary word just before a dose ("for the pain 500 milligrams") is never taken for an
// unknown medicine name.
//
// Source: SCOWL / English Speller Database (ESDB), size 35 ("small"), US and GB spellings.
// Download it once to private/scowl/scowl35.txt:
//   curl -sSL -o private/scowl/scowl35.txt "http://app.aspell.net/create?max_size=35&spelling=US&spelling=GBs&max_variant=1&diacritic=strip&special=hacker&download=wordlist&encoding=utf-8&format=inline"
// Licence: permissive; the copyright and permission notice must be kept (it is copied into
// the output file). Medicine names in drugs.json are removed from the list.
//
//   node scripts/build-common-english.mjs

import { readFileSync, writeFileSync } from "node:fs";

const raw = readFileSync("private/scowl/scowl35.txt", "utf8");
const [header, body] = raw.split(/^---$/m);
if (body === undefined) throw new Error("private/scowl/scowl35.txt has no word list after ---");
const notice = header
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0)
  .join(" ");

const drugs = new Set(JSON.parse(readFileSync("engine/data/drugs.json", "utf8")).drugs);
const words = [
  ...new Set(
    body
      .split("\n")
      .map((w) => w.trim().toLowerCase())
      .filter((w) => /^[a-z]{4,}$/.test(w) && !drugs.has(w)),
  ),
].sort();

writeFileSync(
  "engine/data/common-english.json",
  `${JSON.stringify({
    source:
      "SCOWL / English Speller Database (ESDB), size 35, US and GB spellings, https://wordlist.aspell.net",
    licence: notice,
    note: "Everyday English words of 4+ letters, minus medicine names in drugs.json. A word in this list is never taken for an unknown medicine name.",
    words: words.join(" "),
  })}\n`,
);
console.log(`Wrote engine/data/common-english.json: ${words.length} words.`);
