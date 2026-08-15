# Rooftop Solar — Israel 2026

A single-file, offline calculator for what a home solar system is actually worth to you,
built around Israeli 2026 electricity tariffs. Open `index.html` in a browser, type your
numbers, and it answers two questions:

- **Are you better off each month, net of what the system cost you?**
- **How long until the installation has paid for itself**, and what's the monthly figure
  worth once it has?

The monthly number leads because it's the one you feel — but it's reported *net of the cost
of the money*, which is the part most solar calculators quietly drop. The panels earning
₪652 a month is not the same as being ₪652 a month better off, because ₪45,000 went
somewhere to make that happen.

## The cost of the money

Either you borrowed it and there's a payment every month, or you paid cash and gave up
whatever that money would otherwise have earned. Both are a real monthly cost and neither
appears on your electricity bill. Choose the framing in **Paying for it**:

- **Borrowed** — a loan at its own rate over its own term. Nothing leaves your pocket on day
  one, so there's no lump to earn back; the question is simply whether the panels out-earn
  the payment. Payback and rate of return are reported as *not applicable* rather than
  "never", because with no capital at risk neither question has an answer.
- **Cash** — the same sum expressed as an annuity at whatever the money would have earned
  instead. It's the identical formula: a loan and forgone returns at the same rate cost
  exactly the same, and the test suite pins that.

On the example figures the panels earn ₪652 a month; paying cash at 3% real that's ₪439 net,
and borrowing at 4% over 15 years it's ₪319 — rising to about ₪585 once the cost is behind
you either way.

This also fixes something the gross figure simply cannot show: negotiating the price down
doesn't change what the panels generate, so against a gross number it looks like it does
nothing at all. Net of capital, it moves.

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

**Costs.** The installed price — as a year-zero outflow if you pay cash, or as a monthly
payment across the term if you borrow — annual maintenance and insurance, and one inverter
replacement, which is the part that reliably doesn't outlive the panels.

**The answer.** The monthly figure is reported gross and net of the cost of the money, and
the net one leads. Underneath, it's broken out three ways, because they differ and only
quoting the flattering one would be dishonest: **year one**, which is the highest the system
will ever manage; the **average across your whole horizon**, which is lower once panels fade,
the inverter is replaced and the export contract runs out; and what it's worth **after
payback**, when the money stops repaying the installation and starts being yours. Alongside
those: payback itself, interpolated inside the year, the net position over the horizon, and
the internal rate of return on the cash-flow series, so the roof can be compared against
leaving the money elsewhere.

The levers table measures the *average* monthly rather than year one, deliberately. Changes
like rising electricity prices or skipping the inverter replacement only bite in later years,
and a year-one column would report them as doing nothing at all.

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
