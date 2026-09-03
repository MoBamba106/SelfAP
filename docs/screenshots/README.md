# Screenshots

These images are generated, not committed by hand, so they cannot drift from the UI:

```bash
npm i -D playwright
npx playwright install chromium

NEXT_PUBLIC_DEMO=1 npm run dev        # in another terminal
npm run screenshots
```

That writes `01-dashboard.png` through `10-mobile-dashboard.png` into this folder, capturing the
demo account's seeded data. Nothing is written to a database.
