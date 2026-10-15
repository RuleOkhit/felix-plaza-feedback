/* ---------------------------------------------------------------------------
   Felix Plaza · Feedback
   Three short questions and a thank-you. Plain JS, no build step.
--------------------------------------------------------------------------- */
(function () {
  "use strict";

  const CONFIG = {
    // Where responses are POSTed as JSON. Empty = demo mode: responses are kept
    // in this browser's localStorage under "felix-feedback-log".
    endpoint: "",
    reviewUrl: "https://maps.app.goo.gl/4qgFhVqp1fYWG3KQ7",
    phone: "+919355778800",
    phoneLabel: "+91 93557 78800",
    // With ?kiosk=1 the form starts over this long after the thank-you.
    kioskResetMs: 12000,
  };

  // What we say next depends on how the visit went (4 = Wonderful … 1 = Not good).
  const COPY = {
    note: {
      4: "Lovely to hear. What made it special?",
      3: "Glad you enjoyed it. Anything you’d like to tell us?",
      2: "Thank you for being honest. What would have made it better?",
      1: "We’re sorry to hear that. What went wrong?",
    },
    contact: {
      good: "Would you like to hear about our upcoming events?",
      bad: "Would you like someone from our team to call you?",
    },
  };

  const params = new URLSearchParams(location.search);
  const KIOSK = params.get("kiosk") === "1";
  const STEPS = ["rating", "note", "contact", "thanks"];

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };

  const fresh = () => ({ rating: null, note: "", contact: null, name: "", phone: "" });
  let state = fresh();
  let index = 0;
  let timer = null;

  const happy = () => state.rating >= 3;

  /* ---- Navigation -------------------------------------------------------- */
  function show(to, push = true) {
    $$(".step").forEach((s) => s.classList.toggle("is-active", s.dataset.step === STEPS[to]));
    index = to;
    const inQuestions = to > 0 && to < 3;
    $("#back").hidden = !inQuestions;
    $("#count").textContent = to < 3 ? `${to + 1} of 3` : "";
    if (push) history.pushState({ i: to }, "");
    window.scrollTo(0, 0);
    const h = $(`.step[data-step="${STEPS[to]}"] .q`);
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  $("#back").addEventListener("click", () => history.back());
  window.addEventListener("popstate", (e) => {
    if (index === 3) { restart(); return; }
    show(e.state && typeof e.state.i === "number" ? e.state.i : 0, false);
  });

  function pick(group, value) {
    $$(`${group} [role="radio"]`).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === value)));
  }

  /* ---- 1 · Rating -------------------------------------------------------- */
  $$('[data-step="rating"] [role="radio"]').forEach((b) =>
    b.addEventListener("click", () => {
      state.rating = Number(b.dataset.v);
      pick('[data-step="rating"]', b.dataset.v);
      $("#q2").textContent = COPY.note[state.rating];
      $("#q3").textContent = happy() ? COPY.contact.good : COPY.contact.bad;
      setTimeout(() => show(1), 220);
    }));

  /* ---- 2 · Note ---------------------------------------------------------- */
  const note = $("#note");
  note.addEventListener("input", () => { state.note = note.value; });
  $("#noteNext").addEventListener("click", () => show(2));
  $("#noteSkip").addEventListener("click", () => { state.note = ""; note.value = ""; show(2); });

  /* ---- 3 · Contact ------------------------------------------------------- */
  $$("#contactChoice [role='radio']").forEach((b) =>
    b.addEventListener("click", () => {
      state.contact = b.dataset.v;
      pick("#contactChoice", b.dataset.v);
      if (state.contact === "no") { $("#fields").hidden = true; submit(); return; }
      $("#fields").hidden = false;
      $("#name").focus();
    }));

  const phone = $("#phone");
  phone.addEventListener("input", () => {
    let d = phone.value.replace(/\D/g, "");
    if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
    if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
    d = d.slice(0, 10);
    phone.value = d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
    state.phone = d;
    $("#error").hidden = true;
  });
  $("#name").addEventListener("input", (e) => { state.name = e.target.value; });
  $("#send").addEventListener("click", () => {
    if (!/^[6-9]\d{9}$/.test(state.phone)) { $("#error").hidden = false; phone.focus(); return; }
    submit();
  });

  /* ---- Submit ------------------------------------------------------------ */
  const LABELS = { 4: "Wonderful", 3: "Good", 2: "Could have been better", 1: "Not good" };

  function payload() {
    const wantsContact = state.contact === "yes";
    return {
      id: (crypto.randomUUID && crypto.randomUUID()) || Date.now().toString(36),
      submittedAt: new Date().toISOString(),
      source: params.get("src") || "direct",
      rating: state.rating,
      ratingLabel: LABELS[state.rating],
      note: state.note.trim() || null,
      // Happy guests are offered event news; unhappy guests a call back.
      contactRequest: wantsContact ? (happy() ? "event-updates" : "call-back") : null,
      name: wantsContact ? state.name.trim() || null : null,
      phone: wantsContact ? `+91${state.phone}` : null,
    };
  }

  // Weak signal in car parks: anything that fails is queued and retried later.
  async function send(data) {
    if (!CONFIG.endpoint) {
      const log = store.get("felix-feedback-log", []);
      log.push(data);
      store.set("felix-feedback-log", log);
      console.info("[Felix feedback] demo mode, saved locally:", data);
      return true;
    }
    try {
      const res = await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(data),
        keepalive: true,
      });
      return res.ok || res.type === "opaque";
    } catch (_) {
      return false;
    }
  }

  async function flushOutbox() {
    const box = store.get("felix-feedback-outbox", []);
    if (!box.length || !CONFIG.endpoint) return;
    const left = [];
    for (const item of box) if (!(await send(item))) left.push(item);
    store.set("felix-feedback-outbox", left);
  }

  async function submit() {
    const data = payload();
    if (!(await send(data))) {
      const box = store.get("felix-feedback-outbox", []);
      box.push(data);
      store.set("felix-feedback-outbox", box);
    }
    renderThanks();
    show(3);
    history.replaceState({ i: 3 }, "");
    if (KIOSK) timer = setTimeout(restart, CONFIG.kioskResetMs);
  }

  function renderThanks() {
    const first = state.contact === "yes" ? state.name.trim().split(/\s+/)[0] : "";
    const link = $("#t3");
    $("#t1").textContent = first ? `Thank you, ${first}.` : "Thank you.";
    link.hidden = true;

    if (happy()) {
      $("#t2").textContent = state.contact === "yes"
        ? "We’ll let you know what’s coming up. See you again soon."
        : "We hope to see you again soon.";
      link.textContent = "Share your experience on Google";
      link.href = CONFIG.reviewUrl;
      link.hidden = false;
    } else if (state.contact === "yes") {
      $("#t2").textContent = "Someone from our team will call you shortly.";
    } else {
      $("#t2").textContent = "We read every note and will look into this.";
      link.textContent = `Need help now? Call ${CONFIG.phoneLabel}`;
      link.href = `tel:${CONFIG.phone}`;
      link.hidden = false;
    }
    $("#restart").hidden = !KIOSK;
  }

  function restart() {
    clearTimeout(timer);
    state = fresh();
    $$('[role="radio"]').forEach((b) => b.setAttribute("aria-checked", "false"));
    note.value = "";
    $("#name").value = "";
    phone.value = "";
    $("#fields").hidden = true;
    $("#error").hidden = true;
    show(0, false);
    history.replaceState({ i: 0 }, "");
  }
  $("#restart").addEventListener("click", restart);

  /* ---- Boot -------------------------------------------------------------- */
  history.replaceState({ i: 0 }, "");
  show(0, false);
  flushOutbox();
  window.addEventListener("online", flushOutbox);
})();
