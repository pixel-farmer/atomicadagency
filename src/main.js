import 'lenis/dist/lenis.css';
import Lenis from 'lenis';
import { createSiteHeader } from './components/site-header.js';

const headerMount = document.getElementById('header-mount');
if (headerMount) {
  const absoluteSectionLinks = headerMount.dataset.sectionLinks === 'absolute';
  headerMount.replaceWith(createSiteHeader({ absoluteSectionLinks }));
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  new Lenis({
    autoRaf: true,
    anchors: true,
    smoothWheel: true,
    stopInertiaOnNavigate: true,
  });
}

const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.nav');

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    });
  });
}
