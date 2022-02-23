# Shellies

A simple web services that lists all shellies and
allows you to open them straight from the browser.

I created this so I can monitor any outdate shellies
that I want to update and do that easily from one place.

It assumes your shellies use authentication, and reuses
that same authentication to log into this app.

## Develop

I recommend creating a `.env` file with `SHELLY_USERNAME` and `SHELLY_PASSWORD`

```
yarn
yarn watch
```

Now browse to [https://localhost:3000]();
