/* =====================================================================
   01-core.js — config, exact money math, formatting, utilities, icons
   Rules:
   - All money is integer Rupiah (Number, safe < 9e15).
   - Quantities are fixed-point BigInt scaled by 1e6 (6 decimals).
   - Rational intermediate {n,d} (BigInt) — rounding happens ONCE, at the end,
     half-up to whole Rupiah.
   ===================================================================== */
const APP = {
  name: "Nyala Kasir",
  short: "Nyala",
  tagline: "Kasir UMKM yang terasa hidup",
  version: "1.3.0-rc.2",
  build: "V19-RC5",
  schema: 4,                                       // 4: varian, pelanggan, kas (IndexedDB v2)
  dbName: "nyala-kasir",
  legacyKeys: ["ttm-pos-payment-reference-v7"],   // V12 / V13 localStorage
  freeProductLimit: 25,
  trialDays: 14,
  supportWa: "",                                   // isi nomor WA admin penjual, format 628xxxx
  buyUrl: "",                                      // isi link halaman pembelian (Mayar/Lynk/website)
  revokedOrders: [],
  promoUntil: "2026-12-31",                        // harga perkenalan berlaku s.d. tanggal ini (kosongkan untuk harga normal)                               // no. pesanan lisensi yang dibatalkan (refund/penyalahgunaan) — berlaku setelah pengguna menerima update
};

const SCALE = 1000000n;

/* ---------- Fixed-point quantities ---------- */
function toScaled(value) {
  if (value === null || value === undefined) return null;
  let s;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    s = value.toFixed(7); // one extra digit, rounded below
  } else if (typeof value === "bigint") {
    return value * SCALE;
  } else {
    s = String(value).trim().replace(/\s/g, "");
    if (!s) return null;
    // Accept Indonesian comma decimals ("0,5") but not thousand separators mixed with decimals.
    if (/^[+-]?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  }
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const neg = s.startsWith("-");
  const clean = s.replace(/^[+-]/, "");
  const [a, b = ""] = clean.split(".");
  const whole = BigInt(a || "0");
  const frac7 = (b + "0000000").slice(0, 7);
  let frac = BigInt(frac7.slice(0, 6));
  if (Number(frac7[6]) >= 5) frac += 1n; // half-up at the 7th decimal
  const v = whole * SCALE + frac;
  return neg ? -v : v;
}
function scaledToNumber(v) {
  if (typeof v !== "bigint") return 0;
  const neg = v < 0n, a = neg ? -v : v;
  const n = Number(a / SCALE) + Number(a % SCALE) / 1e6;
  return neg ? -n : n;
}
function normQty(v) { const s = toScaled(v); return s === null ? null : scaledToNumber(s); }
/** user-typed quantity (Indonesian conventions): "1.000" = 1000, "0,5" = 0.5, "1.250,5" = 1250.5, "1.5" = 1.5 */
function normQtyInput(v) {
  let s = String(v ?? "").trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return normQty(s);
}

/* ---------- Rational & rounding ---------- */
const R0 = () => ({ n: 0n, d: 1n });
function rAdd(a, b) { return a.d === b.d ? { n: a.n + b.n, d: a.d } : { n: a.n * b.d + b.n * a.d, d: a.d * b.d }; }
function rMulScaled(r, qScaled) { return { n: r.n * qScaled, d: r.d * SCALE }; }
function rRound(r) { // half-up (away from zero) to integer rupiah
  if (r.d === 0n) return 0;
  const neg = (r.n < 0n) !== (r.d < 0n);
  const n = r.n < 0n ? -r.n : r.n, d = r.d < 0n ? -r.d : r.d;
  const q = n / d, rem = n % d;
  const out = q + (rem * 2n >= d ? 1n : 0n);
  return Number(neg ? -out : out);
}
function roundDiv(a, b) { return rRound({ n: BigInt(Math.trunc(a)), d: BigInt(Math.trunc(b)) }); }
function money(v) { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : 0; }
/** percent (e.g. "10", "2,5") -> basis points integer; null if invalid */
function pctToBp(v) {
  const s = toScaled(v); if (s === null || s < 0n) return null;
  return Number((s * 100n + SCALE / 2n) / SCALE); // 2 decimals of percent
}
function bpApply(amount, bp) { return bp ? roundDiv(money(amount) * bp, 10000) : 0; }

/* ---------- Formatting (locale-independent, deterministic) ---------- */
function groupDigits(n) { return String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
function rp(n) { const v = money(n); return (v < 0 ? "-Rp " : "Rp ") + groupDigits(v); }
function rpShort(n) {
  const v = money(n), a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e9) return s + "Rp " + (a / 1e9).toFixed(a % 1e9 ? 1 : 0).replace(".", ",") + " M";
  if (a >= 1e6) return s + "Rp " + (a / 1e6).toFixed(a % 1e6 ? 1 : 0).replace(".", ",") + " jt";
  if (a >= 1e4) return s + "Rp " + Math.round(a / 1e3) + " rb";
  return rp(v);
}
function fmtQty(n) {
  const x = Number(n) || 0;
  if (Number.isInteger(x)) return (x < 0 ? "-" : "") + groupDigits(x);
  return String(Number(x.toFixed(6))).replace(".", ",");
}
function pctText(num, den) { if (!den) return "0%"; return Math.round((num / den) * 100) + "%"; }
const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function pad2(n) { return String(n).padStart(2, "0"); }
function dayKey(d = new Date()) { d = new Date(d); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseDayKey(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(k, n) { const d = parseDayKey(k); d.setDate(d.getDate() + n); return dayKey(d); }
function fmtDate(iso) { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function fmtTime(iso) { const d = new Date(iso); return `${pad2(d.getHours())}.${pad2(d.getMinutes())}`; }
function fmtDateTime(iso) { return `${fmtDate(iso)}, ${fmtTime(iso)}`; }
function fmtDayLabel(k) {
  const today = dayKey();
  if (k === today) return "Hari ini";
  if (k === addDays(today, -1)) return "Kemarin";
  const d = parseDayKey(k); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/* ---------- Misc utilities ---------- */
function esc(v) { return String(v ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])); }
function uid(prefix = "") {
  const c = globalThis.crypto;
  const r = c?.randomUUID ? c.randomUUID().replace(/-/g, "") : (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
  return prefix + r.slice(0, 16);
}
function nextId(list) { let m = 0; for (const x of list) { const n = Number(x.id); if (Number.isFinite(n) && n > m) m = n; } return m + 1; }
function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
function cleanText(v, max = 80) { return String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
function digitsOnly(v, max = 12) { return String(v ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, max); }
function parseMoneyInput(v) { const d = digitsOnly(v); return d ? Number(d) : 0; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function quickCash(total) {
  total = money(total); if (total <= 0) return [];
  const s = new Set([total]);
  for (const step of [5000, 10000, 20000, 50000, 100000]) s.add(Math.ceil(total / step) * step);
  for (const note of [50000, 100000]) if (note >= total) s.add(note);
  return [...s].filter(v => v >= total).sort((a, b) => a - b).slice(0, 6);
}
function initials(name) { return cleanText(name).split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?"; }
const PH_COLORS = [["#12c795", "#079d72"], ["#3d7ddf", "#2657b8"], ["#f5a30b", "#d98200"], ["#e0566a", "#b83a4f"], ["#8a6cf0", "#6247c7"], ["#1fb5c9", "#0f8a9b"], ["#6b7a93", "#46546d"]];
function phColor(name) { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const c = PH_COLORS[h % PH_COLORS.length]; return `linear-gradient(145deg,${c[0]},${c[1]})`; }
function csvCell(v) { if (typeof v === "number" && Number.isFinite(v)) return String(v); let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; } // blocks CSV formula injection
function haptic(ms = 12) { try { if (state?.settings?.haptic !== false && navigator.vibrate) navigator.vibrate(ms); } catch (_) {} }
let audioCtx = null;
function chime() {
  try {
    if (state?.settings?.sound === false) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    [[880, 0], [1320, .09]].forEach(([f, dt]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(.18, t + dt + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dt + .22);
      o.connect(g).connect(audioCtx.destination); o.start(t + dt); o.stop(t + dt + .25);
    });
  } catch (_) {}
}

/* ---------- Icons (inline SVG, stroke-based, 24px grid) ---------- */
const ICONS = {
  store: '<path d="M4 10h16v10H4z"/><path d="M3 10l2-5h14l2 5"/><path d="M3 10c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3"/><path d="M8 20v-4h8v4"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.3 1.6 1 2.6 2 3.1C11 8.5 11.3 5.8 12 3Z"/>',
  user: '<circle cx="12" cy="8" r="3.2"/><path d="M5 21c.7-3.8 2.8-5.7 7-5.7s6.3 1.9 7 5.7"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
  arrow: '<path d="M5 12h13"/><path d="m13 7 5 5-5 5"/>',
  back: '<path d="M19 12H6"/><path d="m11 7-5 5 5 5"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/>',
  home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  box: '<path d="m4 7 8-4 8 4-8 4z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  cart: '<circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/><path d="M3 4h2l2.3 10.2h9.8L19 7H6"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  download: '<path d="M12 3v11"/><path d="m7 9 5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M5 21h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="m4 16-.7 4.7L8 20l11-11-4-4z"/><path d="m13 6 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  crown: '<path d="m3 8 3 10h12l3-10-5 4-4-6-4 6z"/><path d="M6 21h12"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m5 17 4-4 3 3 2-2 5 5"/>',
  printer: '<path d="M6 9V3h12v6"/><path d="M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v7H7z"/>',
  share: '<circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.1 1.8.9c-.3 1.2-1.2 1.7-2.3 1.6-3-.3-6-3.3-6.3-6.3-.1-1.1.4-2 1.6-2.3l.9 1.8z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4l-2 2"/><path d="M4 5v4h4"/><path d="M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 19v-4h-4"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M16 14.5h2"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9.5h18M7 15h4"/>',
  transfer: '<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.3"/><circle cx="17" cy="17" r="2.3"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4"/><path d="M8 9h8M8 13h5"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4"/><path d="M12 17.2v.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.1"/>',
  shield: '<path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A10.6 10.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.6M6.3 7.6C3.7 9.3 2 12 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.8-.8"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 0 1 5 .8c0 1.7-2.5 2.2-2.5 3.7"/><path d="M12 17.3v.1"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v7"/><path d="m9 11 3 3 3-3"/>',
  stack: '<rect x="4" y="4" width="16" height="5" rx="1.5"/><rect x="4" y="10.5" width="16" height="5" rx="1.5"/><path d="M6 18.5h12"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v.1M18 14.5v.1"/>',
  cloud: '<path d="M7 18h10.5a3.5 3.5 0 0 0 .5-6.96 5 5 0 0 0-9.78-1.5A4 4 0 0 0 7 18Z"/>',
};
function icon(name, cls = "") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}
