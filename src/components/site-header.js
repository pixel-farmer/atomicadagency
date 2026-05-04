/**
 * Site chrome: logo + primary nav + mobile toggle.
 * @param {{ absoluteSectionLinks?: boolean }} [opts]
 *   When true, nav links use `/#section` (subpages). When false, `#section` (home).
 */
export function createSiteHeader({ absoluteSectionLinks = false } = {}) {
  const section = (id) => (absoluteSectionLinks ? `/#${id}` : `#${id}`);

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <a class="logo" href="/">
      <img
        src="/atomic-logo200.png"
        alt="Atomic Ad Agency"
        width="300"
        height="95"
        decoding="async"
      />
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="${section('about')}">About</a>
      <a href="${section('work')}">Work</a>
      <a href="${section('news')}">News</a>
      <a href="${section('contact')}">Contact</a>
    </nav>
    <button type="button" class="nav-toggle" aria-expanded="false" aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>
  `;

  return header;
}
