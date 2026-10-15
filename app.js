/* ---------------------------------------------------------------------------
   Felix Plaza · Feedback
   Questions and flow follow "Felix Plaza Feedback Form — Build Spec" (Oct 2026).
   Full mode: 14 questions over 6 steps. Quick mode (?mode=quick): Q2, Q3, Q13.
   Plain JS, no build step.
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  const CONFIG = {
    // Responses are POSTed here as JSON after every step, all sharing one `id`,
    // so the receiver should upsert by id. Empty = demo mode (saved to this
    // browser's localStorage under "felix-feedback-responses").
    endpoint: "",
    reviewUrl: "https://maps.app.goo.gl/4qgFhVqp1fYWG3KQ7",
    kioskResetMs: 15000,
  };

  /* ---- Context captured automatically ----------------------------------- */
  const params = new URLSearchParams(location.search);
  const MODE = params.get("mode") === "quick" ? "quick" : "full";
  const SOURCE = params.get("src") || "direct";
  const KIOSK = params.get("kiosk") === "1";
  const DEVICE = matchMedia("(pointer: coarse)").matches || /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop";
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const RESPONSE = { id: params.get("rid") || uid(), startedAt: new Date().toISOString() };

  /* ---- Option lists (order fixed; "Other" and "Didn't use" last) -------- */
  const OPT = {
    q1: ["First time", "Several times a week", "Weekly", "Monthly", "A few times a year"],
    q1a: ["Social media", "Friends/family", "Google/Maps", "Passing by", "Event/promotion", "Other"],
    issues: ["Cleanliness", "Crowding", "Parking", "Staff behaviour", "Store/brand options", "Prices", "Washrooms", "Safety", "Other"],
    q4: ["Shopping", "Food & dining", "Movies", "Kids' play area", "Events", "Just hanging out", "Work/meeting", "Other"],
    q5: ["Alone", "Partner", "Family with kids", "Friends", "Colleagues"],
    q6: [
      ["parking", "Parking availability & ease"],
      ["cleanliness", "Cleanliness of common areas"],
      ["washrooms", "Washrooms"],
      ["signage", "Signage & finding stores"],
      ["seating", "Seating / rest areas"],
      ["lifts", "Lifts & escalators"],
      ["security", "Security & feeling of safety"],
      ["comfort", "Air conditioning / comfort"],
    ],
    q7: ["Yes, everything", "Partly", "No"],
    q9a: ["More variety", "Better hygiene", "Lower prices", "More seating", "Faster service", "Healthier options", "Other"],
    yesno: ["Yes", "No"],
    q11b: ["Live music", "Kids' activities", "Festive celebrations", "Flea/pop-up markets", "Workshops", "Fitness sessions", "Movie screenings", "Sales/offers", "Other"],
    q2c: ["Stores & brands", "Food", "Ambience", "Events", "Cleanliness", "Helpful staff", "Kids' fun", "Other"],
    q12: ["WhatsApp", "Instagram", "Don't contact me"],
  };
  const STEPS = 6;
  const STAR_WORDS = ["Terrible", "Poor", "Okay", "Good", "Loved it!"];

  /* ---- Answers ----------------------------------------------------------- */
  const A = { q6: {}, q6_notes: {} };

  // Single-choice questions whose answer can be changed but not cleared.
  const REQUIRED = new Set(["q1"]);

  // Follow-ups: shown (and kept in the saved answers) only while their rule holds.
  const RULES = {
    q1a: () => A.q1 === "First time",
    q2a: () => A.q2 >= 1 && A.q2 <= 2,
    q2b: () => A.q2 >= 3 && A.q2 <= 4,
    q2c: () => A.q2 === 5,
    q3a: () => A.q3 != null && A.q3 <= 6,
    q3b: () => A.q3 >= 7 && A.q3 <= 8,
    q7a: () => A.q7 === "Partly" || A.q7 === "No",
    q9a: () => typeof A.q9 === "number" && A.q9 <= 3,
    q10x: () => A.q10 === "Yes",
    q11a: () => A.q11 === "Yes",
    q14a: () => A.q14 === "Yes",
  };
  const RULE_KEYS = {
    q1a: ["q1a", "q1a_other"], q2a: ["q2a", "q2a_other"], q2b: ["q2b", "q2b_other"], q2c: ["q2c", "q2c_other"],
    q3a: ["q3a"], q3b: ["q3b"], q7a: ["q7a"], q9a: ["q9a", "q9a_other"],
    q10x: ["q10a", "q10b"], q11a: ["q11a"], q14a: ["q14a_name", "q14a_contact", "q14a_consent"],
  };

  /* ---- Small helpers ----------------------------------------------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (_) {} };
  const local = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6c.4 0 .7.2.9.6l2.4 4.9 5.4.8c.9.1 1.2 1.2.6 1.8l-3.9 3.8.9 5.4c.2.9-.8 1.6-1.6 1.1L12 18.5 7.2 21c-.8.5-1.8-.2-1.6-1.1l.9-5.4-3.9-3.8c-.6-.6-.3-1.7.6-1.8l5.4-.8L11 3.2c.3-.4.6-.6 1-.6z"/></svg>';
  const ARROW = '<svg class="go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const toneFor = (v, max) => (max === 10 ? (v <= 6 ? "var(--rose)" : v <= 8 ? "var(--amber)" : "var(--brand)") : (v <= 2 ? "var(--rose)" : v === 3 ? "var(--amber)" : "var(--brand)"));
  const LOGO = '<img class="hero-logo" src="assets/logo-felix-plaza-white.png" width="700" height="528" alt="Felix Plaza">';

  /* ---- Building blocks (return HTML) ------------------------------------- */
  const Q = (id, title, body, help = "", required = false) =>
    `<section class="q" data-qid="${id}">
      <h2 class="q-title" id="t-${id}">${title}${required ? ' <span class="req" aria-label="required">*</span>' : ""}</h2>
      ${help ? `<p class="q-help">${help}</p>` : ""}${body}
    </section>`;

  const follow = (rule, inner) =>
    `<div class="reveal" data-show="${rule}" inert><div><div class="follow">${inner}</div></div></div>`;

  const single = (q, opts) =>
    `<div class="stack" role="radiogroup" aria-labelledby="t-${q}">${opts.map((o) =>
      `<button type="button" class="opt" role="radio" aria-checked="false" data-q="${q}" data-v="${esc(o)}" data-kind="single">${esc(o)}<span class="dot"></span></button>`).join("")}</div>`;

  const chipBtn = (q, o, kind, extra = "") => kind === "multi"
    ? `<button type="button" class="chip" aria-pressed="false" data-q="${q}" data-v="${esc(o)}" data-kind="multi"${extra}>${CHECK}${esc(o)}</button>`
    : `<button type="button" class="chip" role="radio" aria-checked="false" data-q="${q}" data-v="${esc(o)}" data-kind="single"${extra}>${CHECK}${esc(o)}</button>`;

  // `other`: picking "Other" opens a short text box inline.
  const chips = (q, opts, { multi = true, other = false } = {}) =>
    `<div class="chips" role="${multi ? "group" : "radiogroup"}" aria-labelledby="t-${q}">${opts.map((o) => chipBtn(q, o, multi ? "multi" : "single")).join("")}</div>
    ${other ? `<div class="reveal" data-show-other="${q}" inert><div><input class="input other" data-q="${q}_other" maxlength="120" placeholder="Please tell us" aria-label="Other, please specify"></div></div>` : ""}`;

  const text = (q, ph, multi = false, label = "") => {
    const lab = label ? `<span class="field-label">${label}</span>` : "";
    // Questions have a title to point at; extra boxes (q2a_text, q6_notes.x) don't.
    const name = label ? "" : /[._]/.test(q) ? `aria-label="${esc(ph)}"` : `aria-labelledby="t-${q}"`;
    return multi
      ? `<label class="field">${lab}<textarea class="input" data-q="${q}" maxlength="1000" placeholder="${esc(ph)}" ${name}></textarea></label>`
      : `<label class="field">${lab}<input class="input" data-q="${q}" maxlength="200" placeholder="${esc(ph)}" ${name}></label>`;
  };

  const stars = (q, { big = false, row = "", skip = "" } = {}) => {
    const data = `data-q="${q}"${row ? ` data-row="${row}"` : ""}`;
    const btns = [1, 2, 3, 4, 5].map((n) =>
      `<button type="button" class="star" style="--i:${n - 1}" ${data} data-star="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">${STAR}</button>`).join("");
    const skipBtn = skip ? `<button type="button" class="chip" aria-pressed="false" ${data} data-v="${esc(skip)}" data-kind="skip">${esc(skip)}</button>` : "";
    if (big) return `<div class="stars-wrap"><div class="stars" role="group" aria-labelledby="t-${q}" data-stars="${q}">${btns}</div><div class="star-word" data-word="${q}"></div>${skipBtn}</div>`;
    return `<div class="row-ctrl"><div class="stars" role="group" data-stars="${q}" data-row="${row}">${btns}</div>${skipBtn}</div>`;
  };

  const nps = (q) =>
    `<div class="nps untouched" data-nps="${q}">
      <div class="nps-read" aria-hidden="true"><span class="nps-num">?</span><span class="nps-word">Slide or tap a number</span></div>
      <input class="range" type="range" min="0" max="10" step="1" value="5" data-q="${q}" aria-labelledby="t-${q}" aria-valuetext="Not answered">
      <div class="ticks">${Array.from({ length: 11 }, (_, n) => `<button type="button" data-tick="${n}" aria-label="${n}">${n}</button>`).join("")}</div>
      <div class="ends"><span>Not at all likely</span><span>Extremely likely</span></div>
    </div>`;

  const yesno = (q) => `<div class="yesno" role="radiogroup" aria-labelledby="t-${q}">${OPT.yesno.map((o) => chipBtn(q, o, "single")).join("")}</div>`;

  const banner = (img, title) => `<div class="banner" style="background-image:url(assets/img/${img}.webp)" aria-hidden="true"><span>${title}</span></div>`;

  // The opening photo, with the logo and greeting inside it.
  const hero = () =>
    `<div class="hero" style="background-image:url(assets/img/welcome.webp)">${LOGO}
      <p class="hello">${MODE === "quick" ? "Hi! Thanks for visiting Felix Plaza." : "Hi! Tell us about your visit."}</p>
    </div>`;

  /* ---- Screens ----------------------------------------------------------- */
  // sec = which of the 6 steps the screen belongs to. valid() gates the Next button.
  const SCREENS = {
    s1: {
      sec: 0,
      valid: () => !!A.q1,
      html: () => Q("q1", "How often do you visit Felix Plaza?", single("q1", OPT.q1) +
        follow("q1a", Q("q1a", "Welcome! How did you hear about us?", chips("q1a", OPT.q1a, { multi: false, other: true })))),
    },
    s2: {
      sec: 0,
      valid: () => !!A.q2,
      html: () => Q("q2", "How would you rate your visit today?", stars("q2", { big: true })) +
        follow("q2a", Q("q2a", "Sorry about that. What went wrong?", chips("q2a", OPT.issues, { other: true }), "Pick any that apply")) +
        follow("q2b", Q("q2b", "What would have made it a 5?", chips("q2b", OPT.issues, { other: true }), "Pick any that apply")) +
        follow("q2c", Q("q2c", "Lovely! What did you enjoy most?", chips("q2c", OPT.q2c, { other: true }), "Pick any that apply")),
    },
    s3: {
      sec: 0,
      valid: () => A.q3 != null,
      html: () => Q("q3", "How likely are you to recommend Felix Plaza to a friend or family member?", nps("q3")) +
        follow("q3a", Q("q3a", "What's one thing we could do better?", text("q3a", "Be as honest as you like", true))) +
        follow("q3b", Q("q3b", "What would make you more likely to recommend us?", text("q3b", "One thing would make the difference…", true))),
    },
    checkpoint: { sec: 0, plain: true },
    s4: {
      sec: 1,
      html: () => banner("visit", "Your visit") +
        Q("q4", "What brought you here today?", chips("q4", OPT.q4, { other: true }), "Pick all that apply") +
        Q("q5", "Who are you visiting with?", chips("q5", OPT.q5, { multi: false })),
    },
    s5: {
      sec: 2,
      html: () => banner("facilities", "Facilities") + Q("q6", "How were our facilities?", `<div class="rows">${OPT.q6.map(([key, label]) =>
        `<div class="row"><p class="row-name" id="r-${key}">${label}</p>${stars("q6", { row: key, skip: "Didn't use" })}
          <div class="reveal" data-show-row="${key}" inert><div><div class="follow">${text(`q6_notes.${key}`, "Tell us more")}</div></div></div>
        </div>`).join("")}</div>`, "Rate what you used. Skip the rest."),
    },
    s6: {
      sec: 3,
      html: () => banner("food", "Stores & food") +
        Q("q7", "Did you find what you were looking for?", chips("q7", OPT.q7, { multi: false }) +
          follow("q7a", Q("q7a", "What were you looking for?", text("q7a", "A brand, a product, a service…")))),
    },
    s7: {
      sec: 3,
      html: () => Q("q9", "How would you rate the food court?", stars("q9", { big: true, skip: "Didn't visit" })) +
        follow("q9a", Q("q9a", "What would improve it?", chips("q9a", OPT.q9a, { other: true }), "Pick any that apply")),
    },
    s8: {
      sec: 4,
      html: () => banner("events", "Staff & events") +
        Q("q10", "Did you interact with any mall staff?", yesno("q10"), "Help desk, security or housekeeping") +
        follow("q10x", Q("q10a", "How helpful were they?", stars("q10a", { big: true })) +
          Q("q10b", "Anyone you'd like to appreciate?", text("q10b", "A name or where you met them. We'll pass it on."))),
    },
    s9: {
      sec: 4,
      html: () => Q("q11", "Have you attended an event at Felix Plaza?", yesno("q11") +
          follow("q11a", Q("q11a", "How was it?", stars("q11a", { big: true })))) +
        Q("q11b", "What events would you like to see?", chips("q11b", OPT.q11b, { other: true }), "Pick any you'd enjoy"),
    },
    s10: {
      sec: 4,
      html: () => Q("q12", "How would you like to hear about offers and events?", chips("q12", OPT.q12), "Pick any"),
    },
    s11: {
      sec: 5,
      submit: true,
      html: () => wrapUp(),
    },
    quick3: {
      sec: 2,
      submit: true,
      html: () => Q("q13", "Anything else you'd like to tell us?", text("q13", "Optional", true)),
    },
    thanks: { plain: true },
  };

  function wrapUp() {
    return Q("q13", "Anything else you'd like to tell us?", text("q13", "Optional", true)) +
      Q("q14", "Can we contact you about your feedback?", yesno("q14") +
        follow("q14a",
          text("q14a_name", "Your name", false, "Name (optional)") +
          `<label class="field"><span class="field-label">Phone or email</span><input class="input" data-q="q14a_contact" id="contactInput" maxlength="120" placeholder="98765 43210 or you@email.com"></label>
          <p class="err" id="contactErr" hidden>Please add a 10 digit mobile number or an email.</p>
          <label class="check"><input type="checkbox" data-q="q14a_consent"><span class="box">${CHECK}</span><span>I agree that Felix Plaza can contact me about this feedback.</span></label>
          <p class="err" id="consentErr" hidden>Please tick the box so we can contact you.</p>
          <p class="privacy">We only use these details to follow up on this feedback. Never for marketing, never shared.</p>`));
  }

  const ORDER = MODE === "quick"
    ? ["s2", "s3", "quick3", "thanks"]
    : ["s1", "s2", "s3", "checkpoint", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "thanks"];
  // "Tell us more" from quick mode opens the full form at step 2.
  if (MODE === "full" && params.get("start") === "visit") ORDER.splice(0, ORDER.indexOf("s4"));

  /* ---- Render all screens once ------------------------------------------ */
  const host = $("#screens");
  host.innerHTML = ORDER.map((id, i) => {
    const s = SCREENS[id];
    const showHero = i === 0 && (id === "s1" || id === "s2");
    return `<div class="screen" data-screen="${id}">${showHero ? hero() : ""}${s.html ? s.html() : ""}</div>`;
  }).join("");

  /* ---- Interaction ------------------------------------------------------- */
  function setPath(q, value) {
    // "q6_notes.parking" style keys write into nested objects.
    const [k, sub] = q.split(".");
    if (sub) { A[k] = A[k] || {}; A[k][sub] = value; } else A[k] = value;
  }

  host.addEventListener("click", (e) => {
    const tick = e.target.closest("[data-tick]");
    if (tick) { setNps(tick.closest("[data-nps]"), Number(tick.dataset.tick)); return; }

    const star = e.target.closest("[data-star]");
    if (star) {
      const { q, row } = star.dataset;
      const n = Number(star.dataset.star);
      if (row) A.q6[row] = n; else A[q] = n;
      buzz();
      paintStars(star.closest("[data-stars]"), n, true);
      if (!row && q === "q2" && n === 5) sparkle(star);
      afterChange(star);
      return;
    }

    const b = e.target.closest("button[data-q]");
    if (b) {
      const { q, v, kind, row } = b.dataset;
      // Tapping a picked answer again clears it, except on the required questions.
      if (kind === "single") A[q] = A[q] === v && !REQUIRED.has(q) ? undefined : v;
      if (kind === "multi") {
        let list = Array.isArray(A[q]) ? A[q].slice() : [];
        list = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
        // "Don't contact me" clears the other channels, and the reverse.
        if (q === "q12") list = v === "Don't contact me" && list.includes(v) ? [v] : list.filter((x) => x !== "Don't contact me" || v === x);
        A[q] = list;
      }
      if (kind === "skip") {
        if (row) A.q6[row] = A.q6[row] === v ? undefined : v; else A[q] = A[q] === v ? undefined : v;
        const group = b.parentElement.querySelector("[data-stars]") || b.closest(".stars-wrap").querySelector("[data-stars]");
        paintStars(group, 0, false);
      }
      buzz();
      afterChange(b);
      return;
    }

    const act = e.target.closest("[data-act]");
    if (act) {
      if (act.dataset.act === "continue") next();
      if (act.dataset.act === "finish") finish();
    }
  });

  host.addEventListener("input", (e) => {
    const el = e.target;
    if (el.matches(".range")) { setNps(el.closest("[data-nps]"), Number(el.value)); return; }
    if (!el.dataset.q) return;
    setPath(el.dataset.q, el.type === "checkbox" ? el.checked : el.value);
    if (el.id === "contactInput") { el.classList.remove("bad"); $("#contactErr").hidden = true; }
    if (el.dataset.q === "q14a_consent") $("#consentErr").hidden = true;
    updateNext();
  });

  // A tap on the slider that lands on its resting value fires no "input", so
  // count the first touch as an answer too.
  host.addEventListener("pointerup", (e) => {
    const el = e.target;
    if (el.matches && el.matches(".range") && el.closest(".untouched")) setNps(el.closest("[data-nps]"), Number(el.value));
  });

  function afterChange() {
    syncControls();
    updateReveals();
    updateNext();
  }

  function syncControls() {
    $$("button[data-q]", host).forEach((b) => {
      const { q, v, kind, row } = b.dataset;
      const val = row ? A.q6[row] : A[q];
      if (kind === "multi") b.setAttribute("aria-pressed", String(Array.isArray(val) && val.includes(v)));
      else if (kind === "single") b.setAttribute("aria-checked", String(val === v));
      else if (kind === "skip") b.setAttribute("aria-pressed", String(val === v));
    });
  }

  function open(el, on) {
    el.classList.toggle("open", on);
    if (on) el.removeAttribute("inert"); else el.setAttribute("inert", "");
  }

  function updateReveals() {
    let opened = null;
    const set = (el, on) => {
      if (on && !el.classList.contains("open")) opened = el;
      open(el, on);
    };
    $$("[data-show]", host).forEach((el) => set(el, RULES[el.dataset.show]()));
    $$("[data-show-other]", host).forEach((el) => {
      const v = A[el.dataset.showOther];
      set(el, v === "Other" || (Array.isArray(v) && v.includes("Other")));
    });
    $$("[data-show-row]", host).forEach((el) => {
      const v = A.q6[el.dataset.showRow];
      set(el, typeof v === "number" && v <= 2);
    });
    if (opened) bringIntoView(opened);
  }

  // When a follow-up opens below the fold (e.g. "First time" → "How did you
  // hear about us?"), glide down so its options sit just above the Next button.
  // Runs once the follow-up has finished unfolding (so the page is tall enough
  // to scroll), with a timer as a fallback in case that event never comes.
  let pending = null;
  function bringIntoView(el) {
    if (pending) pending();
    const go = () => {
      cleanup();
      if (!el.classList.contains("open")) return;
      const r = el.getBoundingClientRect();
      const bottom = r.top + el.firstElementChild.scrollHeight;
      const limit = innerHeight - (dock.hidden ? 0 : dock.offsetHeight) - 12;
      const by = Math.min(bottom - limit, r.top - 90); // never push its top under the bar
      if (by > 0) window.scrollBy({ top: by, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };
    const onEnd = (e) => { if (e.target === el && e.propertyName === "grid-template-rows") go(); };
    const timer = setTimeout(go, 700);
    const cleanup = () => { clearTimeout(timer); el.removeEventListener("transitionend", onEnd); pending = null; };
    el.addEventListener("transitionend", onEnd);
    pending = cleanup;
  }

  function paintStars(group, n, animate) {
    if (!group) return;
    const big = !group.dataset.row;
    const tone = n ? toneFor(n, 5) : "";
    $$(".star", group).forEach((s, i) => {
      s.classList.remove("on");
      s.setAttribute("aria-pressed", String(i + 1 === n));
    });
    if (animate) void group.offsetWidth; // restart the pop
    $$(".star", group).forEach((s, i) => { if (i < n) s.classList.add("on"); });
    const word = big && group.parentElement.querySelector("[data-word]");
    if (word) {
      word.style.setProperty("--c", tone);
      word.innerHTML = n ? `<span>${STAR_WORDS[n - 1]}</span>` : "";
    }
  }

  function setNps(wrap, n) {
    const prev = A.q3;
    A.q3 = n;
    const range = $(".range", wrap);
    range.value = n;
    range.setAttribute("aria-valuetext", String(n));
    const tone = toneFor(n, 10);
    wrap.classList.remove("untouched");
    wrap.style.setProperty("--c", tone);
    wrap.style.setProperty("--p", `${n * 10}%`);
    const num = $(".nps-num", wrap);
    if (prev !== n) {
      num.textContent = n;
      num.classList.remove("bump"); void num.offsetWidth; num.classList.add("bump");
      $(".nps-word", wrap).textContent = n <= 2 ? "Not at all" : n <= 6 ? "Not really" : n <= 8 ? "Probably" : n === 9 ? "Very likely" : "Absolutely!";
      $$(".ticks button", wrap).forEach((t) => t.classList.toggle("on", Number(t.dataset.tick) === n));
      if (n >= 9 && !(prev >= 9)) sparkle(num);
      buzz();
    }
    afterChange();
  }

  // A small burst for the best answers. Used sparingly.
  function sparkle(el) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const colors = ["#6f5ce0", "#f5b400", "#e0476f", "#9284ee"];
    for (let i = 0; i < 12; i++) {
      const s = document.createElement("span");
      const a = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
      const d = 34 + Math.random() * 30;
      s.className = "spark";
      s.style.cssText = `position:fixed;left:${r.left + r.width / 2 - 3}px;top:${r.top + r.height / 2 - 3}px;background:${colors[i % 4]};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px`;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 750);
    }
  }

  /* ---- Navigation -------------------------------------------------------- */
  let index = 0;
  const app = $("#app");
  const nextBtn = $("#next");
  const dock = $("#dock");
  const currentId = () => ORDER[index];

  function show(i, { push = true, back = false } = {}) {
    index = i;
    const id = currentId();
    $$(".screen", host).forEach((el) => {
      const on = el.dataset.screen === id;
      el.classList.toggle("active", on);
      el.classList.toggle("from-back", on && back);
    });
    if (id === "checkpoint") renderCheckpoint();
    if (id === "thanks") renderThanks();
    const firstWithHero = i === 0 && (id === "s1" || id === "s2");
    app.classList.toggle("is-hero", firstWithHero);
    app.classList.toggle("no-chrome", id === "thanks");
    $("#back").style.visibility = i === 0 ? "hidden" : "";
    updateTop();
    updateNext(true);
    if (push) history.pushState({ i }, "");
    window.scrollTo(0, 0);
    const h = $(".screen.active .q-title, .screen.active h1", host);
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  function updateTop() {
    const id = currentId();
    const bar = $("#bar");
    if (MODE === "quick") {
      const qi = Math.min(index, 2);
      $("#stepLabel").textContent = `Question ${qi + 1} of 3`;
      bar.innerHTML = [0, 1, 2].map((n) => `<span><i style="transform:scaleX(${n <= qi ? 1 : 0})"></i></span>`).join("");
      return;
    }
    const sec = SCREENS[id].sec ?? 5;
    $("#stepLabel").textContent = `Step ${sec + 1} of ${STEPS}`;
    if (!bar.children.length) bar.innerHTML = "<span><i></i></span>".repeat(STEPS);
    const all = ORDER.filter((s) => SCREENS[s].sec != null && !SCREENS[s].plain);
    for (let n = 0; n < STEPS; n++) {
      const inSec = all.filter((s) => SCREENS[s].sec === n);
      const doneCount = inSec.filter((s) => ORDER.indexOf(s) <= index).length;
      // Steps skipped entirely (quick mode's "tell us more" starts at step 2) count as done.
      const fill = id === "thanks" ? 1 : inSec.length ? doneCount / inSec.length : n < sec ? 1 : 0;
      bar.children[n].firstChild.style.transform = `scaleX(${fill})`;
    }
  }

  // Next stays out of the way until the screen's required answer is in, then
  // slides up. Screens with only optional questions show it straight away.
  function updateNext(fresh = false) {
    const s = SCREENS[currentId()];
    const ok = s.valid ? s.valid() : true;
    const showDock = !s.plain && ok;
    if (showDock && dock.hidden && !fresh) { dock.classList.remove("rise"); void dock.offsetWidth; dock.classList.add("rise"); }
    dock.hidden = !showDock;
    nextBtn.disabled = !ok;
    nextBtn.textContent = s.submit ? "Submit" : "Next";
  }

  // A quick double tap shouldn't skip a screen.
  let lastNav = 0;
  function next() {
    const s = SCREENS[currentId()];
    if (s.valid && !s.valid()) return;
    if (Date.now() - lastNav < 450) return;
    lastNav = Date.now();
    if (s.submit) { if (validateContact()) finish(); return; }
    save("partial");
    show(index + 1);
  }
  nextBtn.addEventListener("click", next);
  $("#back").addEventListener("click", () => history.back());

  window.addEventListener("popstate", (e) => {
    if (currentId() === "thanks") { restart(); return; }
    const i = e.state && typeof e.state.i === "number" ? e.state.i : 0;
    show(Math.min(i, ORDER.length - 2), { push: false, back: i < index });
  });

  /* ---- Contact checks (Q14) ---------------------------------------------- */
  const isPhone = (v) => { let d = v.replace(/\D/g, ""); if (d.length === 12 && d.startsWith("91")) d = d.slice(2); if (d.length === 11 && d.startsWith("0")) d = d.slice(1); return /^[6-9]\d{9}$/.test(d); };
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

  function validateContact() {
    if (A.q14 !== "Yes") return true;
    const c = (A.q14a_contact || "").trim();
    const okContact = isPhone(c) || isEmail(c);
    const okConsent = !!A.q14a_consent;
    $("#contactErr").hidden = okContact;
    $("#contactInput").classList.toggle("bad", !okContact);
    $("#consentErr").hidden = okConsent;
    if (!okContact) $("#contactInput").focus();
    return okContact && okConsent;
  }

  /* ---- Saving ------------------------------------------------------------ */
  function answersToSave() {
    const out = JSON.parse(JSON.stringify(A));
    for (const [rule, keys] of Object.entries(RULE_KEYS)) if (!RULES[rule]()) keys.forEach((k) => delete out[k]);
    for (const k of Object.keys(out)) {
      if (k.endsWith("_other")) {
        const base = out[k.replace(/_other$/, "")];
        if (!(base === "Other" || (Array.isArray(base) && base.includes("Other"))) || !out[k]) delete out[k];
      }
      if (out[k] === undefined || out[k] === "" || (Array.isArray(out[k]) && !out[k].length)) delete out[k];
    }
    for (const row of Object.keys(out.q6_notes || {})) if (!(typeof A.q6[row] === "number" && A.q6[row] <= 2) || !out.q6_notes[row]) delete out.q6_notes[row];
    for (const row of Object.keys(out.q6 || {})) if (out.q6[row] === undefined) delete out.q6[row];
    if (out.q6 && !Object.keys(out.q6).length) delete out.q6;
    if (out.q6_notes && !Object.keys(out.q6_notes).length) delete out.q6_notes;
    return out;
  }

  function snapshot(status) {
    return {
      id: RESPONSE.id,
      mode: MODE,
      source: SOURCE,
      device: DEVICE,
      startedAt: RESPONSE.startedAt,
      updatedAt: new Date().toISOString(),
      status,
      lastStep: currentId(),
      answers: answersToSave(),
    };
  }

  async function post(data) {
    if (!CONFIG.endpoint) {
      const all = local.get("felix-feedback-responses", {});
      const prevAnswers = (all[data.id] && all[data.id].answers) || {};
      all[data.id] = { ...all[data.id], ...data, answers: { ...prevAnswers, ...data.answers } };
      local.set("felix-feedback-responses", all);
      console.info("[Felix feedback] demo mode, saved locally:", data);
      return true;
    }
    try {
      const res = await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids a CORS preflight
        body: JSON.stringify(data),
        keepalive: true,
      });
      return res.ok || res.type === "opaque";
    } catch (_) { return false; }
  }

  // Weak signal in basements: keep the latest copy of anything unsent and retry.
  async function save(status) {
    const data = snapshot(status);
    if (!(await post(data))) {
      const box = local.get("felix-feedback-outbox", {});
      box[data.id] = data;
      local.set("felix-feedback-outbox", box);
    }
  }
  async function flushOutbox() {
    const box = local.get("felix-feedback-outbox", {});
    if (!CONFIG.endpoint || !Object.keys(box).length) return;
    for (const id of Object.keys(box)) if (await post(box[id])) delete box[id];
    local.set("felix-feedback-outbox", box);
  }

  function finish() {
    save("complete");
    show(ORDER.indexOf("thanks"));
    history.replaceState({ i: ORDER.indexOf("thanks") }, "");
    if (KIOSK) setTimeout(restart, CONFIG.kioskResetMs);
  }

  /* ---- Checkpoint and thank-you ------------------------------------------ */
  const TICK = `<div class="tick"><svg viewBox="0 0 88 88" aria-hidden="true"><circle class="ring" cx="44" cy="44" r="40"/><path class="mark" d="M28 45l11 11 21-23"/></svg></div>`;

  function renderCheckpoint() {
    $('[data-screen="checkpoint"]').innerHTML =
      `<div class="done checkpoint">${TICK}
        <h1>Got two more minutes?</h1>
        <p>A few more quick questions help us get the little things right.</p>
        <div class="actions">
          <button type="button" class="btn" data-act="continue">Keep going</button>
          <button type="button" class="btn btn-ghost" data-act="finish">Submit now</button>
        </div>
      </div>`;
    save("partial");
  }

  function renderThanks() {
    const low = A.q2 && A.q2 <= 2;
    const happy = A.q2 >= 4 && (A.q3 == null || A.q3 >= 9);
    let body = "Your feedback goes straight to the Felix Plaza team.";
    if (low) body = "We're sorry it wasn't a great visit. The team will look into what you've told us.";
    if (A.q14 === "Yes") body += " We'll be in touch soon.";

    const cards = [];
    if (MODE === "quick") {
      const more = new URLSearchParams({ mode: "full", start: "visit", rid: RESPONSE.id, src: SOURCE });
      cards.push(`<a class="more" href="?${more}"><span class="more-icon"><svg viewBox="0 0 24 24"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg></span>
        <span class="more-text"><strong>Have 2 more minutes?</strong><span>Tell us more</span></span>${ARROW}</a>`);
    }
    if (happy) {
      cards.push(`<a class="more" href="${CONFIG.reviewUrl}" target="_blank" rel="noopener"><span class="more-icon"><svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.3l6-.8z"/></svg></span>
        <span class="more-text"><strong>Share it on Google</strong><span>It helps others find us</span></span>${ARROW}</a>`);
    }

    // Instagram and WhatsApp only show up for guests who picked them in Q12.
    const picked = A.q12 || [];
    const links = [
      ["https://felixplaza.com/events", "What's on", '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
      ["https://felixplaza.com/offers", "Offers", '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>'],
    ];
    if (picked.includes("Instagram")) links.push(["https://www.instagram.com/felixplazaggm/", "Instagram", '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6"/>']);
    if (picked.includes("WhatsApp")) links.push(["https://wa.me/919355778800", "WhatsApp", '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.8z"/>']);

    const el = $('[data-screen="thanks"]');
    el.classList.add("thanks");
    el.innerHTML =
      `<div class="hero" style="background-image:url(assets/img/welcome.webp)">${LOGO}</div>
      <div class="done">${TICK}
        <h1>Thank you!</h1>
        <p>${body}</p>
        ${cards.join("")}
        <div class="links">${links.map(([href, label, icon]) =>
          `<a href="${href}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>${label}</a>`).join("")}</div>
      </div>`;
    setTimeout(() => { const t = $('[data-screen="thanks"] .tick'); if (t && currentId() === "thanks") sparkle(t); }, 950);
  }

  function restart() {
    const keep = new URLSearchParams();
    ["mode", "src", "kiosk"].forEach((k) => params.get(k) && keep.set(k, params.get(k)));
    location.replace(location.pathname + (keep.toString() ? `?${keep}` : ""));
  }

  /* ---- Boot -------------------------------------------------------------- */
  history.replaceState({ i: 0 }, "");
  show(0, { push: false });
  flushOutbox();
  window.addEventListener("online", flushOutbox);
})();
