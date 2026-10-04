// Schedule & booking — reads classes from Supabase and books via the
// `book_class` function (see supabase/schema.sql). Falls back to demo data
// until js/supabase-config.js is filled in.

const config = window.SUPABASE_CONFIG || {};
const db =
  config.url && config.anonKey && window.supabase
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

const DAYS_AHEAD = 14;

// Data layer ---------------------------------------------------------------

async function fetchClasses() {
  if (!db) return demoClasses();

  const from = new Date();
  const to = addDays(startOfDay(from), DAYS_AHEAD);
  const { data, error } = await db
    .from("class_schedule")
    .select("*")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");

  if (error) throw error;
  return data;
}

async function createBooking({ classId, name, email, phone, pass }) {
  if (!db) {
    const cls = demoStore.find((c) => c.id === classId);
    if (!cls || cls.spots_left <= 0) throw new Error("Sorry, this class is now full.");
    cls.spots_left -= 1;
    return;
  }

  const { error } = await db.rpc("book_class", {
    p_class_id: classId,
    p_name: name,
    p_email: email,
    p_phone: phone || null,
    p_pass_type: pass,
  });
  if (error) throw new Error(error.message);
}

// Demo data — mirrors the shape of the class_schedule view ----------------

const WEEKLY_TEMPLATE = [
  { day: 1, time: "19:00", title: "Mat Pilates", level: "All levels" },
  { day: 3, time: "18:30", title: "Mat Pilates", level: "Beginners" },
  { day: 6, time: "09:00", title: "Mat Pilates", level: "All levels" },
];

let demoStore = null;

function demoClasses() {
  if (demoStore) return demoStore;
  const today = startOfDay(new Date());
  demoStore = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    WEEKLY_TEMPLATE.filter((t) => t.day === date.getDay()).forEach((t, n) => {
      const [h, m] = t.time.split(":");
      const starts = new Date(date);
      starts.setHours(+h, +m, 0, 0);
      if (starts < new Date()) return;
      demoStore.push({
        id: `demo-${i}-${n}`,
        title: t.title,
        level: t.level,
        starts_at: starts.toISOString(),
        duration_min: 60,
        location: "[Venue]",
        capacity: 12,
        spots_left: [12, 7, 2, 0][(i + n) % 4],
      });
    });
  }
  return demoStore;
}

// Helpers -----------------------------------------------------------------

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const dayKey = (d) => startOfDay(d).toDateString();
const fmtTime = (d) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const fmtLong = (d) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// UI ----------------------------------------------------------------------

const tabsEl = document.querySelector(".day-tabs");
const listEl = document.querySelector(".class-list");
const modal = document.querySelector(".modal");
const form = document.querySelector(".booking-form");
const errorEl = form.querySelector(".form__error");
const summaryEl = modal.querySelector(".modal__summary");
const doneMsg = modal.querySelector(".booking-done__msg");

let classes = [];
let selectedDay = dayKey(new Date());
let selectedClass = null;

if (!db) document.querySelector(".notice").hidden = false;

const passParam = new URLSearchParams(window.location.search).get("pass");
if (passParam) form.pass.value = passParam;

async function load() {
  try {
    classes = await fetchClasses();
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div class="empty-state">Sorry, the timetable couldn't be loaded. Please try again shortly.</div>`;
    return;
  }
  // Start on the first day that has classes
  const first = classes[0];
  if (first && !classes.some((c) => dayKey(new Date(c.starts_at)) === selectedDay)) {
    selectedDay = dayKey(new Date(first.starts_at));
  }
  render();
}

function render() {
  const today = startOfDay(new Date());
  tabsEl.innerHTML = "";
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    const key = dayKey(date);
    const count = classes.filter((c) => dayKey(new Date(c.starts_at)) === key).length;
    const btn = document.createElement("button");
    btn.className = "day-tab" + (key === selectedDay ? " is-active" : "") + (count ? "" : " has-none");
    btn.innerHTML = `<small>${date.toLocaleDateString("en-GB", { weekday: "short" })}</small><strong>${date.getDate()}</strong>`;
    btn.addEventListener("click", () => {
      selectedDay = key;
      render();
    });
    tabsEl.appendChild(btn);
  }

  const dayClasses = classes.filter((c) => dayKey(new Date(c.starts_at)) === selectedDay);
  if (!dayClasses.length) {
    listEl.innerHTML = `<div class="empty-state">No classes on this day. Pick another date above.</div>`;
    return;
  }

  listEl.innerHTML = dayClasses
    .map((c) => {
      const start = new Date(c.starts_at);
      const end = new Date(start.getTime() + c.duration_min * 60000);
      const full = c.spots_left <= 0;
      const spots = full
        ? `<span class="spots spots--full">Fully booked</span>`
        : `<span class="spots ${c.spots_left <= 3 ? "spots--low" : ""}">${c.spots_left} ${c.spots_left === 1 ? "space" : "spaces"} left</span>`;
      return `
        <article class="class-item">
          <div class="class-item__time">${fmtTime(start)}<small>until ${fmtTime(end)}</small></div>
          <div>
            <h3>${escapeHtml(c.title)}</h3>
            <div class="class-item__meta">${escapeHtml(c.level)} · ${escapeHtml(c.location)}</div>
            ${spots}
          </div>
          <button class="btn ${full ? "btn--outline" : "btn--primary"}" data-id="${escapeHtml(c.id)}" ${full ? "disabled" : ""}>
            ${full ? "Full" : "Book"}
          </button>
        </article>`;
    })
    .join("");

  listEl.querySelectorAll("button[data-id]").forEach((btn) =>
    btn.addEventListener("click", () => openModal(classes.find((c) => String(c.id) === btn.dataset.id)))
  );
}

function openModal(cls) {
  selectedClass = cls;
  const start = new Date(cls.starts_at);
  summaryEl.innerHTML = `<strong>${escapeHtml(cls.title)}</strong> · ${escapeHtml(cls.level)}<br>${fmtLong(start)} at ${fmtTime(start)}<br>${escapeHtml(cls.location)}`;
  errorEl.classList.remove("is-shown");
  modal.classList.remove("is-done");
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  form.name.focus();
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

modal.addEventListener("click", (e) => {
  if (e.target === modal || e.target.closest("[data-close]")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  errorEl.classList.remove("is-shown");

  try {
    await createBooking({
      classId: selectedClass.id,
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      pass: form.pass.value,
    });
    const start = new Date(selectedClass.starts_at);
    doneMsg.textContent = `See you on ${fmtLong(start)} at ${fmtTime(start)}. Bring water and comfy clothes, and arrive 5 minutes early.`;
    modal.classList.add("is-done");
    form.reset();
    if (passParam) form.pass.value = passParam;
    await load();
  } catch (err) {
    errorEl.textContent = err.message || "Something went wrong. Please try again.";
    errorEl.classList.add("is-shown");
  } finally {
    submit.disabled = false;
  }
});

load();
