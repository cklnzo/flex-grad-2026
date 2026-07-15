(function () {
  var PAGE_ASPECT = 1836 / 2376; // width / height of the source pages
  var ASSET_VERSION = 4; // bump whenever page images are replaced, to bust browser cache
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

  // StPageFlip sizes its <canvas> backing store using CSS pixels only, so on
  // Retina/HiDPI screens the browser upscales the bitmap and everything
  // (especially text) looks soft/blurry. Re-size the backing store to match
  // the device pixel ratio and scale the drawing context to compensate; the
  // library's internal requestAnimationFrame loop then redraws crisply.
  function sharpenCanvas() {
    var canvas = bookEl.querySelector('canvas.stf__canvas');
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    if (dpr <= 1) return;

    var cs = getComputedStyle(canvas);
    var cssWidth = parseInt(cs.getPropertyValue('width'), 10);
    var cssHeight = parseInt(cs.getPropertyValue('height'), 10);
    if (!cssWidth || !cssHeight) return;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  }

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
      sharpenCanvas();
    });
  }

  buildFlip(0);

  prevBtn.addEventListener('click', function () {
    hideHint();
    pageFlip.flipPrev();
  });
  nextBtn.addEventListener('click', function () {
    hideHint();
    pageFlip.flipNext();
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
