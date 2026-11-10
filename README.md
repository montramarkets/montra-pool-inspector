# Montra Pool Inspector

A read-only Elysium demo for inspecting Montra pools and simulating exact-input buys and sells. The official MONTRA address is prefilled.

## Run locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. The app has no dependency installation or build step.

## Publish with GitHub Pages

Upload these files to the root of a public repository. In **Settings → Pages**, select **Deploy from a branch**, then **main** and **/(root)**. The resulting Pages URL is the shareable demo.

## What it checks

- Resolves Lens and Router from the official registry and confirms chain ID 99901.
- Reads `tokenView` and verifies the hook with `isKnownHook`.
- Displays effective buy/sell fees and the configured anti-snipe end time.
- Reads ERC-20 decimals, encodes the exact input as an integer, and uses `eth_call` to run `quoteExactIn`. The quote and pool data use the same block. Inspect again to refresh.

The app uses the public Montra RPC directly. It neither requests wallet credentials nor signs or sends transactions. Figures are estimates for the selected block. The separate Uniswap core protocol fee, if enabled, is outside the displayed Montra fee fields.

[Build guide](https://montramarkets.xyz/docs/build) · [Contract addresses](https://montramarkets.xyz/docs/contracts) · [Official ABI bundle](https://montramarkets.xyz/docs/abis.json)
