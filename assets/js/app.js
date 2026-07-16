(function () {
  var PAGE_ASPECT = 850.5 / 1134; // width / height of the source pages
  var ASSET_VERSION = 9; // bump whenever page images are replaced, to bust browser cache
  var IMAGES = [
    'assets/pages/cover.jpg?v=' + ASSET_VERSION,
    'assets/pages/program.jpg?v=' + ASSET_VERSION,
    'assets/pages/thankyou.jpg?v=' + ASSET_VERSION,
    'assets/pages/backcover.jpg?v=' + ASSET_VERSION
  ];
  var TOTAL = IMAGES.length;

  var bookEl = document.getElementById('book');
  var wrapperEl = document.getElementById('book-wrapper');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var indicator = document.getElementById('pageIndicator');
  var hintEl = document.getElementById('flipHint');

  var pageFlip = null;
  var resizeTimer = null;

  function computeSize() {
    var maxW = Math.min(window.innerWidth * 0.92, 620);
    var maxH = window.innerHeight * 0.68;
    var w = maxW;
    var h = w / PAGE_ASPECT;
    if (h > maxH) {
      h = maxH;
      w = h * PAGE_ASPECT;
    }
    return { width: Math.round(w), height: Math.round(h) };
  }

  function updateUI() {
    var current = pageFlip.getCurrentPageIndex();
    var shown = Math.min(current + 1, TOTAL);
    indicator.textContent = shown + ' / ' + TOTAL;
    prevBtn.disabled = current <= 0;
    nextBtn.disabled = current >= TOTAL - 1;
  }

  function hideHint() {
    if (hintEl) hintEl.classList.add('is-hidden');
  }

  // Crispness comes from the source images being rendered at a higher
  // resolution than they display at (the browser downscales them, which
  // stays sharp). We deliberately do NOT resize the canvas backing store by
  // devicePixelRatio here: doing so multiplies canvas + image memory (dpr^2)
  // and races the library's render loop, which on memory-constrained phones
  // (notably iOS Safari) caused the book to render blank. Letting the library
  // manage its own canvas is far more reliable across devices.
  function buildFlip(startPage) {
    var size = computeSize();

    // PageFlip only switches to a two-page spread when the container has
    // room for 2x the page width, so cap the wrapper to a single page.
    wrapperEl.style.maxWidth = size.width + 'px';

    if (pageFlip) {
      try { pageFlip.destroy(); } catch (e) { /* no-op */ }
      bookEl.innerHTML = '';
    }

    pageFlip = new St.PageFlip(bookEl, {
      width: size.width,
      height: size.height,
      size: 'fixed',
      showCover: true,
      maxShadowOpacity: 0.6,
      mobileScrollSupport: false,
      usePortrait: true,
      flippingTime: 700,
      autoSize: false
    });

    pageFlip.loadFromImages(IMAGES);

    if (startPage) {
      pageFlip.turnToPage(startPage);
    }

    pageFlip.on('flip', function () {
      updateUI();
      hideHint();
    });
    pageFlip.on('init', function () {
      updateUI();
    });
  }

  buildFlip(0);

  // The animated flip is driven by the library's internal state machine,
  // which can occasionally stall (e.g. a click that lands mid-animation) and
  // leave the book stuck on the same page with no visible error. Guard
  // against that: if the page index hasn't moved shortly after we asked for
  // a flip, jump straight there so a button press always eventually works.
  function safeFlip(flipMethod, delta) {
    hideHint();
    var before = pageFlip.getCurrentPageIndex();
    var target = Math.max(0, Math.min(TOTAL - 1, before + delta));
    if (target === before) return;

    flipMethod.call(pageFlip);

    setTimeout(function () {
      if (pageFlip.getCurrentPageIndex() === before) {
        pageFlip.turnToPage(target);
      }
    }, 900);
  }

  prevBtn.addEventListener('click', function () {
    safeFlip(pageFlip.flipPrev, -1);
  });
  nextBtn.addEventListener('click', function () {
    safeFlip(pageFlip.flipNext, 1);
  });
  bookEl.addEventListener('click', hideHint);
  bookEl.addEventListener('touchstart', hideHint, { passive: true });

  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var current = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
      buildFlip(current);
    }, 200);
  });
})();
