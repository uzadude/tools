# tools

Small, self-contained tools I actually use. Each one is a single HTML file with no build
step, no dependencies, and no network calls — open it in a browser and it works, offline,
forever. Nothing you type into any of them leaves the page.

## What's here

| Tool | What it answers |
|------|-----------------|
| [finance](finance/) | When can we retire, how much can we spend, and where does the money go — modelled on Israeli tax, pension and Bituach Leumi rules. |

## Conventions

Each tool is a folder containing `index.html` and a `README.md`. That keeps GitHub Pages
URLs clean (`/tools/finance/` serves the model directly) and means a tool can be copied out
and used on its own without dragging anything with it. A tool doing arithmetic anyone would
act on also carries a `test.mjs` — plain `node`, no framework, run it directly.

The rules that keep these useful:

- **One file.** All CSS and JS inline. No bundler, no `node_modules`, nothing to install or
  re-install in three years when you come back to it.
- **No network.** No CDN links, no fonts, no analytics. A tool that stops working when a CDN
  moves is not a tool you own.
- **Nothing leaves the device.** A tool may remember what you typed so it's still there next
  time, but only in your own browser, and only ever alongside a way to erase it and an export
  you own. Convenience never becomes a reason for your data to travel.
- **Say what it doesn't do.** Every model is wrong somewhere. Each README documents its own
  limitations, because the failure mode of a confident calculator is that you believe it.

## Private data stays out

Some of these export your real figures to a JSON file. Those exports are gitignored by name
and belong somewhere outside this folder. Check `.gitignore` before adding a tool that saves
anything personal.

A tool that remembers your input keeps it in that browser's `localStorage`, on that machine,
and nowhere else. It never reaches this repo — but it does sit on disk until you clear it, so
on a shared or borrowed machine, use the tool's erase button when you're done.

## Licence

MIT — see [LICENSE](LICENSE).
