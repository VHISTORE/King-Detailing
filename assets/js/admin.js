import { sb, ADMIN_EMAIL } from "./supabase-init.js";

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

// ========== Auth ==========
const loginView = $("#loginView");
const adminView = $("#adminView");
const loginForm = $("#loginForm");
const loginError = $("#loginError");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const fd = new FormData(loginForm);
  const { data, error } = await sb.auth.signInWithPassword({
    email: fd.get("email"),
    password: fd.get("password")
  });
  if (error) { loginError.textContent = "Wrong email or password."; return; }
  if (data.user.email !== ADMIN_EMAIL) {
    await sb.auth.signOut();
    loginError.textContent = "This account is not authorized.";
    return;
  }
  showAdmin(data.user);
});

$("#logoutBtn").addEventListener("click", async () => {
  await sb.auth.signOut();
  loginView.hidden = false;
  adminView.hidden = true;
});

(async () => {
  const { data } = await sb.auth.getSession();
  const user = data?.session?.user;
  if (user && user.email === ADMIN_EMAIL) showAdmin(user);
})();

function showAdmin(user) {
  loginView.hidden = true;
  adminView.hidden = false;
  $("#userEmail").textContent = user.email;
  bootDashboard();
}

// ========== Tabs ==========
$$(".admin__tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    $$(".admin__tabs button").forEach(b => b.classList.toggle("is-active", b === btn));
    $$(".tab").forEach(s => s.classList.toggle("is-active", s.dataset.tab === tab));
  });
});

// ========== Gallery ==========
function bootGallery() {
  const grid = $("#galleryAdminGrid");
  const addBtn = $("#addGalleryBtn");
  const upload = $("#galleryUpload");
  const form = $("#galleryForm");
  const status = $("#galleryStatus");
  const cancel = $("#galleryCancel");

  addBtn.onclick = () => { upload.hidden = !upload.hidden; };
  cancel.onclick = () => { upload.hidden = true; form.reset(); status.textContent = ""; };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const file = fd.get("file");
    const title = (fd.get("title") || "").toString().trim();
    if (!file || !file.size) return;
    status.textContent = "Uploading…";
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await sb.storage.from("gallery").upload(path, file, {
        contentType: file.type
      });
      if (upErr) throw upErr;
      const { data: pub } = sb.storage.from("gallery").getPublicUrl(path);
      const { error: insErr } = await sb.from("gallery").insert({
        image_url: pub.publicUrl,
        storage_path: path,
        title
      });
      if (insErr) throw insErr;
      form.reset();
      upload.hidden = true;
      status.textContent = "";
      loadGalleryAdmin();
    } catch (err) {
      console.error(err);
      status.textContent = "Upload failed: " + err.message;
    }
  };

  loadGalleryAdmin();
}

async function loadGalleryAdmin() {
  const grid = $("#galleryAdminGrid");
  const { data, error } = await sb.from("gallery").select("*").order("created_at", { ascending: false });
  if (error) { grid.innerHTML = `<p class="empty">Error: ${error.message}</p>`; return; }
  grid.innerHTML = "";
  if (!data.length) { grid.innerHTML = '<p class="empty">No works yet — add the first one.</p>'; return; }
  data.forEach(d => {
    const card = document.createElement("div");
    card.className = "card card--photo";
    card.innerHTML = `
      <div class="card__img" style="background-image:url('${d.image_url}')"></div>
      <div class="card__body">
        <input class="card__title" value="${escapeAttr(d.title || "")}" placeholder="Title" />
        <div class="card__actions">
          <button class="btn-ghost" data-act="save">Save</button>
          <button class="btn-danger" data-act="delete">Delete</button>
        </div>
      </div>`;
    card.querySelector('[data-act="save"]').onclick = async () => {
      const t = card.querySelector(".card__title").value.trim();
      await sb.from("gallery").update({ title: t }).eq("id", d.id);
      flash(card);
    };
    card.querySelector('[data-act="delete"]').onclick = async () => {
      if (!confirm("Delete this work?")) return;
      if (d.storage_path) await sb.storage.from("gallery").remove([d.storage_path]);
      await sb.from("gallery").delete().eq("id", d.id);
      loadGalleryAdmin();
    };
    grid.appendChild(card);
  });
}

// ========== Comments ==========
let commentFilter = "pending";
function bootComments() {
  const filterBtns = $$('.tab[data-tab="comments"] .filters button');
  filterBtns.forEach(b => b.onclick = () => {
    filterBtns.forEach(x => x.classList.toggle("is-active", x === b));
    commentFilter = b.dataset.filter;
    loadCommentsAdmin();
  });
  loadCommentsAdmin();
}

async function loadCommentsAdmin() {
  const list = $("#commentsAdminList");
  const { data, error } = await sb.from("comments").select("*").order("created_at", { ascending: false });
  if (error) { list.innerHTML = `<p class="empty">Error: ${error.message}</p>`; return; }
  const pending = data.filter(d => !d.approved).length;
  const badge = $("#commentsBadge");
  badge.textContent = pending;
  badge.hidden = pending === 0;
  const docs = data.filter(d => {
    if (commentFilter === "pending") return !d.approved;
    if (commentFilter === "approved") return d.approved;
    return true;
  });
  list.innerHTML = "";
  if (!docs.length) { list.innerHTML = '<p class="empty">No comments here.</p>'; return; }
  docs.forEach(c => {
    const when = c.created_at ? new Date(c.created_at).toLocaleString() : "";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card__body">
        <div class="card__meta">
          <strong>${escapeHtml(c.name || "Anonymous")}</strong>
          ${c.car ? '· ' + escapeHtml(c.car) : ''}
          <span class="muted">${when}</span>
          ${c.approved ? '<span class="pill pill--ok">approved</span>' : '<span class="pill">pending</span>'}
        </div>
        <p>${escapeHtml(c.text || "")}</p>
        <div class="card__actions">
          ${c.approved
            ? '<button class="btn-ghost" data-act="unapprove">Unapprove</button>'
            : '<button class="btn-primary" data-act="approve">Approve</button>'}
          <button class="btn-danger" data-act="delete">Delete</button>
        </div>
      </div>`;
    card.querySelector('[data-act="approve"]')?.addEventListener("click", async () => {
      await sb.from("comments").update({ approved: true }).eq("id", c.id);
      loadCommentsAdmin();
    });
    card.querySelector('[data-act="unapprove"]')?.addEventListener("click", async () => {
      await sb.from("comments").update({ approved: false }).eq("id", c.id);
      loadCommentsAdmin();
    });
    card.querySelector('[data-act="delete"]').addEventListener("click", async () => {
      if (!confirm("Delete this comment?")) return;
      await sb.from("comments").delete().eq("id", c.id);
      loadCommentsAdmin();
    });
    list.appendChild(card);
  });
}

// ========== Services ==========
function bootServices() {
  $("#addServiceBtn").onclick = async () => {
    await sb.from("services").insert({
      name: "New service", price: "£0", tag: "", features: [], featured: false, order_idx: Date.now()
    });
    loadServicesAdmin();
  };
  loadServicesAdmin();
}

async function loadServicesAdmin() {
  const list = $("#servicesAdminList");
  const { data, error } = await sb.from("services").select("*").order("order_idx", { ascending: true });
  if (error) { list.innerHTML = `<p class="empty">Error: ${error.message}</p>`; return; }
  list.innerHTML = "";
  if (!data.length) { list.innerHTML = '<p class="empty">No services yet.</p>'; return; }
  data.forEach(s => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card__body">
        <label class="row">Name <input data-f="name" value="${escapeAttr(s.name || "")}" /></label>
        <label class="row">Price <input data-f="price" value="${escapeAttr(s.price || "")}" /></label>
        <label class="row">Tag <input data-f="tag" value="${escapeAttr(s.tag || "")}" /></label>
        <label class="row">Features (one per line)
          <textarea data-f="features" rows="4">${escapeHtml((s.features || []).join("\n"))}</textarea>
        </label>
        <label class="row row--check">
          <input type="checkbox" data-f="featured" ${s.featured ? "checked" : ""} /> Featured
        </label>
        <label class="row">Order <input type="number" data-f="order_idx" value="${s.order_idx || 0}" /></label>
        <div class="card__actions">
          <button class="btn-primary" data-act="save">Save</button>
          <button class="btn-danger" data-act="delete">Delete</button>
        </div>
      </div>`;
    card.querySelector('[data-act="save"]').onclick = async () => {
      const upd = {
        name: card.querySelector('[data-f="name"]').value.trim(),
        price: card.querySelector('[data-f="price"]').value.trim(),
        tag: card.querySelector('[data-f="tag"]').value.trim(),
        features: card.querySelector('[data-f="features"]').value.split("\n").map(s => s.trim()).filter(Boolean),
        featured: card.querySelector('[data-f="featured"]').checked,
        order_idx: Number(card.querySelector('[data-f="order_idx"]').value) || 0
      };
      await sb.from("services").update(upd).eq("id", s.id);
      flash(card);
    };
    card.querySelector('[data-act="delete"]').onclick = async () => {
      if (!confirm("Delete this service?")) return;
      await sb.from("services").delete().eq("id", s.id);
      loadServicesAdmin();
    };
    list.appendChild(card);
  });
}

// ========== Requests ==========
let requestFilter = "new";
function bootRequests() {
  const filterBtns = $$('.tab[data-tab="requests"] .filters button');
  filterBtns.forEach(b => b.onclick = () => {
    filterBtns.forEach(x => x.classList.toggle("is-active", x === b));
    requestFilter = b.dataset.filter;
    loadRequestsAdmin();
  });
  loadRequestsAdmin();
}

async function loadRequestsAdmin() {
  const list = $("#requestsAdminList");
  const { data, error } = await sb.from("requests").select("*").order("created_at", { ascending: false });
  if (error) { list.innerHTML = `<p class="empty">Error: ${error.message}</p>`; return; }
  const newCount = data.filter(d => (d.status || "new") === "new").length;
  const badge = $("#requestsBadge");
  badge.textContent = newCount;
  badge.hidden = newCount === 0;
  const docs = data.filter(d => {
    const st = d.status || "new";
    if (requestFilter === "all") return true;
    return st === requestFilter;
  });
  list.innerHTML = "";
  if (!docs.length) { list.innerHTML = '<p class="empty">No requests in this view.</p>'; return; }
  docs.forEach(r => {
    const when = r.created_at ? new Date(r.created_at).toLocaleString() : "";
    const status = r.status || "new";
    const d = r.data || {};
    const fields = Object.entries(d)
      .map(([k, v]) => `<div class="kv"><span>${escapeHtml(k)}</span><strong>${escapeHtml(String(v ?? ""))}</strong></div>`)
      .join("");
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card__body">
        <div class="card__meta">
          <strong>${escapeHtml(d.name || "(no name)")}</strong>
          ${d.phone ? '· ' + escapeHtml(d.phone) : ''}
          <span class="muted">${when}</span>
          <span class="pill pill--${status}">${status}</span>
        </div>
        <div class="kv-list">${fields}</div>
        <div class="card__actions">
          <button class="btn-ghost" data-act="contacted">Mark contacted</button>
          <button class="btn-primary" data-act="done">Mark done</button>
          <button class="btn-ghost" data-act="new">Reset to new</button>
          <button class="btn-danger" data-act="delete">Delete</button>
        </div>
      </div>`;
    const setStatus = async (st) => { await sb.from("requests").update({ status: st }).eq("id", r.id); loadRequestsAdmin(); };
    card.querySelector('[data-act="contacted"]').onclick = () => setStatus("contacted");
    card.querySelector('[data-act="done"]').onclick = () => setStatus("done");
    card.querySelector('[data-act="new"]').onclick = () => setStatus("new");
    card.querySelector('[data-act="delete"]').onclick = async () => {
      if (!confirm("Delete this request?")) return;
      await sb.from("requests").delete().eq("id", r.id);
      loadRequestsAdmin();
    };
    list.appendChild(card);
  });
}

// ========== Helpers ==========
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}
function escapeAttr(s) { return escapeHtml(s); }
function flash(el) {
  el.style.transition = "background .3s";
  el.style.background = "#1f3";
  setTimeout(() => el.style.background = "", 300);
}

let booted = false;
function bootDashboard() {
  if (booted) return;
  booted = true;
  bootGallery();
  bootComments();
  bootServices();
  bootRequests();
}
