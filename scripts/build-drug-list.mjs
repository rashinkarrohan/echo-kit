#!/usr/bin/env node
// Builds engine/data/drugs.json: generic medicine names from the FDA National Drug Code
// Directory (public domain, CC0 1.0 via openFDA: https://open.fda.gov/license/).
//
//   curl -L -o private/fda/ndctext.zip https://www.accessdata.fda.gov/cder/ndctext.zip
//   (cd private/fda && unzip -o ndctext.zip) && node scripts/build-drug-list.mjs
//
// Kept: active-ingredient words from human prescription and OTC drugs with an approved
// application (NDA, ANDA, BLA, NDA authorized generic). Dropped: salt and form words
// ("hydrochloride", "extended"), and ingredient words that are everyday English or not
// medicine names ("water", "iron", "white", amino acids, gases). Added: common UK/INN
// generic names that are not US names (paracetamol, salbutamol, ...). Ranked by how many
// FDA product listings use the ingredient, as a rough proxy for how common it is.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const product = readFileSync(join(root, "private/fda/product.txt"), "latin1");

// Everyday English (engine/data/common-english.json). An ingredient word that is an -ed,
// -ing or plural form of an everyday word ("treated", "purified", "dehydrated" from
// "dehydrated alcohol") is not a medicine name: real speech in PriMock57 flagged
// "you're dehydrated" as naming a medicine (Nov 22, 2026).
const everyday = new Set(
  JSON.parse(readFileSync(join(root, "engine/data/common-english.json"), "utf8")).words.split(" "),
);
const isEverydayForm = (w) =>
  [w, w.replace(/ied$/, "y"), w.replace(/ed$/, ""), w.replace(/d$/, ""), w.replace(/ing$/, ""), w.replace(/ing$/, "e"), w.replace(/s$/, "")].some(
    (s) => s !== "" && everyday.has(s),
  );

const SALT_AND_FORM = new Set(
  `hydrochloride hcl sodium potassium calcium magnesium sulfate sulphate maleate besylate mesylate tartrate
  bitartrate citrate acetate phosphate succinate fumarate bromide hydrobromide chloride nitrate mononitrate
  dinitrate gluconate lactate carbonate bicarbonate hydrate monohydrate dihydrate trihydrate hemihydrate
  heptahydrate pentahydrate sesquihydrate decahydrate anhydrous dipropionate propionate valerate butyrate
  furoate pivalate disodium dipotassium trisodium dihydrochloride hyclate xinafoate tromethamine olamine
  meglumine benzoate salicylate stearate palmitate oxide dioxide trioxide hydroxide peroxide acid extended
  release topical oral injection usp and with of in saccharate aspartate oxalate malate solvate monobasic
  dibasic isethionate sulfonate sulfoxide ester diacetate triacetate glycerophosphate pyrophosphate
  glycolate adipate caproate oleate diphosphate dichloride ferrocyanide chlorate chlorite nitrite iodide
  fluoride stoichiometric phospho conjugated type complex derivative unspecified medium chain
  acetonide medoxomil dimesylate disoproxil pamoate decanoate bisulfate mofetil cypionate cilexetil
  methylsulfate etexilate axetil hemipentahydrate tosylate proxetil etabonate ethylsuccinate esylate
  edisylate ethanolate pidolate undecanoate besilate hemifumarate marboxil enanthate lauroxil subcitrate
  ditosylate lactobionate tetrafluoroborate camsylate dimaleate laurylsulfate diisethionate dipivoxil
  thiosulfate tricitrate edetate etzadroxil histidinate polysulfate pivoxil hippurate`.split(/\s+/),
);

// Ingredient words that are everyday English or not things a doctor names as a medicine.
const NOT_A_MEDICINE_NAME = new Set(
  `oxygen water nitrogen helium xenon carbon hydrogen iron zinc copper silver iodine barium
  gallium indium lutetium rubidium strontium radium thallous technetium zirconium manganese selenium
  selenious chromic bismuth stannous cupric ferric ferrous arsenic magnetite talc human alfa alpha beta
  gamma omega form blue green brilliant white black methyl ethyl dimethyl monomethyl ethanol alcohol
  isopropyl glycol propylene polyethylene polystyrene methylene acetyl acetic citric lactic nitric nitrous
  ascorbic aspartic glutamic azelaic cholic ammonia ammonium dextrose sucrose sorbitol glycerol soybean
  olive shea butter fish salmon coral snake equine bovine donor stool serum tissue nerve peripheral vessel
  thymus thymocyte lymphocyte hair felis pollen birch agrostis ambrosia anthoxanthum cynodon dactylis
  phleum lolium micrurus bacillus clostridium coccidioides spherule vaccinia virus live antigen tice
  hepatitis immune globulin albumin protein toxin neurotoxin antivenin tuberculin secretin thrombin
  fibrinogen hemin lysine glycine arginine tyrosine isoleucine leucine methionine phenylalanine threonine
  tryptophan valine histidine alanine proline serine cysteine glutamine taurine betaine choline adenine
  pyruvate trypan lauryl petrolatum menthol phenol urea vitamin`.split(/\s+/),
);

// Generic (INN or UK) names not used in the US list, added by hand (names are facts, not
// a copyrighted list). Keep short and check each is a real generic name.
const EXTRA_GENERICS = [
  "paracetamol", "salbutamol", "chlorphenamine", "co-codamol", "co-amoxiclav", "glibenclamide",
  "levothyroxine", "lansoprazole", "bendroflumethiazide", "beclometasone", "adrenaline", "noradrenaline",
  "frusemide", "amoxycillin", "cefalexin", "colecalciferol", "mesalazine", "pethidine", "lignocaine",
];

const COMMON = 850;
const APPROVED = /^(NDA|ANDA|BLA|NDA AUTHORIZED GENERIC)$/;
const counts = new Map();
for (const line of product.split("\n").slice(1)) {
  const c = line.split("\t");
  const type = c[2];
  if (type !== "HUMAN PRESCRIPTION DRUG" && type !== "HUMAN OTC DRUG") continue;
  if (!APPROVED.test(c[10] ?? "")) continue;
  for (const substance of (c[13] ?? "").split(/;\s*/)) {
    const words = substance
      .toLowerCase()
      .replace(/[^a-z ]/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 5 && !SALT_AND_FORM.has(w) && !NOT_A_MEDICINE_NAME.has(w) && !isEverydayForm(w),
      );
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
}
// The same medicine under its US name. A UK/INN name ranks with its US name (paracetamol
// with acetaminophen) when that is higher, so it is as likely to be in the speech prompt.
// Old spellings (frusemide, amoxycillin, lignocaine) are left out.
const US_NAME = {
  paracetamol: "acetaminophen",
  salbutamol: "albuterol",
  chlorphenamine: "chlorpheniramine",
  glibenclamide: "glyburide",
  beclometasone: "beclomethasone",
  adrenaline: "epinephrine",
  noradrenaline: "norepinephrine",
  cefalexin: "cephalexin",
  colecalciferol: "cholecalciferol",
  mesalazine: "mesalamine",
  pethidine: "meperidine",
};
// Every UK/INN name gets at least the count of the 50th most-listed name, so it ranks among the common ones.
const fiftieth = [...counts.values()].sort((a, b) => b - a)[49] ?? 1;
for (const name of EXTRA_GENERICS) {
  const w = name.replace(/-/g, "");
  if (counts.has(w)) continue;
  const us = US_NAME[w];
  counts.set(w, Math.max(fiftieth, (us && counts.get(us)) || 0));
}

const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([w]) => w);
const out = {
  source: "FDA National Drug Code Directory (product.txt), substance names of approved human prescription and OTC drugs",
  sourceUrl: "https://www.accessdata.fda.gov/cder/ndctext.zip",
  licence: "Public domain (CC0 1.0), https://open.fda.gov/license/",
  built: new Date().toISOString().slice(0, 10),
  note: "Ranked by number of FDA product listings (a rough proxy for how common a medicine is). Plus a few UK/INN generic names. Generic names only, no brand names.",
  /** Misheard names are only matched to the first `common` names; rarer ones must be heard exactly. */
  common: COMMON,
  drugs: ranked,
};
writeFileSync(join(root, "engine/data/drugs.json"), `${JSON.stringify(out, null, 0).replace('"drugs":[', '"drugs":[\n')}\n`);
console.log(`Wrote engine/data/drugs.json: ${ranked.length} names. Top 15: ${ranked.slice(0, 15).join(", ")}`);
