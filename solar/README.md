# Rooftop Solar — Israel 2026

A single-file, offline calculator for whether a home solar system pays for itself, built
around Israeli 2026 electricity tariffs. Open `index.html` in a browser, type your numbers,
and it answers one question:

- **How long until the installation pays for itself**, and what is it worth after that?

Everything runs in the browser. No server, no build step, no analytics, no network request
of any kind.

## Using it

Open `index.html`. That's the whole install.

It ships with typical 2026 figures so you can see it working; replace them with your own
quote. Your numbers are remembered in this browser as you type — `localStorage` on your own
machine, never a network. **Forget my numbers** erases that; **Save my numbers** downloads a
JSON copy you keep, which is also the only way to move figures between devices.

## Checking it still adds up

```
node solar/test.mjs
```

No framework, nothing to install. It reads `index.html`, pulls the pure functions out of it
and pins them: degradation, the self-consumption caps, the export-only urban premium, the
inverter replacement landing in one year, income stopping when the contract does, payback
interpolating inside the year, and IRR actually zeroing the NPV. It also reproduces the
industry-quoted example — a 10 kWp system generating ~16,000 kWh sold at 0.48 ₪ is ~7,680 ₪
a year and about a 7-year payback on ~55,000 ₪. If the model can't hit that, the model is
wrong. Because the test slices the shipped file rather than a copy, it can't drift.

## The one number that decides it

A kWh you use as it's generated saves you the full retail price, about **63.5 agorot**. The
same kWh exported earns the feed-in tariff, about **48 agorot**. So the split between the two
matters more than the total, and a calculator that multiplies kWp by a single price is
answering an easier question than the one you asked.

That share is also the lever you control most cheaply. Shifting the water heater, the washing
machine, the pool pump or an EV charge into daylight moves you along that curve for nothing.
The tool plots payback against it directly, because it's usually worth more than haggling
over the quote.

## What it models

**Generation.** System size times annual yield, falling by a degradation rate each year.
Israel runs about 1,500–1,750 kWh per kWp per year depending on orientation, tilt and shading.

**Tariffs.** The two live routes: **תעריף הזנה** (feed-in), the path for new systems, paying
roughly 48 agorot per exported kWh for systems up to 15 kWp; and **מונה נטו** (net metering),
the legacy arrangement largely closed to new installations, crediting exports far lower. The
urban premium of 6 agorot for towns over 50,000 residents is applied to exported units.
Switching route swaps the tariff in, so you never model a route at another route's price.

**Value.** Self-consumed units are valued at the retail tariff you avoid paying, capped by
what your household actually uses — a roof cannot save you more electricity than you buy.
Exported units are valued at the feed-in rate plus any premium.

**Costs.** The installed price as a year-zero outflow, annual maintenance and insurance, and
one inverter replacement, which is the part that reliably doesn't outlive the panels.

**The answer.** Payback is where the cumulative position crosses zero, interpolated inside
the year. Alongside it: net position over your horizon, and the internal rate of return on
the whole cash-flow series, so you can compare the roof against leaving the money elsewhere.

Everything is in today's shekels, so inflation is netted out rather than inflating every
figure.

## What it does not model

- **Batteries.** They change the self-consumption share dramatically, which is exactly the
  lever this tool is built around — so their absence matters more here than most omissions.
  Model them by hand for now by raising the self-consumption slider and adding their cost to
  the installed price.
- **Where the urban premium actually attaches.** Sources differ on whether the 6 agorot is
  paid per kWh *generated* or per kWh *exported*. This applies it to exported units, which is
  the more conservative reading. If yours is paid on generation, the tool understates you.
- **Time-of-use tariffs (תעו״ז).** A flat retail price is assumed. If you're on a
  time-of-use plan, the units solar displaces are daytime ones and may be priced differently.
- **Hourly matching.** Self-consumption is a single annual share, not a simulation against
  your actual half-hourly load. Without interval data from your meter that share is a guess,
  and it's the most important input here.
- **Tariff changes.** The Electricity Authority has revised these repeatedly. Your feed-in
  rate is locked for the contract term; the retail price it's measured against is not.
- **What a quote includes.** Scaffolding, a new distribution board, structural work on an old
  roof, and VAT treatment all vary between installers.

Treat the payback figure as a centre of gravity, not a date. It's a planning model, not a
quote and not advice — a good thing to take *to* an installer rather than instead of one.

## Sources

- [Electricity Authority](https://www.gov.il/he/departments/electricity_authority)
- [Current residential tariff per kWh](https://www.chashmalink.com/cost-kwh)
- [2026 electricity tariff guide — ECOTECH](https://ecot.co.il/madrich-chashmal-2026)
- [Solar tariff routes for 2026](https://bipv.co.il/%D7%9C%D7%9E%D7%99-%D7%A9%D7%97%D7%95%D7%A9%D7%91-%D7%A2%D7%9C-%D7%A1%D7%95%D7%9C%D7%90%D7%A8%D7%99-%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C/)
- [Installation costs per kWp](https://volta.solar/knowledge-center/%D7%A2%D7%9C%D7%95%D7%AA-%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA-%D7%A1%D7%95%D7%9C%D7%90%D7%A8%D7%99%D7%AA/)

## Licence

MIT — see [../LICENSE](../LICENSE).
