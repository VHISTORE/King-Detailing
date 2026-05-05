// Always start at the top, ignore browser's saved scroll
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('load', () => {
  if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' });
});

// Year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Mobile menu
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
const backdrop = document.getElementById('navBackdrop');

const setMenu = (open) => {
  nav.classList.toggle('open', open);
  burger.classList.toggle('open', open);
  backdrop.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.classList.toggle('nav-locked', open);
};

burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
backdrop.addEventListener('click', () => setMenu(false));
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

// UK phone formatting (light touch — accept 07xxx and +44 forms)
const phoneInput = document.querySelector('input[name="phone"]');
phoneInput.addEventListener('input', (e) => {
  let v = e.target.value.replace(/[^\d+]/g, '');
  if (v.startsWith('+44')) {
    const d = v.slice(3);
    e.target.value = '+44 ' + d.replace(/(\d{4})(\d{0,3})(\d{0,3}).*/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(' '));
  } else if (v.startsWith('0')) {
    e.target.value = v.replace(/(\d{5})(\d{0,3})(\d{0,3}).*/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(' '));
  } else {
    e.target.value = v;
  }
});

// === Live price calculator ===
const PRICES = {
  express:  { label: 'Express Wash',    small: 15,  medium: 18,  large: 22  },
  basic:    { label: 'Basic Wash',      small: 20,  medium: 25,  large: 30  },
  standard: { label: 'Standard Valet',  small: 40,  medium: 50,  large: 60  },
  full:     { label: 'Full Valet',      small: 80,  medium: 100, large: 120 },
  deep:     { label: 'Deep Clean',      small: 120, medium: 150, large: 180 },
  premium:  { label: 'Premium Detail',  small: 200, medium: 275, large: 350 },
};
const FLAT_PRICES = {
  royal: { label: 'Royal Wash Pass',  amount: 450, suffix: '/year' },
  kings: { label: "King's Pass",      amount: 500, suffix: '/year' },
};
const QUOTE_LABELS = {
  gift:  'Gift card — amount on request',
  quote: 'Custom quote',
  fleet: 'Fleet enquiry',
};
const SIZE_LABEL = { small: 'Small', medium: 'Medium', large: 'Large' };
const LOCATION_FEE = { studio: 0, mobile: 10, collection: 10 };
const LOCATION_LABEL = { mobile: 'Mobile (+£10)', collection: 'Collection & delivery (+£10)' };

const els = {
  body: document.getElementById('bodyType'),
  service: document.getElementById('serviceSelect'),
  totalService: document.getElementById('totalService'),
  totalBase: document.getElementById('totalBase'),
  totalAddonRow: document.getElementById('totalAddonRow'),
  totalAddonLabel: document.getElementById('totalAddonLabel'),
  totalAddon: document.getElementById('totalAddon'),
  totalFinal: document.getElementById('totalFinal'),
  totalNote: document.getElementById('totalNote'),
};

function recalc() {
  const size = els.body.value;
  const service = els.service.value;
  const location = document.querySelector('input[name="location"]:checked').value;
  const fee = LOCATION_FEE[location] || 0;

  const priced = PRICES[service];
  const flat = FLAT_PRICES[service];

  if (priced) {
    const base = priced[size];
    els.totalService.textContent = `${priced.label} · ${SIZE_LABEL[size]}`;
    els.totalBase.textContent = `£${base}`;
    if (fee > 0) {
      els.totalAddonRow.hidden = false;
      els.totalAddonLabel.textContent = LOCATION_LABEL[location];
      els.totalAddon.textContent = `£${fee}`;
    } else {
      els.totalAddonRow.hidden = true;
    }
    els.totalFinal.textContent = `£${base + fee}`;
    els.totalNote.textContent = 'Final price confirmed after a quick inspection.';
  } else if (flat) {
    els.totalService.textContent = flat.label;
    els.totalBase.textContent = `£${flat.amount} ${flat.suffix}`;
    els.totalAddonRow.hidden = true;
    els.totalFinal.textContent = `£${flat.amount}`;
    els.totalNote.textContent = '13 services included. We\'ll confirm your start date and schedule.';
  } else {
    els.totalService.textContent = QUOTE_LABELS[service] || 'Custom enquiry';
    els.totalBase.textContent = '—';
    els.totalAddonRow.hidden = true;
    els.totalFinal.textContent = 'Quote on request';
    els.totalNote.textContent = 'We\'ll review your details and come back with a tailored quote.';
  }
}

[els.body, els.service].forEach(el => el.addEventListener('change', recalc));
document.querySelectorAll('input[name="location"]').forEach(r => r.addEventListener('change', recalc));
recalc();

// Min date = today
const dateInput = document.getElementById('bookingDate');
if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

// Gift toggle
const giftToggle = document.getElementById('giftToggle');
const giftFields = document.getElementById('giftFields');
giftToggle.addEventListener('change', () => { giftFields.hidden = !giftToggle.checked; });

// Membership / gift CTA buttons preselect form values
document.querySelectorAll('[data-plan]').forEach(btn => {
  btn.addEventListener('click', () => {
    const plan = btn.dataset.plan;
    const isGift = btn.dataset.gift === '1';
    if (plan) {
      els.service.value = plan;
      els.service.dispatchEvent(new Event('change'));
    }
    giftToggle.checked = isGift;
    giftFields.hidden = !isGift;
  });
});

// Booking form → Telegram
const TELEGRAM = {
  token: '8770857871:AAExx4zU8YitGZd5X5pEZXA35nuOuoV5PWI',
  chatIds: ['5776210499', '5512197362'],
};

const form = document.getElementById('bookingForm');
const status = document.getElementById('formStatus');
const escapeHtml = (s = '') => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const sizeLabel = SIZE_LABEL[data.body] || data.body;
  const serviceLabel = (PRICES[data.service] && PRICES[data.service].label)
    || (FLAT_PRICES[data.service] && FLAT_PRICES[data.service].label)
    || QUOTE_LABELS[data.service]
    || 'Custom enquiry';
  const locationLabel = {
    studio: 'At our studio',
    mobile: 'Mobile wash (+£10)',
    collection: 'Collection & delivery (+£10)',
  }[data.location] || data.location;
  const total = document.getElementById('totalFinal').textContent;
  const isGift = data.gift === 'on';
  const isMembership = !!FLAT_PRICES[data.service];

  const header = isGift
    ? '🎁 <b>NEW GIFT ORDER</b>'
    : isMembership
      ? '👑 <b>NEW MEMBERSHIP</b>'
      : '🚗 <b>NEW BOOKING</b>';
  const sep = '━━━━━━━━━━━━━━━';

  const block = (title, rows) => {
    const filled = rows.filter(Boolean);
    if (!filled.length) return null;
    return [title, ...filled].join('\n');
  };

  const sections = [
    `${header}\n<i>King Detailing · Kingsbridge</i>`,
    sep,

    block('👤 <b>Customer</b>', [
      `   • Name: ${escapeHtml(data.name)}`,
      `   • Phone: ${escapeHtml(data.phone)}`,
      data.email && `   • Email: ${escapeHtml(data.email)}`,
    ]),

    !isGift && block('🚙 <b>Vehicle</b>', [
      `   • Make/Model: ${escapeHtml(data.make || '—')} ${escapeHtml(data.model || '')}`.trim(),
      `   • Size: ${escapeHtml(sizeLabel)}`,
    ]),

    block(isMembership ? '👑 <b>Plan</b>' : isGift ? '🎁 <b>Gift</b>' : '🧽 <b>Service</b>', [
      `   • ${escapeHtml(serviceLabel)}`,
      !isMembership && !isGift && `   • Where: ${escapeHtml(locationLabel)}`,
      data.address && `   • Address: ${escapeHtml(data.address)}`,
    ]),

    (data.date || data.time) && block('📅 <b>Schedule</b>', [
      data.date && `   • Date: ${escapeHtml(data.date)}`,
      data.time && `   • Time: ${escapeHtml(data.time)}`,
    ]),

    block('💳 <b>Payment</b>', [
      `   • Method: ${escapeHtml(data.payment)}`,
      `   • <b>Total: ${escapeHtml(total)}</b>`,
    ]),

    isGift && block('🎀 <b>Recipient</b>', [
      data.recipient_name && `   • Name: ${escapeHtml(data.recipient_name)}`,
      data.recipient_contact && `   • Contact: ${escapeHtml(data.recipient_contact)}`,
      data.gift_message && `   • Message: <i>${escapeHtml(data.gift_message)}</i>`,
    ]),

    data.message && block('💬 <b>Notes</b>', [`   ${escapeHtml(data.message)}`]),
  ].filter(Boolean);

  const lines = sections.join('\n\n');

  status.textContent = 'Sending...';
  status.style.color = '';
  try {
    const results = await Promise.allSettled(
      TELEGRAM.chatIds.map(chatId =>
        fetch(`https://api.telegram.org/bot${TELEGRAM.token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: lines,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        }).then(r => r.json()).then(j => {
          if (!j.ok) throw new Error(`${chatId}: ${j.description}`);
          return j;
        })
      )
    );
    const anyOk = results.some(r => r.status === 'fulfilled');
    results.filter(r => r.status === 'rejected').forEach(r => console.error(r.reason));
    if (!anyOk) throw new Error('All Telegram sends failed');
    status.textContent = '✓ Thanks! We\'ll get back to you shortly.';
    form.reset();
    recalc();
  } catch (err) {
    console.error(err);
    status.style.color = '#ff6b6b';
    status.textContent = 'Could not send — please call us on +44 1548 000 000.';
  }
});

// Scroll reveal
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.service, .plan, .addon, .mobile__card, .business__stats > div, .review, .gallery__item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});
