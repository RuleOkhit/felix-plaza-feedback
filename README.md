# Felix Plaza · Feedback

A mobile-first guest feedback form for Felix Plaza. It follows the "Felix Plaza Feedback Form — Build Spec" (Oct 2026) and is plain HTML, CSS and JS with no build step.

**Live:** https://ruleokhit.github.io/felix-plaza-feedback/ (kept out of search engines with noindex tags)

## Run it locally

```bash
python -m http.server 5180
```

Then open http://localhost:5180.

## Two modes

| Link | What guests get |
| --- | --- |
| `/` | **Full form:** 6 steps, about 2–3 minutes. |
| `/?mode=quick` | **Quick mode:** overall rating, recommend score, and "anything else?". Under 30 seconds. Meant for QR stands. |

In the full form:

- **Step 1** has the three required questions: visit frequency, star rating and recommend score.
- After step 1, a checkpoint lets guests submit straight away or keep going.
- Quick mode's thank-you screen offers **"Have 2 more minutes? Tell us more"**. It opens the full form at step 2 under the same response ID, so the answers combine into one response.

Follow-ups open right under the question that triggers them, only while the answer matches. For example, 1–2 stars opens "What went wrong?", and a low facility rating opens a note for that row.

Changes from the spec, made after design review:

- Q2a, Q2b and Q2c are tap-to-pick chips, with "Other" opening a short box, instead of free-text boxes.
- Q3c ("What would you tell them?") is dropped.
- Q8 ("brands you'd like to see") is dropped.
- Q12 offers only WhatsApp, Instagram and "Don't contact me". The thank-you screen adds Instagram and WhatsApp links only for guests who picked them.
- Next appears only once a required question is answered. Picking "First time" scrolls down to "How did you hear about us?".

## Link options

| Parameter | Example | What it does |
| --- | --- | --- |
| `src` | `?src=foodcourt` | Records where the guest scanned (`exit-gate2`, `website`, …) |
| `mode` | `?mode=quick` | Quick mode |
| `kiosk` | `?kiosk=1` | Starts over 15s after the thank-you, for an info desk tablet |

## Saving

Answers are saved **every time someone taps Next**, so a guest who leaves on step 3 still counts for steps 1–2.

Each save is a full snapshot with the same `id`:

```json
{
  "id": "…", "mode": "full", "source": "foodcourt", "device": "mobile",
  "startedAt": "…", "updatedAt": "…", "status": "partial | complete", "lastStep": "s4",
  "answers": { "q1": "Monthly", "q2": 4, "q2b": ["Parking"], "q3": 8, "q6": { "parking": 2 }, "q6_notes": { "parking": "…" } }
}
```

How answers are stored:

- Stars are saved as 1–5 and the recommend score as 0–10, so they can be averaged and charted.
- Question IDs (`q1` to `q14a_*`) match the spec and are the same in both modes.
- Follow-ups whose trigger no longer applies are dropped before saving.

**Demo mode (now):** responses are kept in the browser's localStorage under `felix-feedback-responses`.

**Going live:** set `CONFIG.endpoint` in `app.js` to a URL that accepts a JSON POST and **upserts by `id`**, such as a Google Apps Script web app writing to a Sheet. Saves that fail on weak signal are queued and retried.

## Files

- `index.html`: page shell
- `styles.css`: theme, controls and motion
- `app.js`: question text and options, follow-up rules, flow and saving
- `assets/`: logos and section photos (cropped from the main site's hero and event images)
