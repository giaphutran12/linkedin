# Edward Engine Local Reader Extension

This is the unpacked Chrome extension that powers the private local-only LinkedIn reader.

## Load it

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this `extension/` folder

## What it does

- listens for dashboard messages from `http://localhost:3000`
- pairs with Edward Engine over localhost
- opens LinkedIn tabs in the background
- extracts visible profile, activity, and post data
- sends normalized payloads back to the local app

## What it does not do

- it does not run against remote deployments
- it does not rely on private LinkedIn APIs
- it does not scrape hidden data
- it does not replace the official LinkedIn publish connector
