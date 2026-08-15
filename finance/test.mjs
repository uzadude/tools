/* Self-check for the model's pure functions.
 *
 *   node finance/test.mjs
 *
 * There is no build step and no test framework — this reads index.html and pulls the
 * pure section (constants through the core calculations) straight out of it, so the
 * assertions can never drift from the file that actually ships. Everything below that
 * point touches the DOM and isn't checkable this way.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "index.html"), "utf8");

const from = src.indexOf("const IL = {");
// everything up to the chart helpers is pure; the first thing after them touches the DOM.
// cut at the start of that banner, not inside it, or the comment block is left unterminated
const to = src.lastIndexOf("/*", src.indexOf("   SVG CHART HELPERS"));
assert.ok(from > 0 && to > from, "could not locate the pure section in index.html");

const EXPORTS = ["IL", "retAgeFemale", "progressiveTax", "childPoints", "aClaimsChildPoints",
  "blEmployee", "blSelf", "earner", "mortgageRate", "convAt", "netAnnuity",
  "compute", "simulate", "earliestRetirement"];
const m = new Function(`${src.slice(from, to)}; return {${EXPORTS.join(",")}};`)();

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) < tol, `${msg}: got ${a}, want ~${b}`);
let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

/* ---- who claims the children's credit points ---- */
test("child points go to the mother in a mixed couple", () => {
  assert.equal(m.aClaimsChildPoints(37, "m", "f"), false);   // B is the mother
  assert.equal(m.aClaimsChildPoints(37, "f", "m"), true);
});
test("exactly one partner claims in a same-gender couple", () => {
  assert.equal(m.aClaimsChildPoints(37, "f", "f"), true);    // A claims, B gets father rate
  assert.equal(m.aClaimsChildPoints(37, "m", "m"), true);
});
test("a single parent claims them, whatever the partner dropdown says", () => {
  // regression: sexB defaults to "f" in the markup, so a lone father used to hand the
  // mother's points to a partner who doesn't exist and silently under-claim
  assert.equal(m.aClaimsChildPoints(0, "m", "f"), true);
  assert.equal(m.aClaimsChildPoints(0, "f", "f"), true);
});

/* ---- income tax ---- */
test("progressive tax at every 2026 bracket edge", () => {
  near(m.progressiveTax(0), 0, 1e-9, "zero income");
  near(m.progressiveTax(7010), 701, 0.01, "top of the 10% band");
  near(m.progressiveTax(10060), 1128, 0.01, "top of the 14% band");
  near(m.progressiveTax(19000), 2916, 0.01, "top of the 20% band");
  near(m.progressiveTax(25100), 4807, 0.01, "top of the 31% band");
  near(m.progressiveTax(46690), 12363.5, 0.01, "top of the 35% band");
});
test("surtax only bites above the threshold", () => {
  const below = m.progressiveTax(IL_(m).surtaxThreshold);
  const above = m.progressiveTax(IL_(m).surtaxThreshold + 10000);
  near(above - below, 10000 * 0.47 + 10000 * 0.03, 0.01, "marginal rate above the threshold");
});
test("tax is monotonic in income", () => {
  let prev = -1;
  for (let g = 0; g <= 80000; g += 250) {
    const t = m.progressiveTax(g);
    assert.ok(t >= prev, `tax fell going into ${g}`);
    prev = t;
  }
});

/* ---- Bituach Leumi ---- */
test("national insurance is capped at the ceiling", () => {
  const atCeiling = m.blEmployee(IL_(m).blCeiling);
  near(m.blEmployee(80000), atCeiling, 1e-9, "above the ceiling charges no more");
  near(atCeiling, 5708.9, 0.1, "employee charge at the ceiling");
  assert.ok(m.blSelf(20000) > m.blEmployee(20000), "self-employed pay more than employees");
});

/* ---- child credit points by age ---- */
test("child points follow the age bands", () => {
  near(m.childPoints([9, 6, 2], true), 8.5, 1e-9, "mother, three kids");
  near(m.childPoints([9, 6, 2], false), 6.5, 1e-9, "father, three kids");
  near(m.childPoints([], true), 0, 1e-9, "no children");
  near(m.childPoints([25, 30], true), 0, 1e-9, "grown children earn nothing");
});

/* ---- mortgage ---- */
test("the solved rate actually amortises the loan to zero", () => {
  const B = 1300000, P = 7400, months = 21 * 12;
  const r = m.mortgageRate(B, P, months);
  assert.ok(r > 0, "a loan paying back more than it borrowed implies a positive rate");
  let bal = B;
  for (let i = 0; i < months; i++) bal = bal + bal * r - P;
  near(bal, 0, 1, "balance after the full term");
});
test("mortgage edge cases don't blow up", () => {
  assert.equal(m.mortgageRate(0, 7400, 240), 0, "no balance");
  assert.equal(m.mortgageRate(100000, 0, 240), 0, "no payment");
  assert.equal(m.mortgageRate(100000, 500, 100), 0, "payments never cover the principal");
});

/* ---- retirement ---- */
test("women's retirement age steps up by birth year", () => {
  assert.equal(m.retAgeFemale(1955), 62);
  assert.equal(m.retAgeFemale(1965), 63.75);
  assert.equal(m.retAgeFemale(1980), 65);
  assert.ok(m.retAgeFemale(1962) < m.retAgeFemale(1968), "monotonic across the transition");
});
test("drawing the pension earlier needs a bigger divisor", () => {
  assert.equal(m.convAt(200, 67), 200);
  assert.equal(m.convAt(200, 60), 231.5);
  assert.equal(m.convAt(200, 70), 200, "past official age it stops falling");
  assert.ok(m.convAt(200, 60) > m.convAt(200, 65), "earlier means a worse factor");
});
test("a small annuity is fully exempt and only pays health tax", () => {
  const gross = 4000;                       // under 52% of the kitzba mezaka ceiling
  near(m.netAnnuity(gross, false), gross * (1 - IL_(m).pensionerHealth), 0.01, "net of health tax only");
  assert.equal(m.netAnnuity(0, false), 0, "no pension, no net");
  assert.ok(m.netAnnuity(30000, false) < 30000, "a large annuity is taxed");
});

/* ---- earner identity ---- */
test("an employee's net plus every deduction equals gross", () => {
  const e = m.earner(23000, "sachir", 2.25, true, true);
  near(e.net + e.tax + e.bl + e.pensEmp + e.khEmp, e.gross, 0.01, "nothing vanishes");
  assert.ok(e.pension > 0 && e.kh > 0, "employer contributions are counted");
});
test("a non-earner is all zeroes", () => {
  const e = m.earner(0, "none", 2.25, false, false);
  for (const k of ["gross", "net", "tax", "bl", "pension", "kh"]) assert.equal(e[k], 0, k);
});

/* ---- rent vs mortgage in the retirement target ----
   A mortgage ends, so it sits outside the target and is charged on top until it's paid off.
   Rent never ends, so it lives inside the target. The bug this guards against is charging
   rent in both places, or in neither. */
const household = (over = {}) => ({
  ageA: 38, ageB: 37, sexA: "m", sexB: "f", kidAges: [], eduEnds: true,
  typeA: "sachir", typeB: "sachir", grossA: 23000, grossB: 15000,
  pointsA: 2.25, pointsB: 2.75, hishA: true, hishB: true, pensAbove: true,
  bonus: 0, otherInc: 0,
  pensA: 330000, pensB: 190000, khA: 110000, khB: 60000,
  gemel: 45000, broker: 100000, cash: 80000, otherAsset: 0,
  ownRent: "rent", homeVal: 0, mortBal: 0, mortPay: 7400, mortYears: 0, rent: 7500,
  debtBal: 0, debtPay: 0,
  sp: { Housing: 2600, Food: 5000, Dining: 1400, Transport: 3500, Education: 0,
        Health: 1600, Shopping: 1600, Travel: 1400, Other: 1200 },
  ret: 0.05, retP: 0.04, swr: 0.035, rspFixed: 20000, planTo: 95, hg: 0.005,
  targetAge: 60, convFactor: 200, downsize: 0, oneOff: 0, useBituach: true,
  ...over,
});
const LIFESTYLE = 2600 + 5000 + 1400 + 3500 + 1600 + 1600 + 1400 + 1200;   // no Education

test("a renter's rent is inside the lifestyle figure", () => {
  const c = m.compute(household({ ownRent: "rent", rent: 7500 }));
  near(c.lifestyleBase, LIFESTYLE + 7500, 1e-9, "rent counted in");
});
test("an owner's mortgage is not — it ends", () => {
  const c = m.compute(household({ ownRent: "own", mortPay: 7400, mortYears: 21 }));
  near(c.lifestyleBase, LIFESTYLE, 1e-9, "mortgage left out");
});
test("raising the rent raises the lifestyle figure one for one", () => {
  const a = m.compute(household({ rent: 7500 })).lifestyleBase;
  const b = m.compute(household({ rent: 9500 })).lifestyleBase;
  near(b - a, 2000, 1e-9, "pound for pound");
});
test("total spending today is the same either way", () => {
  const r = m.compute(household({ ownRent: "rent", rent: 7400 })).totalSpend;
  const o = m.compute(household({ ownRent: "own", mortPay: 7400, mortYears: 21 })).totalSpend;
  near(r, o, 1e-9, "same outgoings, different tenure");
});

test("a renter's rent is charged exactly once in retirement", () => {
  const s = household({ ownRent: "rent", rent: 7500, rspFixed: 25800 });
  const retired = m.simulate(s, m.compute(s), 60).rows.filter(r => r.retired);
  assert.ok(retired.length > 0, "the household does retire");
  // the target already contains the rent, so nothing may be added on top of it
  for (const r of retired) near(r.mixSpend, 25800, 1e-9, `spend at age ${r.age}`);
});
test("an owner still pays the mortgage on top, until it ends", () => {
  // 25 years of mortgage against retiring at 60 from age 38, so the loan is deliberately
  // still running for the first three retired years — otherwise this asserts nothing
  const s = household({ ownRent: "own", rent: 0, mortPay: 7400, mortYears: 25, rspFixed: 18300 });
  const rows = m.simulate(s, m.compute(s), 60).rows.filter(r => r.retired);
  const during = rows.filter(r => r.y < s.mortYears);
  const after = rows.filter(r => r.y >= s.mortYears);
  assert.ok(during.length > 0, "the mortgage overlaps retirement");
  assert.ok(after.length > 0, "and still finishes inside the plan");
  for (const r of during) near(r.mixSpend, 18300 + 7400, 1e-9, `mid-mortgage at ${r.age}`);
  for (const r of after) near(r.mixSpend, 18300, 1e-9, `post-mortgage at ${r.age}`);
});
test("rent is charged during the working years too", () => {
  const at = rent => {
    const s = household({ rent, rspFixed: 18300 });
    return m.simulate(s, m.compute(s), 60).rows.find(r => r.age === 55).accessible;
  };
  assert.ok(at(12000) < at(6000), "an extra ₪6,000 of rent must leave less in the pot by 55");
});
test("rent makes retirement strictly harder", () => {
  // target tracks the lifestyle, so dearer rent means both a bigger bill and a bigger target
  const mk = rent => { const s = household({ rent }); s.rspFixed = m.compute(s).lifestyleBase; return s; };
  const cheap = mk(6000), dear = mk(14000);
  const a = m.earliestRetirement(cheap, m.compute(cheap));
  const b = m.earliestRetirement(dear, m.compute(dear));
  assert.ok(a !== null, "cheap rent is fundable at all");
  assert.ok(b === null || b > a, `cheap rent retires at ${a}, dear at ${b} — must cost time`);
});

function IL_(mod) { return mod.IL; }

console.log(`\n${n} checks passed`);
