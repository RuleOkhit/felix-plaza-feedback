# Felix Plaza · Feedback

A short, calm feedback page for Felix Plaza guests, built for phones first. It's plain HTML, CSS and JS with no build step.

## Run it locally

```bash
python -m http.server 5180
```

Then open http://localhost:5180.

## The flow

1. **How was your visit today?** Wonderful, Good, Could have been better, or Not good. Tapping an answer moves on.
2. **A follow-up in their own words.** The question changes with the answer, for example "Lovely to hear. What made it special?" or "We're sorry to hear that. What went wrong?". This one can be skipped.
3. **Stay in touch.** Happy guests are asked about event updates. Unhappy guests are offered a call from the team. "No, thank you" sends the feedback straight away. "Yes, please" asks for a name and mobile number.
4. **Thank you.** Happy guests see a link to review on Google. Unhappy guests who didn't ask for a call see the help desk number.

## Link options (for QR codes)

| Parameter | Example | What it does |
| --- | --- | --- |
| `src` | `?src=foodcourt` | Tags each response with where the guest scanned |
| `kiosk` | `?kiosk=1` | Starts over 12s after the thank-you, for a tablet at the info desk |

## Where responses go

The page is in **demo mode** for now. Each response is saved in the browser's localStorage under `felix-feedback-log`.

To collect responses for real, set `CONFIG.endpoint` at the top of `app.js` to a URL that accepts a JSON POST, such as a Google Apps Script web app writing to a Sheet. If sending fails because of weak signal, the response is queued and retried later.

## Files

- `index.html`: the four screens
- `styles.css`: all styling
- `app.js`: settings, the follow-up wording and submission
- `assets/`: the logo and favicon
