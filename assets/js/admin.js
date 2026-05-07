import { sb, ADMIN_EMAILS } from "./supabase-init.js";

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
  if (!ADMIN_EMAILS.includes(data.user.email)) {
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
  if (user && ADMIN_EMAILS.includes(user.email)) showAdmin(user);
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
let pendingFiles = []; // selected files awaiting upload

function bootGallery() {
  const addBtn = $("#addGalleryBtn");
  const upload = $("#galleryUpload");
  const form = $("#galleryForm");
  const status = $("#galleryStatus");
  const cancel = $("#galleryCancel");
  const cancelBtn = form.querySelector('[data-act="cancel"]');
  const fileInput = form.querySelector('input[name="file"]');
  const dropzone = $("#galleryDropzone");

  // Inject preview area
  if (!form.querySelector(".preview-strip")) {
    const previewWrap = document.createElement("div");
    previewWrap.className = "preview-strip";
    previewWrap.id = "galleryPreview";
    dropzone.insertAdjacentElement("afterend", previewWrap);
  }
  const preview = $("#galleryPreview");

  const openModal = () => { upload.hidden = false; document.body.style.overflow = "hidden"; };
  const closeModal = () => {
    upload.hidden = true;
    document.body.style.overflow = "";
    form.reset();
    status.textContent = "";
    pendingFiles = [];
    preview.innerHTML = "";
  };

  addBtn.onclick = openModal;
  cancel.onclick = closeModal;
  cancelBtn.onclick = closeModal;
  upload.addEventListener("click", e => { if (e.target === upload) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !upload.hidden) closeModal(); });

  fileInput.addEventListener("change", () => {
    pendingFiles = Array.from(fileInput.files || []);
    renderPreview(preview);
  });

  // Drag & drop
  ["dragenter", "dragover"].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault(); dropzone.classList.add("is-drag");
  }));
  ["dragleave", "drop"].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault(); dropzone.classList.remove("is-drag");
  }));
  dropzone.addEventListener("drop", e => {
    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith("image/"));
    if (!files.length) return;
    pendingFiles = files;
    renderPreview(preview);
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!pendingFiles.length) {
      status.textContent = "Please pick at least one photo.";
      return;
    }
    const title = (form.querySelector('input[name="title"]').value || "").trim();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const images = [];
      for (let i = 0; i < pendingFiles.length; i++) {
        const f = pendingFiles[i];
        status.textContent = `Processing ${i + 1} / ${pendingFiles.length}…`;
        const compressed = await compressImage(f);
        status.textContent = `Uploading ${i + 1} / ${pendingFiles.length}…`;
        const img = await uploadOneImage(compressed, f.name);
        images.push(img);
        markPreviewDone(preview, i);
      }
      status.textContent = "Saving…";
      const { error: insErr } = await sb.from("gallery").insert({
        image_url: images[0].url,
        storage_path: images[0].path,
        images,
        title
      });
      if (insErr) throw insErr;
      const count = images.length;
      closeModal();
      toast(`Added work with ${count} photo${count === 1 ? "" : "s"}`);
      loadGalleryAdmin();
    } catch (err) {
      console.error(err);
      status.textContent = "";
      toast("Upload failed: " + (err.message || err), "err");
    } finally {
      submitBtn.disabled = false;
    }
  };

  loadGalleryAdmin();
}

function renderPreview(container, files = pendingFiles) {
  container.innerHTML = "";
  files.forEach((f, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "preview-thumb";
    wrap.dataset.idx = idx;
    const url = URL.createObjectURL(f);
    wrap.innerHTML = `
      <img src="${url}" alt="" />
      <button type="button" class="preview-thumb__del" aria-label="Remove">×</button>
      <span class="preview-thumb__check">✓</span>`;
    wrap.querySelector(".preview-thumb__del").onclick = () => {
      pendingFiles.splice(idx, 1);
      URL.revokeObjectURL(url);
      renderPreview(container);
    };
    container.appendChild(wrap);
  });
}
function markPreviewDone(container, idx) {
  const el = container.querySelector(`.preview-thumb[data-idx="${idx}"]`);
  if (el) el.classList.add("is-done");
}

// Resize image to max 1920px, JPEG 85%. Handles HEIC by relying on the browser's
// ability to decode it via <img src=ObjectURL> (iOS 17+ Safari supports this).
async function compressImage(file) {
  if (!file.type.startsWith("image/") && !/\.heic$/i.test(file.name)) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const MAX = 1920;
    let { width, height } = img;
    const scale = Math.min(1, MAX / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return file; // fallback if toBlob failed
    // Only return compressed if it's actually smaller
    if (blob.size > file.size) return file;
    return blob;
  } catch (e) {
    console.warn("Compression failed, uploading original:", e);
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function uploadOneImage(blobOrFile, originalName = "photo.jpg") {
  const ext = blobOrFile.type === "image/jpeg" ? "jpg" : (originalName.split(".").pop() || "jpg");
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from("gallery").upload(path, blobOrFile, {
    contentType: blobOrFile.type || "image/jpeg",
    upsert: false
  });
  if (error) throw error;
  const { data: pub } = sb.storage.from("gallery").getPublicUrl(path);
  return { url: pub.publicUrl, path };
}

async function loadGalleryAdmin() {
  const grid = $("#galleryAdminGrid");
  const counter = $("#galleryCounter");
  if (!grid.children.length) showLoading(grid);
  const { data, error } = await sb.from("gallery").select("*").order("created_at", { ascending: false });
  if (error) { grid.innerHTML = `<p class="empty">Error: ${error.message}</p>`; return; }
  const photoCount = (data || []).reduce((n, d) => n + (Array.isArray(d.images) ? d.images.length : (d.image_url ? 1 : 0)), 0);
  if (counter) counter.textContent = `${data.length} work${data.length === 1 ? "" : "s"} · ${photoCount} photo${photoCount === 1 ? "" : "s"}`;
  grid.innerHTML = "";
  if (!data.length) { grid.innerHTML = '<p class="empty">No works yet — add the first one.</p>'; return; }
  data.forEach(d => {
    const images = Array.isArray(d.images) && d.images.length
      ? d.images
      : (d.image_url ? [{ url: d.image_url, path: d.storage_path }] : []);
    const cover = images[0]?.url || "";
    const thumbs = images.map((im, idx) => `
      <div class="thumb" data-idx="${idx}">
        <img src="${im.url}" alt="" />
        <button class="thumb__del" data-act="delPhoto" data-idx="${idx}" title="Delete this photo">×</button>
      </div>
    `).join("");
    const card = document.createElement("div");
    card.className = "card card--photo";
    card.innerHTML = `
      <div class="card__img" style="background-image:url('${cover}')">
        <span class="card__count">${images.length} photo${images.length === 1 ? "" : "s"}</span>
      </div>
      <div class="card__body">
        <input class="card__title" value="${escapeAttr(d.title || "")}" placeholder="Title" />
        <div class="thumbs">${thumbs}</div>
        <label class="add-more">
          + Add more photos
          <input type="file" accept="image/*" multiple hidden data-act="addMore" />
        </label>
        <p class="status" data-role="status"></p>
        <div class="card__actions">
          <button class="btn-ghost" data-act="save">Save title</button>
          <button class="btn-danger" data-act="delete">Delete work</button>
        </div>
      </div>`;
    const cardStatus = card.querySelector('[data-role="status"]');

    card.querySelector('[data-act="save"]').onclick = async () => {
      const t = card.querySelector(".card__title").value.trim();
      const { error } = await sb.from("gallery").update({ title: t }).eq("id", d.id);
      if (error) toast("Save failed: " + error.message, "err");
      else toast("Title saved");
    };

    card.querySelector('[data-act="delete"]').onclick = async () => {
      if (!await confirmDialog("Delete work", "Delete this whole work and all its photos? This cannot be undone.", { okText: "Delete" })) return;
      const paths = images.map(i => i.path).filter(Boolean);
      if (paths.length) await sb.storage.from("gallery").remove(paths);
      const { error } = await sb.from("gallery").delete().eq("id", d.id);
      if (error) toast("Delete failed: " + error.message, "err");
      else toast("Work deleted");
      loadGalleryAdmin();
    };

    card.querySelectorAll('[data-act="delPhoto"]').forEach(btn => {
      btn.onclick = async () => {
        const idx = +btn.dataset.idx;
        if (images.length === 1) { toast("Can't delete the last photo. Delete the work instead.", "err"); return; }
        if (!await confirmDialog("Delete photo", "Delete this photo?", { okText: "Delete" })) return;
        const removed = images[idx];
        const remaining = images.filter((_, i) => i !== idx);
        if (removed.path) await sb.storage.from("gallery").remove([removed.path]);
        await sb.from("gallery").update({
          images: remaining,
          image_url: remaining[0].url,
          storage_path: remaining[0].path
        }).eq("id", d.id);
        loadGalleryAdmin();
      };
    });

    card.querySelector('[data-act="addMore"]').onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      try {
        const added = [];
        for (let i = 0; i < files.length; i++) {
          cardStatus.textContent = `Processing ${i + 1} / ${files.length}…`;
          const compressed = await compressImage(files[i]);
          cardStatus.textContent = `Uploading ${i + 1} / ${files.length}…`;
          added.push(await uploadOneImage(compressed, files[i].name));
        }
        const merged = images.concat(added);
        await sb.from("gallery").update({
          images: merged,
          image_url: merged[0].url,
          storage_path: merged[0].path
        }).eq("id", d.id);
        cardStatus.textContent = "";
        toast(`Added ${added.length} photo${added.length === 1 ? "" : "s"}`);
        loadGalleryAdmin();
      } catch (err) {
        console.error(err);
        cardStatus.textContent = "";
        toast("Upload failed: " + err.message, "err");
      }
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
  const counter = $("#commentsCounter");
  if (!list.children.length) showLoading(list);
  const { data, error } = await sb.from("comments").select("*").order("created_at", { ascending: false });
  if (error) { list.innerHTML = `<p class="empty">Error: ${error.message}</p>`; return; }
  const pending = data.filter(d => !d.approved).length;
  const badge = $("#commentsBadge");
  badge.textContent = pending;
  badge.hidden = pending === 0;
  if (counter) counter.textContent = `${data.length} total · ${pending} pending`;
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
      toast("Comment approved");
      loadCommentsAdmin();
    });
    card.querySelector('[data-act="unapprove"]')?.addEventListener("click", async () => {
      await sb.from("comments").update({ approved: false }).eq("id", c.id);
      toast("Comment unapproved");
      loadCommentsAdmin();
    });
    card.querySelector('[data-act="delete"]').addEventListener("click", async () => {
      if (!await confirmDialog("Delete comment", "Delete this comment?", { okText: "Delete" })) return;
      await sb.from("comments").delete().eq("id", c.id);
      toast("Comment deleted");
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
  const counter = $("#servicesCounter");
  if (!list.children.length) showLoading(list);
  const { data, error } = await sb.from("services").select("*").order("order_idx", { ascending: true });
  if (error) { list.innerHTML = `<p class="empty">Error: ${error.message}</p>`; return; }
  if (counter) counter.textContent = `${data.length} item${data.length === 1 ? "" : "s"}`;
  list.innerHTML = "";
  if (!data.length) { list.innerHTML = '<p class="empty">No services yet — click "Add service".</p>'; return; }
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
      const { error } = await sb.from("services").update(upd).eq("id", s.id);
      if (error) toast("Save failed: " + error.message, "err");
      else toast("Service saved");
    };
    card.querySelector('[data-act="delete"]').onclick = async () => {
      if (!await confirmDialog("Delete service", "Delete this service?", { okText: "Delete" })) return;
      await sb.from("services").delete().eq("id", s.id);
      toast("Service deleted");
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
  const counter = $("#requestsCounter");
  if (!list.children.length) showLoading(list);
  const { data, error } = await sb.from("requests").select("*").order("created_at", { ascending: false });
  if (error) { list.innerHTML = `<p class="empty">Error: ${error.message}</p>`; return; }
  const newCount = data.filter(d => (d.status || "new") === "new").length;
  const badge = $("#requestsBadge");
  badge.textContent = newCount;
  badge.hidden = newCount === 0;
  if (counter) counter.textContent = `${data.length} total · ${newCount} new`;
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
    const setStatus = async (st) => {
      await sb.from("requests").update({ status: st }).eq("id", r.id);
      toast(`Marked ${st}`);
      loadRequestsAdmin();
    };
    card.querySelector('[data-act="contacted"]').onclick = () => setStatus("contacted");
    card.querySelector('[data-act="done"]').onclick = () => setStatus("done");
    card.querySelector('[data-act="new"]').onclick = () => setStatus("new");
    card.querySelector('[data-act="delete"]').onclick = async () => {
      if (!await confirmDialog("Delete request", "Delete this booking request?", { okText: "Delete" })) return;
      await sb.from("requests").delete().eq("id", r.id);
      toast("Request deleted");
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
function flash() { /* replaced by toast */ }

// ----- Toasts -----
let toastsEl;
function ensureToasts() {
  if (toastsEl) return toastsEl;
  toastsEl = document.createElement("div");
  toastsEl.className = "toasts";
  document.body.appendChild(toastsEl);
  return toastsEl;
}
function toast(message, type = "ok") {
  const c = ensureToasts();
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.textContent = message;
  c.appendChild(el);
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 250);
  }, 2800);
}

// ----- Custom confirm -----
function confirmDialog(title, message, { okText = "Confirm", danger = true } = {}) {
  return new Promise(resolve => {
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="modal__actions">
          <button class="btn-ghost" data-act="cancel">Cancel</button>
          <button class="${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${escapeHtml(okText)}</button>
        </div>
      </div>`;
    const close = (val) => { back.remove(); document.removeEventListener("keydown", esc); resolve(val); };
    const esc = e => { if (e.key === "Escape") close(false); };
    back.querySelector('[data-act="cancel"]').onclick = () => close(false);
    back.querySelector('[data-act="ok"]').onclick = () => close(true);
    back.addEventListener("click", e => { if (e.target === back) close(false); });
    document.addEventListener("keydown", esc);
    document.body.appendChild(back);
    back.querySelector('[data-act="ok"]').focus();
  });
}

// ----- Spinner helper -----
function showLoading(container) {
  container.innerHTML = '<div class="loading"><span class="spinner"></span>Loading…</div>';
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
