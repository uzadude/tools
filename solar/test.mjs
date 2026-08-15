/* Self-check for the solar model's pure functions.
 *
 *   node solar/test.mjs
 *
 * No build step and no test framework: this reads index.html and pulls the pure section
 * (constants through readState) straight out of it, so the assertions can't drift from
 * the file that actually ships. Everything past that point touches the DOM.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "index.html"), "utf8");

const from = src.indexOf("const IL = {");
// cut at the start of the chart-helpers banner, not inside it, or the comment block
// is left unterminated and the whole slice fails to parse
const to = src.lastIndexOf("/*", src.indexOf("   SVG CHART HELPERS"));
assert.ok(from > 0 && to > from, "could not locate the pure section in index.html");

const EXPORTS = ["IL", "productionInYear", "annualValue", "buildCashflows",
  "paybackYears", "npv", "irr", "summarise", "monthlyPayment", "capitalCharge"];
const m = new Function(`${src.slice(from, to)}; return {${EXPORTS.join(",")}};`)();

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) < tol, `${msg}: got ${a}, want ~${b}`);
let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

const system = (over = {}) => ({
  sizeKwp: 10, costPerKwp: 4500, roofArea: 60, m2PerKwp: 5.5,
  yieldPerKwp: 1600,
  billMonthly: 700, retailTariff: 0.635, consumption: 700 * 12 / 0.635,
  selfShare: 0.30,
  scheme: "feed", exportTariff: 0.48, tariffYears: 25, premium: 0,
  opex: 600, inverterCost: 5000, inverterYear: 13,
  financeMode: "cash", loanRate: 0.04, loanYears: 15,
  degradation: 0.005, horizon: 25, escalation: 0, discount: 0.03,
  ...over,
});

/* ---- production ---- */
test("year one is full rated output", () => {
  near(m.productionInYear(10, 1600, 0.005, 1), 16000, 1e-9, "10 kWp at 1600");
});
test("panels degrade from year two on", () => {
  near(m.productionInYear(10, 1600, 0.005, 2), 16000 * 0.995, 1e-6, "year 2");
  near(m.productionInYear(10, 1600, 0.005, 3), 16000 * 0.995 ** 2, 1e-6, "year 3");
  assert.equal(m.productionInYear(0, 1600, 0.005, 1), 0, "no system, no output");
});

/* ---- what a year is worth ---- */
test("self-consumption is capped by what the house uses", () => {
  // wants 80% of 16,000 but only consumes 5,000
  const v = m.annualValue(16000, 5000, 0.8, 0.635, 0.48, 0);
  near(v.selfKwh, 5000, 1e-9, "capped at consumption");
  near(v.exportKwh, 11000, 1e-9, "the rest is exported");
});
test("self-consumption is capped by what the roof makes", () => {
  const v = m.annualValue(3000, 99000, 1.0, 0.635, 0.48, 0);
  near(v.selfKwh, 3000, 1e-9, "can't use more than it generates");
  near(v.exportKwh, 0, 1e-9, "nothing left to export");
});
test("a kWh used at home beats one sold", () => {
  const home = m.annualValue(10000, 10000, 1.0, 0.635, 0.48, 0).gross;
  const sold = m.annualValue(10000, 10000, 0.0, 0.635, 0.48, 0).gross;
  near(home, 6350, 1e-9, "all self-consumed");
  near(sold, 4800, 1e-9, "all exported");
  assert.ok(home > sold, "self-consumption must be worth more");
});
test("the urban premium only applies to exported units", () => {
  const v = m.annualValue(10000, 2000, 0.2, 0.635, 0.48, 0.06);
  near(v.premiumValue, 8000 * 0.06, 1e-9, "8,000 kWh exported");
  const none = m.annualValue(10000, 10000, 1.0, 0.635, 0.48, 0.06);
  near(none.premiumValue, 0, 1e-9, "nothing exported, no premium");
});

/* ---- the cash-flow series ---- */
test("year zero is the installer's bill", () => {
  const rows = m.buildCashflows(system());
  near(rows[0].net, -45000, 1e-9, "10 kWp at 4,500");
  assert.equal(rows.length, 26, "year 0 plus 25 years");
  assert.equal(rows[0].year, 0);
});
test("the inverter is replaced once, in its year", () => {
  const s = system({ inverterCost: 5000, inverterYear: 13 });
  const rows = m.buildCashflows(s);
  const hit = rows.filter(r => r.opex > s.opex);
  assert.equal(hit.length, 1, "exactly one replacement");
  assert.equal(hit[0].year, 13, "in year 13");
  near(hit[0].opex, s.opex + 5000, 1e-9, "costing the stated amount");
});
test("export income stops when the contract does", () => {
  const rows = m.buildCashflows(system({ tariffYears: 10, horizon: 15, selfShare: 0.3 }));
  assert.ok(rows[10].exportValue > 0, "paid inside the term");
  near(rows[11].exportValue, 0, 1e-9, "nothing after it");
  assert.ok(rows[11].selfValue > 0, "but self-consumption keeps earning");
});
test("cumulative is the running total of the years", () => {
  const rows = m.buildCashflows(system());
  let acc = 0;
  for (const r of rows){ acc += r.net; near(r.cumulative, acc, 1e-6, `cumulative at year ${r.year}`); }
});

/* ---- payback ---- */
test("payback interpolates inside the year", () => {
  // 1,000 out, 250 back every year -> exactly 4 years, not 4-and-a-bit
  const rows = [{ year: 0, net: -1000 }, ...Array.from({ length: 6 }, (_, i) => ({ year: i + 1, net: 250 }))];
  let acc = 0; rows.forEach(r => { acc += r.net; r.cumulative = acc; });
  near(m.paybackYears(rows), 4, 1e-9, "flat 250 a year against 1,000");
});
test("payback is null when it never gets there", () => {
  const rows = [{ year: 0, net: -1000, cumulative: -1000 }, { year: 1, net: 10, cumulative: -990 }];
  assert.equal(m.paybackYears(rows), null);
});
test("a cheaper system pays back sooner", () => {
  const dear = m.summarise(system({ costPerKwp: 6000 })).payback;
  const cheap = m.summarise(system({ costPerKwp: 3000 })).payback;
  assert.ok(cheap < dear, `cheap ${cheap} should beat dear ${dear}`);
});

/* ---- npv and irr ---- */
test("npv at zero percent is just the sum", () => {
  const rows = m.buildCashflows(system());
  const sum = rows.reduce((a, r) => a + r.net, 0);
  near(m.npv(rows, 0), sum, 1e-6, "undiscounted");
});
test("npv falls as the discount rate rises", () => {
  const rows = m.buildCashflows(system());
  assert.ok(m.npv(rows, 0.10) < m.npv(rows, 0.03), "later money is worth less");
});
test("irr is the rate that zeroes the npv", () => {
  const rows = [{ year: 0, net: -1000 }, { year: 1, net: 500 }, { year: 2, net: 500 }, { year: 3, net: 500 }];
  const r = m.irr(rows);
  near(m.npv(rows, r), 0, 0.01, "npv at the irr");
  assert.ok(r > 0.2 && r < 0.3, `expected roughly 23%, got ${(r * 100).toFixed(1)}%`);
});
test("irr is null when the project never profits", () => {
  const rows = [{ year: 0, net: -1000 }, { year: 1, net: 100 }, { year: 2, net: 100 }];
  assert.equal(m.irr(rows), null, "no rate rescues a permanent loss");
});

/* ---- against the published example ----
   A 10 kWp system generating ~16,000 kWh, all of it exported at 0.48, is widely
   quoted as ~7,680 a year and about a 7-year payback on ~55,000. If the model
   can't reproduce that, it's the model that's wrong. */
test("reproduces the industry example figures", () => {
  const s = system({ sizeKwp: 10, yieldPerKwp: 1600, selfShare: 0, exportTariff: 0.48,
                     costPerKwp: 5500, opex: 0, inverterCost: 0, degradation: 0 });
  const r = m.summarise(s);
  near(r.y1.produced, 16000, 1e-9, "annual generation");
  near(r.y1.net, 7680, 1e-9, "annual income, all exported");
  near(r.payback, 55000 / 7680, 0.01, "simple payback");
  assert.ok(r.payback > 7 && r.payback < 7.5, `~7.2 years, got ${r.payback.toFixed(2)}`);
});

/* ---- the cost of the money ---- */
test("amortisation matches the textbook payment", () => {
  // 100,000 at 5% over 10 years is the standard 1,060.66 a month
  near(m.monthlyPayment(100000, 0.05, 10), 1060.66, 0.01, "5% over 10 years");
  near(m.monthlyPayment(0, 0.05, 10), 0, 1e-9, "nothing borrowed, nothing owed");
  near(m.monthlyPayment(100000, 0, 10), 100000/120, 1e-9, "interest-free is just division");
});
test("the payments really do repay the principal", () => {
  // amortise it month by month and the balance must land on zero
  const P = 45000, rate = 0.04, years = 15;
  const pay = m.monthlyPayment(P, rate, years);
  let bal = P;
  for (let i = 0; i < years * 12; i++) bal = bal + bal * (rate/12) - pay;
  near(bal, 0, 0.01, "balance at the end of the term");
});
test("a loan and forgone returns at the same rate cost the same", () => {
  const a = m.capitalCharge(system({ financeMode: "loan", loanRate: 0.03, loanYears: 25 }));
  const b = m.capitalCharge(system({ financeMode: "cash", discount: 0.03, horizon: 25 }));
  near(a.monthly, b.monthly, 1e-9, "same money, same cost, different story");
});
test("borrowing puts nothing down and a payment in every year of the term", () => {
  const s = system({ financeMode: "loan", loanYears: 15 });
  const rows = m.buildCashflows(s);
  near(rows[0].net, 0, 1e-9, "no lump on day one");
  const pay = m.monthlyPayment(45000, s.loanRate, 15) * 12;
  near(rows[1].capital, pay, 1e-9, "charged in year 1");
  near(rows[15].capital, pay, 1e-9, "and in the last year of the term");
  near(rows[16].capital, 0, 1e-9, "but not after it");
  near(rows[16].net, rows[16].operating, 1e-9, "past the term, net is the whole operating income");
});
test("paying cash puts the whole cost on day one and none after", () => {
  const rows = m.buildCashflows(system({ financeMode: "cash" }));
  near(rows[0].net, -45000, 1e-9, "the installer's bill");
  for (const r of rows.slice(1)) near(r.capital, 0, 1e-9, `no capital charge in year ${r.year}`);
});

test("the installation costs the same however you pay for it", () => {
  // regression: capex was read off row zero, which financing zeroes out, so a
  // borrowed system reported an installation cost of nothing
  near(m.summarise(system({ financeMode: "cash" })).capex, 45000, 1e-9, "cash");
  near(m.summarise(system({ financeMode: "loan" })).capex, 45000, 1e-9, "borrowed");
});
test("borrowed has no payback question rather than a failed one", () => {
  // regression: with no upfront lump the cumulative never crosses zero, so payback
  // came back null and rendered as "never" — the opposite of what's happening
  const r = m.summarise(system({ financeMode: "loan" }));
  assert.equal(r.paybackNA, true, "nothing was paid upfront");
  assert.ok(r.lifetime > 0, `and it is in fact well ahead: ${Math.round(r.lifetime)}`);
  const cash = m.summarise(system({ financeMode: "cash" }));
  assert.equal(cash.paybackNA, false, "paying cash does pose the question");
  assert.ok(cash.payback > 0, "and answers it");
});
test("no rate of return without capital at risk", () => {
  // regression: the guard accepted any negative year, and year 13's inverter
  // replacement supplied one — yielding a 1,638,400% return on nothing invested
  assert.equal(m.summarise(system({ financeMode: "loan" })).irr, null, "borrowed");
  const cash = m.summarise(system({ financeMode: "cash" })).irr;
  assert.ok(cash > 0.05 && cash < 0.5, `cash should be a sane rate, got ${cash}`);
});

/* ---- monthly income, the headline figure ---- */
test("monthly income is just the first year over twelve", () => {
  const r = m.summarise(system());
  near(r.monthlyY1, r.y1.operating / 12, 1e-9, "year one per month");
});
test("net monthly is what the panels earn less what the money costs", () => {
  const r = m.summarise(system());
  near(r.netMonthlyY1, r.monthlyY1 - r.capitalMonthly, 1e-9, "net of capital");
  assert.ok(r.netMonthlyY1 < r.monthlyY1, "the capital charge must bite");
});
test("under a loan, net monthly is exactly the year's cash flow", () => {
  const r = m.summarise(system({ financeMode: "loan" }));
  near(r.netMonthlyY1, r.rows[1].net / 12, 1e-9, "no double counting");
});
test("a cheaper system nets more per month", () => {
  const dear = m.summarise(system({ costPerKwp: 6000 })).netMonthlyY1;
  const cheap = m.summarise(system({ costPerKwp: 3000 })).netMonthlyY1;
  assert.ok(cheap > dear, `cheap ${cheap} should beat dear ${dear}`);
  // ...which the gross figure can't see at all, and is why the levers use the net one
  near(m.summarise(system({ costPerKwp: 6000 })).monthlyY1,
       m.summarise(system({ costPerKwp: 3000 })).monthlyY1, 1e-9, "gross is blind to price");
});
test("the average is the mean of the earning years", () => {
  const r = m.summarise(system());
  const mean = r.rows.slice(1).reduce((a, x) => a + x.operating, 0) / (r.rows.length - 1) / 12;
  near(r.monthlyAvg, mean, 1e-9, "averaged over the horizon");
});
test("with nothing decaying, the average equals year one", () => {
  const r = m.summarise(system({ degradation: 0, inverterCost: 0, escalation: 0, tariffYears: 25, horizon: 25 }));
  near(r.monthlyAvg, r.monthlyY1, 1e-9, "flat system, flat income");
});
test("degradation and the inverter drag the average below year one", () => {
  const r = m.summarise(system({ degradation: 0.005, inverterCost: 5000, escalation: 0 }));
  assert.ok(r.monthlyAvg < r.monthlyY1, `avg ${r.monthlyAvg} should trail year one ${r.monthlyY1}`);
});
test("post-payback income only counts years after payback", () => {
  const r = m.summarise(system());
  assert.ok(r.payback !== null, "this example does pay back");
  const after = r.rows.filter(x => x.year > r.payback);
  near(r.monthlyAfter, after.reduce((a, x) => a + x.net, 0) / after.length / 12, 1e-9, "mean of the later years");
});
test("post-payback income is zero when it never pays back", () => {
  const r = m.summarise(system({ costPerKwp: 40000 }));
  assert.equal(r.payback, null, "far too expensive to repay");
  assert.equal(r.monthlyAfter, 0, "nothing to report");
  assert.ok(r.monthlyY1 > 0, "but it still earns every month");
});

/* ---- the headline claim: self-consumption drives the answer ---- */
test("monthly income rises with self-consumption", () => {
  let prev = -Infinity;
  for (let share = 0; share <= 1.0001; share += 0.1){
    const mo = m.summarise(system({ selfShare: share })).monthlyY1;
    assert.ok(mo >= prev - 1e-9, `share ${share.toFixed(1)} earned less than the step before`);
    prev = mo;
  }
});
test("using more on site always pays back at least as fast", () => {
  let prev = Infinity;
  for (let share = 0; share <= 1.0001; share += 0.1){
    const p = m.summarise(system({ selfShare: share })).payback;
    assert.ok(p !== null, `share ${share.toFixed(1)} should still pay back`);
    assert.ok(p <= prev + 1e-9, `share ${share.toFixed(1)} paid back slower than the step before`);
    prev = p;
  }
});
test("a system far bigger than the household exports the surplus", () => {
  const s = system({ sizeKwp: 40, selfShare: 1.0 });
  const r = m.summarise(s);
  near(r.y1.selfKwh, s.consumption, 1e-6, "self-use stops at consumption");
  assert.ok(r.y1.exportKwh > 0, "the surplus has to go somewhere");
});

console.log(`\n${n} checks passed`);
