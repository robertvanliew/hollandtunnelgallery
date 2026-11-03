// Demo forms: show a confirmation instead of submitting.
// At launch these post to the form handler (Netlify Forms / Formspree) routed to the gallery inbox.
document.querySelectorAll('form[data-demo]').forEach((form) => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = form.dataset.demo || 'Thank you. We will be in touch soon.';
    const p = document.createElement('p');
    p.className = 'form-thanks';
    p.setAttribute('role', 'status');
    p.textContent = msg;
    form.replaceWith(p);
  });
});

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
