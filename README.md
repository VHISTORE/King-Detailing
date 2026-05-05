# King Detailing

Website for King Detailing — premium car detailing studio.

**Location:** Unit 7F, South Hams Business Park, Churchstow, Kingsbridge, TQ7 3QH

## Run locally

Just open `index.html` in a browser, or serve it:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure

```
.
├── index.html
├── assets/
│   ├── css/style.css
│   ├── js/main.js
│   └── img/logo.png
└── README.md
```

## To finalise before going live

1. **Booking form** — uncomment the Formspree block in `assets/js/main.js` and paste your endpoint from https://formspree.io (free up to 50 submissions/month).
2. **Phone & email** — replace placeholder `+44 1548 000 000` and `info@kingdetailing.co.uk` in `index.html` (`#contact` section + footer).
3. **Social links** — fill in real Instagram / Facebook / WhatsApp URLs.
4. **Gallery** — replace Unsplash URLs with real before/after photos (drop them into `assets/img/`).
5. **Pricing** — adjust prices to match your actual rates.
6. **Opening hours** — currently set to Mon–Sat 9:00–18:00.

## Deploy

- **Netlify**: drag the folder onto https://app.netlify.com/drop
- **Vercel**: run `vercel` in this folder
- **GitHub Pages**: push to a repo and enable Pages
