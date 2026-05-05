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

document.querySelectorAll('.service, .plan, .review, .gallery__item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});
