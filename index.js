// index.js — dynamic gallery + CDN support
import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import expressLayouts from "express-ejs-layouts";
import { readdir, stat, access } from "fs/promises";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || "true") === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  logger: true,   // <— tüm SMTP diyaloğunu logla
  debug: true,    // <— ek debug
});

transporter.verify().then(() => {
  console.log("[MAIL] SMTP ready");
}).catch(err => {
  console.error("[MAIL] SMTP verify failed:", err);
});

async function sendMail({ subject, html, replyTo }) {
  const fromAddr = process.env.MAIL_FROM || process.env.SMTP_USER; // ör: "DJ Site <infodjerdemdereli@gmail.com>"
  const toAddr   = process.env.MAIL_TO   || process.env.SMTP_USER; // nereye düşsün

  console.log("[MAIL] sendMail()", { toAddr, fromAddr, subject, replyTo });

  const info = await transporter.sendMail({
    from: fromAddr,
    to: toAddr,
    replyTo,
    subject,
    html,
  });

  console.log("[MAIL] sent id:", info.messageId);
}


// (Opsiyonel) server açılırken bağlantıyı doğrula
transporter.verify().then(() => {
  console.log("[MAIL] SMTP ready");
}).catch(err => {
  console.error("[MAIL] SMTP verify failed:", err);
});


const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

/* =========================
   CDN CONFIG (env)
   ========================= */
const CDN_BASE_URL   = (process.env.CDN_BASE_URL   || "").replace(/\/$/, ""); // e.g. https://cdn.djerdemdereli.com/images/gallery
const CDN_MEDIA_BASE = (process.env.CDN_MEDIA_BASE || "").replace(/\/$/, ""); // e.g. https://cdn.djerdemdereli.com

/* =========================
   View engine
   ========================= */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
// TR default layout (views/layout-tr.ejs var)
app.set("layout", "layout-tr");

/* =========================
   Parsers
   ========================= */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


/* =========================
   Optional: redirect old local media paths to CDN
   ========================= */
if (CDN_MEDIA_BASE) {
  // /images/... → CDN
  app.get(/^\/images\/.*/, (req, res) => {
    return res.redirect(301, `${CDN_MEDIA_BASE}${req.originalUrl}`);
  });

  // /videos/... → CDN
  app.get(/^\/videos\/.*/, (req, res) => {
    return res.redirect(301, `${CDN_MEDIA_BASE}${req.originalUrl}`);
  });
} else if (CDN_BASE_URL) {
  // /images/gallery/... → CDN_BASE_URL
  app.get(/^\/images\/gallery\/.*/, (req, res) => {
    const rest = req.path.replace(/^\/images\/gallery\//, "");
    return res.redirect(301, `${CDN_BASE_URL}/${rest}`);
  });
}



/* =========================
   Static (after redirects)
   ========================= */
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   Common locals (helpers)
   ========================= */
app.use((_, res, next) => {
  res.locals.currentYear = new Date().getFullYear();

  // Turns '/images/...' or '/videos/...' into CDN URLs if CDN_MEDIA_BASE is set
  res.locals.asset = (p) => {
    if (!p) return p;
    if (CDN_MEDIA_BASE && /^\/(images|videos)\//.test(p)) {
      return `${CDN_MEDIA_BASE}${p}`;
    }
    return p;
  };

  // Cloudflare image resizing helper (only applies if CDN_MEDIA_BASE exists)
  res.locals.resize = (p, w = 980) => {
    if (!p) return p;
    if (!CDN_MEDIA_BASE) return p;
    // Cloudflare /cdn-cgi/image transforms
    return `${CDN_MEDIA_BASE}/cdn-cgi/image/width=${w},quality=auto,format=auto${p}`;
  };

  next();
});

/* =========================
   Gallery scanner (from local /public/images/gallery)
   ========================= */
const GALLERY_DIR = path.join(__dirname, "public", "images", "gallery");
const ALLOWED     = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function titleFromSlug(slug) {
  return slug
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// URL-safe
const enc = (s) => encodeURIComponent(s);

async function listImagesIn(dirAbs, slug) {
  let items = [];
  try {
    items = await readdir(dirAbs);
  } catch (e) {
    console.error("[GALLERY] Klasör okunamadı:", dirAbs, e.message);
    return [];
  }

  const sectionTitle = titleFromSlug(slug);
  const images = [];

  for (const name of items) {
    const fileAbs = path.join(dirAbs, name);
    let st;
    try {
      st = await stat(fileAbs);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;

    const ext = path.extname(name).toLowerCase();
    if (!ALLOWED.has(ext)) continue;

    // Build URL: prefer CDN_BASE_URL if provided, else local
    const rel = `${enc(slug)}/${enc(name)}`;
    const fullUrl = CDN_BASE_URL
      ? `${CDN_BASE_URL}/${rel}`                       // e.g. https://cdn.../images/gallery/<slug>/<file>
      : `/images/gallery/${rel}`;                      // local fallback

    const baseName = path.parse(name).name;

    images.push({
      full: fullUrl,
      thumb: fullUrl, // thumbs yoksa full
      alt: baseName,
      caption: `${sectionTitle} — ${baseName}`,
    });
  }

  images.sort((a, b) => a.full.localeCompare(b.full, undefined, { numeric: true }));
  return images;
}

async function readGallery() {
  let cats = [];
  try {
    cats = await readdir(GALLERY_DIR, { withFileTypes: true });
  } catch (e) {
    console.error("[GALLERY] Ana dizin yok:", GALLERY_DIR, e.message);
    return [];
  }

  const sections = [];
  for (const d of cats) {
    if (!d.isDirectory()) continue;
    const slug   = d.name; 
    const dirAbs = path.join(GALLERY_DIR, slug);
    const images = await listImagesIn(dirAbs, slug);
    console.log(`[GALLERY] ${slug}: ${images.length} resim`);
    if (images.length) {
      sections.push({ slug, title: titleFromSlug(slug), images });
    }
  }

  // Preferred order
  const order = ["afterParty", "festivals","weddings", "events", "2000s"];
  sections.sort((a, b) => {
    const ia = order.indexOf(a.slug);
    const ib = order.indexOf(b.slug);
    if (ia === -1 && ib === -1) return a.slug.localeCompare(b.slug);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return sections;
}

/* =========================
   TR ROUTES (default)
   ========================= */

// Home (TR) — preview (first 9 across sections)
app.get("/", async (req, res) => {
  const sections = await readGallery();
  const galleryPreview = sections
    .flatMap((s) => s.images.map((img) => ({ ...img, section: s.title })))
    .slice(0, 9);

  res.render("tr/index-tr", {
    pageTitle: "DJ Erdem Dereli | Düğün & Etkinlik DJ’i",
    lang: "tr",
    layout: "layout-tr",
    bookingStatus: req.query.booking,
    contactStatus: req.query.contact,
    galleryPreview,
  });
});

/* ========= TR GALLERY ========= */

// Tüm galeriler
app.get("/gallery", async (req, res) => {
  const sections = await readGallery();
  res.render("tr/gallery-tr", {
    pageTitle: "Galeri — DJ Erdem Dereli",
    lang: "tr",
    layout: "layout-tr",
    gallerySections: sections,
    activeSlug: null,
  });
});

// Tek bölüm: /gallery/:slug (ör. /gallery/weddings)
app.get("/gallery/:slug", async (req, res) => {
  const sections = await readGallery();
  const section  = sections.find((s) => s.slug === req.params.slug);

  if (!section) {
    return res.status(404).render("tr/404-tr", {
      pageTitle: "Sayfa Bulunamadı",
      lang: "tr",
      layout: "layout-tr",
    });
  }

  res.render("tr/gallery-tr", {
    pageTitle: `${section.title} — Galeri`,
    lang: "tr",
    layout: "layout-tr",
    gallerySections: sections,
    activeSlug: section.slug,
  });
});

/* ========= EN GALLERY ========= */

app.get("/en/gallery", async (req, res) => {
  const sections = await readGallery();
  res.render("en/gallery-en", {
    pageTitle: "Gallery — DJ Erdem Dereli",
    lang: "en",
    layout: "layout-en",
    gallerySections: sections,
    activeSlug: null,
  });
});

app.get("/en/gallery/:slug", async (req, res) => {
  const sections = await readGallery();
  const section  = sections.find((s) => s.slug === req.params.slug);

  if (!section) {
    return res.status(404).render("en/404-en", {
      pageTitle: "Page Not Found",
      lang: "en",
      layout: "layout-en",
    });
  }

  res.render("en/gallery-en", {
    pageTitle: `${section.title} — Gallery`,
    lang: "en",
    layout: "layout-en",
    gallerySections: sections,
    activeSlug: section.slug,
  });
});

/* =========================
   EN ROUTES
   ========================= */

// Home (EN) — preview
app.get("/en", async (req, res) => {
  const sections = await readGallery();
  const galleryPreview = sections
    .flatMap((s) => s.images.map((img) => ({ ...img, section: s.title })))
    .slice(0, 9);

  res.render("en/index-en", {
    pageTitle: "DJ Erdem Dereli | Professional DJ for Weddings & Events",
    lang: "en",
    layout: "layout-en",
    bookingStatus: req.query.booking,
    contactStatus: req.query.contact,
    galleryPreview,
  });
});

/* =========================
   Forms
   ========================= */
app.post("/bookings", async (req, res) => {
  console.log("[ROUTE] /bookings body:", req.body);
  const { name, email, phone, eventType, eventDate, message } = req.body || {};
  const valid = name && email && phone && eventType && eventDate;
  const isEN  = (req.headers.referer || "").includes("/en");
  const back  = isEN ? "/en" : "/";

  if (!valid) {
    console.log("[ROUTE] /bookings -> validation failed");
    return res.redirect(`${back}?booking=val#booking`);
  }

  try {
    await sendMail({
      subject: `BOOKING: ${eventType} – ${name} – ${eventDate}`,
      replyTo: email,
      html: `
        <h2>Yeni Rezervasyon Talebi</h2>
        <p><b>Ad Soyad:</b> ${name}</p>
        <p><b>E-posta:</b> ${email}</p>
        <p><b>Telefon:</b> ${phone}</p>
        <p><b>Etkinlik Türü:</b> ${eventType}</p>
        <p><b>Tarih:</b> ${eventDate}</p>
        ${message ? `<p><b>Not:</b> ${(message||"").replace(/\n/g,"<br>")}</p>` : ""}
        <hr><small>${new Date().toLocaleString()}</small>
      `,
    });

    return res.redirect(`${back}?booking=ok#booking`);
  } catch (e) {
    console.error("[MAIL][bookings] error:", e);
    return res.redirect(`${back}?booking=err#booking`);
  }
});


// TR
app.post("/contact", async (req, res) => {
  console.log("[ROUTE]/contact BODY =>", req.body);
  try {
    const { name, email, subject, message } = req.body || {};
    if (!(name && email && message)) {
      console.log("[ROUTE]/contact INVALID");
      return res.redirect(`/?contact=val#contact`);
    }

    await sendMail({
      subject: subject?.trim() ? `CONTACT (TR): ${subject}` : "CONTACT (TR): Yeni mesaj",
      replyTo: email,
      html: `
        <h2>Yeni İletişim Mesajı</h2>
        <p><b>Ad Soyad:</b> ${name}</p>
        <p><b>E-posta:</b> ${email}</p>
        ${subject ? `<p><b>Konu:</b> ${subject}</p>` : ""}
        <p><b>Mesaj:</b></p>
        <p>${(message || "").replace(/\n/g,"<br>")}</p>
        <hr><small>${new Date().toLocaleString()}</small>
      `,
    });

    return res.redirect(`/?contact=ok#contact`);
  } catch (e) {
    console.error("[MAIL][contact] error:", e);
    return res.redirect(`/?contact=err#contact`);
  }
});

// EN
app.post("/contact-en", async (req, res) => {
  console.log("[ROUTE]/contact-en BODY =>", req.body);
  try {
    const { name, email, subject, message } = req.body || {};
    if (!(name && email && message)) {
      console.log("[ROUTE]/contact-en INVALID");
      return res.redirect(`/en?contact=val#contact`);
    }

    await sendMail({
      subject: subject?.trim() ? `CONTACT (EN): ${subject}` : "CONTACT (EN): New message",
      replyTo: email,
      html: `
        <h2>New Contact Message</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        ${subject ? `<p><b>Subject:</b> ${subject}</p>` : ""}
        <p><b>Message:</b></p>
        <p>${(message || "").replace(/\n/g,"<br>")}</p>
        <hr><small>${new Date().toLocaleString()}</small>
      `,
    });

    return res.redirect(`/en?contact=ok#contact`);
  } catch (e) {
    console.error("[MAIL][contact-en] error:", e);
    return res.redirect(`/en?contact=err#contact`);
  }
});

/* =========================
   DEBUG HELPERS
   ========================= */

const EXISTS = async (p) =>
  !!(await access(p).then(() => true).catch(() => false));

app.get("/debug/paths", async (req, res) => {
  const checks = {
    __dirname,
    galleryDir: GALLERY_DIR,
    exists_public : await EXISTS(path.join(__dirname, "public")),
    exists_images : await EXISTS(path.join(__dirname, "public", "images")),
    exists_gallery: await EXISTS(GALLERY_DIR),
    CDN_BASE_URL,
    CDN_MEDIA_BASE,
  };
  let entries = [];
  if (checks.exists_gallery) {
    entries = await readdir(GALLERY_DIR).catch(() => []);
  }
  res.json({ checks, gallery_children: entries });
});

app.get("/debug/ls", async (req, res) => {
  try {
    const cats = await readdir(GALLERY_DIR, { withFileTypes: true });
    const out  = [];
    for (const d of cats) {
      if (!d.isDirectory()) continue;
      const dirAbs = path.join(GALLERY_DIR, d.name);
      const files  = await readdir(dirAbs).catch(() => []);
      out.push({ slug: d.name, count: files.length, sample: files.slice(0, 5) });
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message, galleryDir: GALLERY_DIR });
  }
});

app.get("/debug/gallery", async (_, res) => {
  try {
    const data = await readGallery();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/debug/mail", async (req, res) => {
  try {
    await sendMail({
      subject: "TEST: DJ site mail",
      replyTo: "noreply@djerdemdereli.com",
      html: "<p>Bu bir testtir.</p>",
    });
    res.send("OK – test mail yollandı.");
  } catch (e) {
    console.error("[MAIL][debug] error:", e);
    res.status(500).send("MAIL ERR: " + e.message);
  }
});


/* =========================
   404
   ========================= */
app.use((req, res) => {
  const isEN = req.path.startsWith("/en");
  res.status(404).render(isEN ? "en/404-en" : "tr/404-tr", {
    pageTitle: isEN ? "Page Not Found" : "Sayfa Bulunamadı",
    lang: isEN ? "en" : "tr",
    layout: isEN ? "layout-en" : "layout-tr",
  });
});

/* ---------------- Start ---------------- */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
