(function () {
  var PAGE_ASPECT = 1836 / 2376; // width / height of the source pages
  var ASSET_VERSION = 7; // bump whenever page images are replaced, to bust browser cache
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
  var canvasObserver = null;
  var blankCanvasRetries = 0;
  var MAX_BLANK_CANVAS_RETRIES = 2;

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
  //
  // A single one-shot fix isn't reliable: the library's own 'init' event
  // fires via a 1ms timeout, which on slower devices can land before layout
  // has fully settled, so the CSS size we read may still be wrong/zero. Use
  // ResizeObserver to keep re-applying the fix every time the canvas's real
  // layout size changes (it always fires at least once with the current
  // size), with a polling fallback for older browsers.
  function applyCanvasScale(canvas) {
    var dpr = window.devicePixelRatio || 1;
    if (dpr <= 1) return;

    var rect = canvas.getBoundingClientRect();
    var cssWidth = Math.round(rect.width);
    var cssHeight = Math.round(rect.height);
    if (!cssWidth || !cssHeight) return;

    var wantWidth = Math.round(cssWidth * dpr);
    var wantHeight = Math.round(cssHeight * dpr);
    if (canvas.width === wantWidth && canvas.height === wantHeight) return;

    // Setting width/height wipes the canvas's pixel buffer, so the library's
    // render loop has to redraw everything from scratch afterwards. On a
    // busy/slow device, ResizeObserver can fire several times in quick
    // succession while layout is still settling (fonts, images, etc.); if
    // that happens faster than a redraw can complete, the canvas can end up
    // permanently blank -- each new resize clears it again before the
    // previous redraw ever lands. Debouncing (see sharpenCanvas) keeps this
    // to a single resize once things are stable, and we also force an
    // explicit redraw below rather than hoping the animation loop gets to it.
    canvas.width = wantWidth;
    canvas.height = wantHeight;

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';

    if (pageFlip) {
      try { pageFlip.turnToPage(pageFlip.getCurrentPageIndex()); } catch (e) { /* no-op */ }
    }
  }

  function sharpenCanvas() {
    var canvas = bookEl.querySelector('canvas.stf__canvas');
    if (!canvas) return;

    applyCanvasScale(canvas);

    if (canvasObserver) canvasObserver.disconnect();

    if ('ResizeObserver' in window) {
      var debounceTimer = null;
      canvasObserver = new ResizeObserver(function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          applyCanvasScale(canvas);
        }, 120);
      });
      canvasObserver.observe(canvas);
    } else {
      [50, 200, 500, 1200].forEach(function (delay) {
        setTimeout(function () { applyCanvasScale(canvas); }, delay);
      });
    }
  }

  function buildFlip(startPage) {
    var size = computeSize();

    // PageFlip only switches to a two-page spread when the container has
    // room for 2x the page width, so cap the wrapper to a single page.
    wrapperEl.style.maxWidth = size.width + 'px';

    if (canvasObserver) {
      canvasObserver.disconnect();
      canvasObserver = null;
    }

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
      checkCanvasRendered();
    });
  }

  // Safety net: if the canvas ends up blank for any reason (a resize/clear
  // racing the render loop, a one-off browser quirk, etc.), rebuild the
  // whole book from scratch rather than leaving a permanently empty page.
  function checkCanvasRendered() {
    setTimeout(function () {
      var canvas = bookEl.querySelector('canvas.stf__canvas');
      if (!canvas || !canvas.width || !canvas.height) return;
      var ctx = canvas.getContext('2d');
      var w = canvas.width, h = canvas.height;
      var samples = [
        [Math.floor(w / 2), Math.floor(h / 2)],
        [Math.floor(w * 0.25), Math.floor(h * 0.25)],
        [Math.floor(w * 0.75), Math.floor(h * 0.75)]
      ];
      var blank = true;
      try {
        for (var i = 0; i < samples.length; i++) {
          var data = ctx.getImageData(samples[i][0], samples[i][1], 1, 1).data;
          if (data[3] !== 0) { blank = false; break; }
        }
      } catch (e) {
        return; // can't inspect (e.g. tainted canvas) -- assume it's fine
      }
      if (blank && blankCanvasRetries < MAX_BLANK_CANVAS_RETRIES) {
        blankCanvasRetries++;
        var current = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
        buildFlip(current);
      }
    }, 1500);
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
