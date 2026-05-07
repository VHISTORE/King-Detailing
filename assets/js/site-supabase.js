import { sb } from "./supabase-init.js";

// ---------- Gallery ----------
async function loadGallery() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;
  const { data, error } = await sb
    .from("gallery")
    .select("image_url,title,images")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) { console.warn("Gallery load failed:", error); return; }
  const tiles = [];
  (data || []).forEach(row => {
    const imgs = Array.isArray(row.images) && row.images.length
      ? row.images
      : (row.image_url ? [{ url: row.image_url }] : []);
    imgs.forEach(im => tiles.push({ url: im.url, title: row.title || "" }));
  });
  if (!tiles.length) {
    grid.innerHTML = '<p style="opacity:.7;grid-column:1/-1;text-align:center">Gallery is being updated — check back soon.</p>';
    return;
  }
  grid.innerHTML = "";
  tiles.slice(0, 60).forEach(t => {
    const item = document.createElement("div");
    item.className = "gallery__item";
    item.style.backgroundImage = `url('${t.url}')`;
    if (t.title) item.title = t.title;
    grid.appendChild(item);
  });
}

// ---------- Comments ----------
async function loadComments() {
  const list = document.getElementById("commentsList");
  if (!list) return;
  const { data, error } = await sb
    .from("comments")
    .select("name,car,text,created_at")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) { console.warn("Comments load failed:", error); return; }
  if (!data || !data.length) {
    list.innerHTML = '<p style="opacity:.7;text-align:center">Be the first to leave a comment.</p>';
    return;
  }
  list.innerHTML = "";
  data.forEach(c => {
    const card = document.createElement("article");
    card.className = "review";
    card.innerHTML = `<p>"${escapeHtml(c.text || "")}"</p><div class="review__author"><strong>${escapeHtml(c.name || "Anonymous")}</strong><span>${c.car ? escapeHtml(c.car) : ""}</span></div>`;
    list.appendChild(card);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

async function submitComment(e) {
  e.preventDefault();
  const form = e.target;
  const status = document.getElementById("commentStatus");
  if (form.website && form.website.value) { status.textContent = "Thanks!"; return; }
  const name = form.name.value.trim().slice(0, 60);
  const car = (form.car.value || "").trim().slice(0, 60);
  const text = form.text.value.trim().slice(0, 600);
  if (!name || !text) { status.textContent = "Please fill in name and comment."; return; }
  const last = +localStorage.getItem("kd_lastComment") || 0;
  if (Date.now() - last < 60_000) {
    status.textContent = "Please wait a minute before posting again.";
    return;
  }
  status.textContent = "Sending…";
  const { error } = await sb.from("comments").insert({ name, car, text });
  if (error) {
    console.error(error);
    status.textContent = "Could not send. Please try again later.";
    return;
  }
  localStorage.setItem("kd_lastComment", Date.now().toString());
  form.reset();
  status.textContent = "Thanks! Your comment will appear after review.";
}

// ---------- Booking form ----------
function wireBookingForm() {
  const form = document.getElementById("bookingForm");
  if (!form) return;
  form.addEventListener("submit", async () => {
    try {
      const fd = new FormData(form);
      const data = {};
      fd.forEach((v, k) => { data[k] = v; });
      await sb.from("requests").insert({ data });
    } catch (err) {
      console.warn("Could not save booking:", err);
    }
  }, true);
}

document.addEventListener("DOMContentLoaded", () => {
  loadGallery();
  loadComments();
  wireBookingForm();
  const cf = document.getElementById("commentForm");
  if (cf) cf.addEventListener("submit", submitComment);
});
