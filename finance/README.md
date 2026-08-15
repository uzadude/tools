# Israeli Family Finance Model

A single-file, offline retirement and budget model built around Israeli tax, pension and
national insurance rules (2026). Open `index.html` in a browser, type your numbers, and it
answers two questions:

- **When can I stop working** and keep the lifestyle I have now?
- **If I stop at a given age, how much can I spend every month** for the rest of my life?

Everything runs in the browser. There is no server, no build step, no analytics, and no
network request of any kind — your figures never leave the page.

## Using it

Open `index.html`. That's the whole install.

The model ships with example figures so you can see it working; replace them with yours and
every number and chart recalculates as you type. **Save my numbers** downloads a small JSON
you can reload later — that file is gitignored here, and you should keep it that way.

Your figures are also remembered in this browser as you type, so closing the tab doesn't cost
you the afternoon's work. That's `localStorage` on your own machine — it never touches a
network, and no server is involved at any point. It does persist on disk until you clear it:
**Forget my numbers** erases it and puts the example figures back. On a machine that isn't
yours, use that before you walk away. The JSON export remains the copy you actually own and
the only way to move your figures between devices.

## Checking it still adds up

```
node finance/test.mjs
```

No framework and nothing to install. It reads `index.html`, pulls the pure functions out of
it and pins them: every 2026 bracket edge, the Bituach Leumi ceiling, the child credit-point
bands, who claims those points, the annuity exemption, and a round-trip proving the solved
mortgage rate really amortises the balance to zero over the term. Because it slices the
shipped file rather than a copy, the assertions can't quietly drift away from the model.
Worth running after touching any rate — the whole point of a rates table is that it changes.

## What it models

**Income and tax.** 2026 income tax brackets including January's reform, credit points for
each partner and per child by age, the §45a pension credit, Bituach Leumi and mas briut at
2026 rates with the 51,910 ₪ ceiling. Employees and self-employed are handled separately,
since deposits are a credit for one and a deduction for the other.

**Saving.** Pension at 6% employee + 6.5% employer + 6% pitzuim, optionally on full salary
rather than only up to the mandatory ceiling. Keren hishtalmut at 2.5% + 7.5% up to the
15,712 ₪ salary cap. Keren hishtalmut and gemel le'hashkaa count as accessible; pension is
locked until 60.

**Spending.** Separates the three things that behave differently over time: the lifestyle
itself, the mortgage (which ends when it's paid off, on a real amortisation schedule solved
from your balance, payment and term), and the kids (who grow up). Retiring early does not
make either of the latter two disappear — the model keeps charging them until they actually
run their course.

**Retirement.** Each partner's pension annuitises when *they* reach 60, at a conversion
factor that rises the earlier it's drawn. The annuity is then taxed as income — part of a
קצבה מזכה is exempt, the rest runs through the ordinary brackets with base credit points,
plus reduced health tax. The Bituach Leumi old-age pension is added tax-free at official
retirement age, which is 67 for men and 62–65 for women depending on birth year.

**Finding the answer.** For each candidate retirement age the model simulates the household
year by year to your plan horizon and checks whether accessible savings ever go negative.
The earliest age that survives is the answer. The spend-vs-age curve runs that whole search
once per spending level; the "most you could spend" figure bisects on spend at a fixed age.

Everything is in today's shekels, so inflation is netted out of the return assumptions
rather than inflating every figure.

## What it does not model

- **Sequence-of-returns risk.** A single fixed real return is the standard simplification
  and the most optimistic one in here. Real markets deliver a sequence, and a bad decade
  arriving just as you stop working hurts far more than the average suggests.
- **Deposit ceilings on קרן פנסיה מקיפה.** Contributions above roughly 5,645 ₪/month spill
  into a general fund or ביטוח מנהלים with different terms; the model treats all pension
  saving as one pot.
- **Rule changes.** Brackets, ceilings and the retirement age itself will move over a
  twenty-year horizon.
- **Anything specific to your funds** — actual fees, insurance riders, guarantee periods,
  or a spouse's survivor pension.

Treat the age it produces as a centre of gravity, not a date. It's a planning model, not
financial advice, and it's a good thing to take *to* a יועץ פנסיוני rather than instead of one.

## Sources

- [Israel Tax Authority — 2026 deduction tables](https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2026.pdf)
- [Bituach Leumi — contribution rates](https://www.btl.gov.il/Insurance/Rates/Pages/default.aspx)
- [Kol Zchut — קצבת זקנה](https://www.kolzchut.org.il/he/%D7%A7%D7%A6%D7%91%D7%AA_%D7%96%D7%99%D7%A7%D7%A0%D7%94_%D7%91%D7%A1%D7%99%D7%A1%D7%99%D7%AA)
- [2026 pension & hishtalmut ceilings](https://pensuni.com/?p=827)
- [CBS — Household Expenditure Survey](https://www.cbs.gov.il/en/publications/pages/2026/household-income-and-expenditure-data-from-the-2023-household-expenditure-survey-general-summary.aspx)
- [Bank of Israel — rate decisions](https://www.boi.org.il/en/communication-and-publications/press-releases/)

## Licence

MIT — see [LICENSE](../LICENSE).
