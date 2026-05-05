// Year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Mobile menu
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
burger.addEventListener('click', () => nav.classList.toggle('open'));
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

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
  } else {
    // quote / fleet — no auto price
    const labelMap = { quote: 'Custom quote', fleet: 'Fleet enquiry' };
    els.totalService.textContent = `${labelMap[service]} · ${SIZE_LABEL[size]}`;
    els.totalBase.textContent = '—';
    els.totalAddonRow.hidden = true;
    els.totalFinal.textContent = 'Quote on request';
    els.totalNote.textContent = 'We\'ll review your details and come back with a tailored quote.';
  }
}

[els.body, els.service].forEach(el => el.addEventListener('change', recalc));
document.querySelectorAll('input[name="location"]').forEach(r => r.addEventListener('change', recalc));
recalc();

// Booking form submit (placeholder — replace with Formspree endpoint)
const form = document.getElementById('bookingForm');
const status = document.getElementById('formStatus');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  status.textContent = 'Sending...';
  // TODO: replace with real endpoint, e.g. Formspree:
  // const res = await fetch('https://formspree.io/f/YOUR_ID', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
  // if (res.ok) { status.textContent = 'Спасибо! Мы перезвоним в течение 15 минут.'; form.reset(); }
  // else status.textContent = 'Ошибка отправки. Позвоните нам напрямую.';
  console.log('Заявка:', data);
  setTimeout(() => {
    status.textContent = 'Thanks! We\'ll get back to you shortly.';
    form.reset();
  }, 600);
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
