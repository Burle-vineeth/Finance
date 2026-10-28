// Dark Reader (the browser extension) darkens a page by guessing new colours for it, which turns this app's
// cards, chips and bars muddy and hard to read. The app has its own dark theme, so while Dark Reader is darkening
// the page, switch to that theme and ask Dark Reader to stand down: it leaves alone any page that has
// <meta name="darkreader-lock">, and takes its colours off if the tag appears after it started.
//
// Only Dark Reader's default mode (Dynamic) honours the tag. Its Filter and Static modes invert the page whatever
// the page says, and an inverted dark theme comes out light, so in those modes the page is left as it is.

const DARK_CLASS = 'ion-palette-dark';

const darkReaderIsDarkening = (root: HTMLElement) =>
  root.getAttribute('data-darkreader-mode') === 'dynamic' && root.getAttribute('data-darkreader-scheme') === 'dark';

export function followDarkReader(doc: Document = document): void {
  const root = doc.documentElement;

  const takeOver = () => {
    if (!darkReaderIsDarkening(root)) {
      return;
    }
    root.classList.add(DARK_CLASS);
    if (!doc.querySelector('meta[name="darkreader-lock"]')) {
      const lock = doc.createElement('meta');
      lock.name = 'darkreader-lock';
      doc.head.appendChild(lock);
    }
  };

  takeOver();
  // Dark Reader can start after the app does, or be switched on while the app is open
  new MutationObserver(takeOver).observe(root, {
    attributes: true,
    attributeFilter: ['data-darkreader-mode', 'data-darkreader-scheme'],
  });
}
