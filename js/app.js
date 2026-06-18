// ============================================================
// Plates Admin Page — app.js
// Generated from the single-file prototype; logic preserved
// 1:1, only asset references changed from base64 to relative
// paths under /assets.
// ============================================================

// ===== Shared keyboard overlay (single source of truth) =====
// Both the letter-keyboard and number-keyboard IIFEs below call into
// window._overlay instead of each touching the overlay DOM/classes
// directly. This avoids the old bug where open/close behavior was
// reimplemented twice and could silently drift out of sync.
(function () {
  const overlay = document.getElementById('keyboardOverlay');
  const backdrop = document.getElementById('overlayBackdrop');
  const overlayLabel = document.getElementById('overlayLabel');
  const letterKbd = document.getElementById('letterKeyboard');
  const numberKbd = document.getElementById('numberKeyboard');

  let currentType = null; // 'letter' | 'number' | null
  const closeListeners = []; // fn(type) called right after close()

  function open(type) {
    currentType = type;
    overlayLabel.textContent = type === 'letter' ? 'الحروف' : 'الأرقام';
    letterKbd.style.display = type === 'letter' ? '' : 'none';
    numberKbd.style.display = type === 'number' ? '' : 'none';
    overlay.classList.add('open');
    backdrop.classList.add('open');
  }

  function close() {
    overlay.classList.remove('open');
    backdrop.classList.remove('open');
    const closedType = currentType;
    currentType = null;
    closeListeners.forEach((fn) => fn(closedType));
  }

  // The shared backdrop is also used by the stop-confirm sheet (see the
  // auction module below). Only close THIS overlay if it's the one
  // actually open, so a backdrop click while the confirm sheet is open
  // doesn't also yank the (already-closed) keyboard overlay's classes.
  backdrop.addEventListener('click', () => {
    if (overlay.classList.contains('open')) close();
  });

  window._overlay = {
    open,
    close,
    onClose(fn) {
      closeListeners.push(fn);
    },
  };
})();

// ===== Auction flow: early-stop confirmation + final result modal =====
// New in Sprint 14. The admin's workflow is: choose plate -> enter
// letters/numbers -> start timer -> go live -> manually type in the
// winning price as it comes in over chat -> timer ends (or admin stops
// it early) -> a results screen shows the plate + price so it can be
// shown to the audience -> admin closes it and starts the next plate.
(function () {
  const confirmSheet = document.getElementById('stopConfirmSheet');
  const confirmEndBtn = document.getElementById('confirmEndBtn');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const backdrop = document.getElementById('overlayBackdrop');

  const resultModal = document.getElementById('resultModal');
  const resultPlateWrap = document.getElementById('resultPlateWrap');
  const resultPrice = document.getElementById('resultPrice');
  const resultCloseBtn = document.getElementById('resultCloseBtn');
  const plateDisplay = document.getElementById('plateDisplay');
  const priceInput = document.getElementById('priceInput');

  function openConfirmSheet() {
    confirmSheet.classList.add('open');
    backdrop.classList.add('open');
  }

  function closeConfirmSheet() {
    confirmSheet.classList.remove('open');
    backdrop.classList.remove('open');
  }

  function showResult() {
    // Clone the live plate exactly as-is (shape class, filled slots,
    // background image) so the result screen can never drift out of
    // sync with what was actually shown on screen during the auction.
    resultPlateWrap.innerHTML = '';
    resultPlateWrap.appendChild(plateDisplay.cloneNode(true));
    resultPrice.textContent = (priceInput.value || '0').trim();
    resultModal.classList.add('open');
  }

  function closeResult() {
    resultModal.classList.remove('open');
    resultPlateWrap.innerHTML = '';
    window._timer.returnToSetupMode();
  }

  // Triggered by the stop button: pause already happened in the timer
  // module, this just asks what to do next.
  function confirmEarlyStop() {
    openConfirmSheet();
  }

  confirmEndBtn.addEventListener('click', () => {
    closeConfirmSheet();
    showResult();
  });

  confirmCancelBtn.addEventListener('click', () => {
    closeConfirmSheet();
    window._timer.resume();
  });

  // Tapping the backdrop while the confirm sheet is open should behave
  // like Cancel (resume), not silently do nothing.
  backdrop.addEventListener('click', () => {
    if (confirmSheet.classList.contains('open')) {
      closeConfirmSheet();
      window._timer.resume();
    }
  });

  resultCloseBtn.addEventListener('click', closeResult);

  window._auction = {
    confirmEarlyStop,
    finish: showResult, // natural timer-zero finish skips the confirm step
  };
})();

// ===== Price auto-size + Timer =====
(function () {
  // Auto-size price input to content width
  const priceInput = document.getElementById('priceInput');
  function sizePriceInput() {
    priceInput.style.width = Math.max(2, priceInput.value.length) + 'ch';
  }
  if (priceInput) {
    priceInput.addEventListener('input', sizePriceInput);
    sizePriceInput();
  }
})();

(function () {
  const display = document.getElementById('timerDisplay');
  const hoursInput = document.getElementById('timerHours');
  const minutesInput = document.getElementById('timerMinutes');
  const secondsInput = document.getElementById('timerSeconds');
  const startBtn = document.getElementById('timerStartBtn');
  const inputs = [hoursInput, minutesInput, secondsInput];

  let remainingSeconds = 0;
  let intervalId = null;

  function format(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
  }

  function readInputsSeconds() {
    const h = Math.max(Number(hoursInput.value) || 0, 0);
    const m = Math.min(Math.max(Number(minutesInput.value) || 0, 0), 59);
    const s = Math.min(Math.max(Number(secondsInput.value) || 0, 0), 59);
    return h * 3600 + m * 60 + s;
  }

  function updateDisplayFromInputs() {
    display.textContent = format(readInputsSeconds());
  }

  function stopInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function tick() {
    if (remainingSeconds <= 0) {
      stopInterval();
      display.textContent = format(0);
      window._auction.finish(); // natural finish: straight to result, no confirm
      return;
    }
    remainingSeconds -= 1;
    display.textContent = format(remainingSeconds);
  }

  const stopBtn = document.getElementById('timerStopBtn');
  const timerSetup = document.getElementById('timerSetup');

  function enterRunningMode() {
    inputs.forEach((i) => (i.disabled = true));
    startBtn.disabled = true;
    timerSetup.style.display = 'none';
    stopBtn.style.display = 'flex';
    document.querySelector('.upper-panel').classList.add('timer-running');
    document.querySelector('.lower-panel').classList.add('timer-running');
  }

  function returnToSetupMode() {
    stopInterval();
    remainingSeconds = 0;
    display.textContent = format(0);
    timerSetup.style.display = '';
    stopBtn.style.display = 'none';
    document.querySelector('.upper-panel').classList.remove('timer-running');
    document.querySelector('.lower-panel').classList.remove('timer-running');
    inputs.forEach((i) => (i.disabled = false));
    startBtn.disabled = false;
    hoursInput.value = 0;
    minutesInput.value = 0;
    secondsInput.value = 0;
    updateDisplayFromInputs();
  }

  startBtn.addEventListener('click', () => {
    remainingSeconds = readInputsSeconds();
    if (remainingSeconds <= 0) return;

    display.textContent = format(remainingSeconds);
    enterRunningMode();
    stopInterval();
    intervalId = setInterval(tick, 1000);
  });

  // Manual stop no longer resets immediately — it asks for confirmation,
  // since stopping early during a live auction is a meaningful action,
  // not a misclick to silently recover from.
  stopBtn.addEventListener('click', () => {
    stopInterval(); // pause the countdown while the admin decides
    window._auction.confirmEarlyStop();
  });

  inputs.forEach((input) =>
    input.addEventListener('input', updateDisplayFromInputs),
  );

  updateDisplayFromInputs();

  // Exposed so window._auction (defined later) can resume the countdown
  // if the admin cancels the early-stop confirmation, and so it can
  // return to setup mode after the result modal closes.
  window._timer = {
    resume() {
      if (remainingSeconds > 0 && !intervalId) {
        intervalId = setInterval(tick, 1000);
      }
    },
    returnToSetupMode,
  };
})();

(function () {
  // ===== Plate selector logic =====
  const PLATE_DATA = {
    'plate-1': { src: 'assets/plates/plate-1.svg', letters: 'dual' },
    'plate-2': { src: 'assets/plates/plate-2.svg', letters: 'dual' },
    'plate-3': { src: 'assets/plates/plate-3.svg', letters: 'dual' },
    'plate-4': { src: 'assets/plates/plate-4.svg', letters: 'dual' },
    'plate-5': { src: 'assets/plates/plate-5.svg', letters: 'dual' },
    'plate-6': { src: 'assets/plates/plate-6.svg', letters: 'dual' },
    'plate-7': { src: 'assets/plates/plate-7.svg', letters: 'dual' },
    'plate-8': { src: 'assets/plates/plate-8.svg', letters: 'dual' },
    'plate-9': { src: 'assets/plates/plate-9.svg', letters: 'dual' },
    'ar-blue-long': { src: 'assets/plates/ar-blue-long.svg', letters: 'ar' },
    'ar-blue-wide': { src: 'assets/plates/ar-blue-wide.svg', letters: 'ar' },
    'ar-green-log': { src: 'assets/plates/ar-green-log.svg', letters: 'ar' },
    'ar-white-long': { src: 'assets/plates/ar-white-long.svg', letters: 'ar' },
    'ar-white-wide': { src: 'assets/plates/ar-white-wide.svg', letters: 'ar' },
    'ar-yellow-logo': {
      src: 'assets/plates/ar-yellow-logo.svg',
      letters: 'ar',
    },
    'en-plate': { src: 'assets/plates/en-plate.svg', letters: 'en' },
  };

  // PLATE_LABELS: shown under logo when a plate shape is selected
  // PLATE_CATEGORIES: used by filter bar (all/sport/personal/transport)
  const PLATE_LABELS = {
    'plate-1': 'لوحة خاص - نمط ١',
    'plate-2': 'لوحة خاص - نمط ٢',
    'plate-3': 'لوحة خاص - نمط ٣',
    'plate-4': 'لوحة خاص - نمط ٤',
    'plate-5': 'لوحة خاص - نمط ٥',
    'plate-6': 'لوحة مربعة - نمط ١',
    'plate-7': 'لوحة مربعة - نمط ٢',
    'plate-8': 'لوحة رياضية - نمط ٦',
    'plate-9': 'لوحة رياضية - نمط ٧',
    'ar-blue-long': 'خصوصي بشعار - أزرق طويل',
    'ar-blue-wide': 'خصوصي بشعار - أزرق عريض',
    'ar-green-log': 'خصوصي بشعار - أخضر',
    'ar-white-long': 'خصوصي بشعار - أبيض طويل',
    'ar-white-wide': 'خصوصي بشعار - أبيض عريض',
    'ar-yellow-logo': 'خصوصي بشعار - ذهبي',
    'en-plate': 'لوحة إنجليزية',
  };
  const PLATE_CATEGORIES = {
    'plate-1': 'personal',
    'plate-2': 'personal',
    'plate-3': 'personal',
    'plate-4': 'personal',
    'plate-5': 'personal',
    'plate-6': 'sport',
    'plate-7': 'transport',
    'plate-8': 'sport',
    'plate-9': 'transport',
    'ar-blue-long': 'transport',
    'ar-blue-wide': 'transport',
    'ar-green-log': 'personal',
    'ar-white-long': 'personal',
    'ar-white-wide': 'personal',
    'ar-yellow-logo': 'personal',
    'en-plate': 'personal',
  };

  const plateImg = document.getElementById('plateBgImg');
  const plateDisplay = document.getElementById('plateDisplay');
  const plateTypeLabel = document.getElementById('plateTypeLabel');
  const options = document.querySelectorAll('.plate-option');

  // Build "shape-<id>" class list once from PLATE_DATA keys, so every
  // plate has its own dedicated class that can be styled independently
  // in CSS (see "Per-plate slot position overrides" in styles.css).
  const ALL_SHAPE_CLASSES = Object.keys(PLATE_DATA).map((id) => 'shape-' + id);

  // Set data-category on all options at load time
  options.forEach((opt) => {
    const cat = PLATE_CATEGORIES[opt.dataset.plateId];
    if (cat) opt.dataset.category = cat;
  });

  options.forEach((opt) => {
    opt.addEventListener('click', () => {
      const data = PLATE_DATA[opt.dataset.plateId];
      if (!data) return;

      plateImg.src = data.src;
      plateDisplay.classList.remove('letters-dual', 'letters-ar', 'letters-en');
      plateDisplay.classList.add('letters-' + data.letters);

      // Swap the per-plate shape class so styles.css overrides apply
      plateDisplay.classList.remove(...ALL_SHAPE_CLASSES);
      plateDisplay.classList.add('shape-' + opt.dataset.plateId);

      if (plateTypeLabel && PLATE_LABELS[opt.dataset.plateId]) {
        plateTypeLabel.textContent = PLATE_LABELS[opt.dataset.plateId];
      }

      options.forEach((o) => o.classList.remove('active'));
      opt.classList.add('active');
      // also set data-category so filter bar works
      if (PLATE_CATEGORIES[opt.dataset.plateId]) {
        opt.dataset.category = PLATE_CATEGORIES[opt.dataset.plateId];
      }
      // Clear all entered letters/numbers when plate type changes
      if (typeof window._clearLetterSlots === 'function')
        window._clearLetterSlots();
      if (typeof window._clearNumberSlots === 'function')
        window._clearNumberSlots();
    });
  });
})();

(function () {
  // ===== Letter keyboard logic =====
  const LETTER_PAIRS = [
    {
      ar: 'assets/letters/ar/a.svg',
      en: 'assets/letters/en/a.svg',
      arLabel: 'ا',
      enLabel: 'A',
    },
    {
      ar: 'assets/letters/ar/b.svg',
      en: 'assets/letters/en/b.svg',
      arLabel: 'ب',
      enLabel: 'B',
    },
    {
      ar: 'assets/letters/ar/j.svg',
      en: 'assets/letters/en/j.svg',
      arLabel: 'ح',
      enLabel: 'J',
    },
    {
      ar: 'assets/letters/ar/d.svg',
      en: 'assets/letters/en/d.svg',
      arLabel: 'د',
      enLabel: 'D',
    },
    {
      ar: 'assets/letters/ar/r.svg',
      en: 'assets/letters/en/r.svg',
      arLabel: 'ر',
      enLabel: 'R',
    },
    {
      ar: 'assets/letters/ar/s.svg',
      en: 'assets/letters/en/s.svg',
      arLabel: 'س',
      enLabel: 'S',
    },
    {
      ar: 'assets/letters/ar/x.svg',
      en: 'assets/letters/en/x.svg',
      arLabel: 'ص',
      enLabel: 'X',
    },
    {
      ar: 'assets/letters/ar/t.svg',
      en: 'assets/letters/en/t.svg',
      arLabel: 'ط',
      enLabel: 'T',
    },
    {
      ar: 'assets/letters/ar/e.svg',
      en: 'assets/letters/en/e.svg',
      arLabel: 'ع',
      enLabel: 'E',
    },
    {
      ar: 'assets/letters/ar/g.svg',
      en: 'assets/letters/en/g.svg',
      arLabel: 'ق',
      enLabel: 'G',
    },
    {
      ar: 'assets/letters/ar/k.svg',
      en: 'assets/letters/en/k.svg',
      arLabel: 'ك',
      enLabel: 'K',
    },
    {
      ar: 'assets/letters/ar/l.svg',
      en: 'assets/letters/en/l.svg',
      arLabel: 'ل',
      enLabel: 'L',
    },
    {
      ar: 'assets/letters/ar/z.svg',
      en: 'assets/letters/en/z.svg',
      arLabel: 'م',
      enLabel: 'Z',
    },
    {
      ar: 'assets/letters/ar/n.svg',
      en: 'assets/letters/en/n.svg',
      arLabel: 'ن',
      enLabel: 'N',
    },
    {
      ar: 'assets/letters/ar/h.svg',
      en: 'assets/letters/en/h.svg',
      arLabel: 'ه',
      enLabel: 'H',
    },
    {
      ar: 'assets/letters/ar/u.svg',
      en: 'assets/letters/en/u.svg',
      arLabel: 'و',
      enLabel: 'U',
    },
    {
      ar: 'assets/letters/ar/v.svg',
      en: 'assets/letters/en/v.svg',
      arLabel: 'ى',
      enLabel: 'V',
    },
  ];

  const letterKeyboard = document.getElementById('letterKeyboard');
  const letterSlotsContainer = document.getElementById('letterSlots');
  const letterKeyButtons = Array.from(
    letterKeyboard.querySelectorAll('.key-btn'),
  );
  const letterSlotEls = Array.from(
    letterSlotsContainer.querySelectorAll('.plate-slot'),
  );

  // null = empty, otherwise an index into LETTER_PAIRS
  const letterSlotState = letterSlotEls.map(() => null);

  function renderLetterSlots() {
    letterSlotEls.forEach((el, i) => {
      const arSpan = el.querySelector('.slot-ar');
      const enSpan = el.querySelector('.slot-en');
      const state = letterSlotState[i];

      if (state === null) {
        arSpan.innerHTML = '';
        enSpan.innerHTML = '';
        el.classList.remove('filled');
      } else {
        const pair = LETTER_PAIRS[state];
        arSpan.innerHTML = `<img src="${pair.ar}" alt="${pair.arLabel}">`;
        enSpan.innerHTML = `<img src="${pair.en}" alt="${pair.enLabel}">`;
        el.classList.add('filled');
      }
    });

    const full = letterSlotState.every((s) => s !== null);
    letterKeyButtons.forEach((btn) => {
      btn.disabled = full;
    });
  }

  // Removes trailing empty slots from the flex layout (via
  // .empty-collapsed) once input is finalized, so justify-content:
  // center on .plate-slots centers the actual filled letters as a
  // group, instead of leaving a blank slot's worth of space after them.
  // Called only when the overlay closes — NOT on every render — so the
  // dashed guide boxes stay visible while the admin is still typing.
  function collapseTrailingEmptyLetterSlots() {
    letterSlotEls.forEach((el, i) => {
      const isTrailingEmpty =
        letterSlotState[i] === null &&
        letterSlotState.slice(i).every((s) => s === null);
      el.classList.toggle('empty-collapsed', isTrailingEmpty);
    });
  }

  function uncollapseLetterSlots() {
    letterSlotEls.forEach((el) => el.classList.remove('empty-collapsed'));
  }

  function fillNextLetterSlot(pairIndex) {
    const emptyIndex = letterSlotState.findIndex((s) => s === null);
    if (emptyIndex === -1) return; // full, max 3 reached
    letterSlotState[emptyIndex] = pairIndex;
    renderLetterSlots();
  }

  function clearLetterSlotsFrom(index) {
    for (let i = index; i < letterSlotState.length; i++) {
      letterSlotState[i] = null;
    }
    renderLetterSlots();
    // Editing again — restore the dashed guide boxes until the admin
    // finishes (overlay closes) and we collapse trailing empties again.
    uncollapseLetterSlots();
  }

  // --- Input display sync ---
  const letterInputSlots = Array.from(
    document.querySelectorAll('#letterInputDisplay .input-slot'),
  );

  function renderLetterInputDisplay() {
    letterInputSlots.forEach((el, i) => {
      const state = letterSlotState[i];
      if (state === null) {
        el.innerHTML = '<span class="slot-plus">+</span>';
        el.classList.remove('filled');
      } else {
        const pair = LETTER_PAIRS[state];
        el.innerHTML =
          `<img class="slot-char-img" src="${pair.ar}" alt="${pair.arLabel}">` +
          `<img class="slot-en-img" src="${pair.en}" alt="${pair.enLabel}">`;
        el.classList.add('filled');
      }
    });
  }

  // --- Overlay wiring (delegates to the shared window._overlay module) ---
  const openOverlay = window._overlay.open;
  const closeOverlay = window._overlay.close;

  // Once the admin closes the letter overlay (whether by filling all 3
  // slots or tapping the backdrop), finalize the centered layout.
  window._overlay.onClose((type) => {
    if (type === 'letter') collapseTrailingEmptyLetterSlots();
  });

  // Wire input display letter slots
  letterInputSlots.forEach((el, i) => {
    el.addEventListener('click', () => {
      if (letterSlotState[i] !== null) {
        clearLetterSlotsFrom(i);
        renderLetterInputDisplay();
      } else {
        uncollapseLetterSlots();
        openOverlay('letter');
      }
    });
  });

  letterKeyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      fillNextLetterSlot(Number(btn.dataset.letterIndex));
      renderLetterInputDisplay();
      // Close overlay if all 3 slots filled
      if (letterSlotState.every((s) => s !== null)) closeOverlay();
    });
  });

  letterSlotEls.forEach((el, i) => {
    el.addEventListener('click', () => {
      if (letterSlotState[i] !== null) {
        clearLetterSlotsFrom(i);
        renderLetterInputDisplay();
      }
    });
  });

  renderLetterSlots();
  renderLetterInputDisplay();

  // Expose clear function globally so plate selector can call it
  window._clearLetterSlots = function () {
    clearLetterSlotsFrom(0);
    renderLetterSlots();
    renderLetterInputDisplay();
  };
})();

(function () {
  // ===== Number keyboard logic =====
  const NUMBER_PAIRS = [
    {
      ar: 'assets/numbers/ar/0.svg',
      en: 'assets/numbers/en/0.svg',
      arLabel: 'AR-0',
      enLabel: '0',
    },
    {
      ar: 'assets/numbers/ar/1.svg',
      en: 'assets/numbers/en/1.svg',
      arLabel: 'AR-1',
      enLabel: '1',
    },
    {
      ar: 'assets/numbers/ar/2.svg',
      en: 'assets/numbers/en/2.svg',
      arLabel: 'AR-2',
      enLabel: '2',
    },
    {
      ar: 'assets/numbers/ar/3.svg',
      en: 'assets/numbers/en/3.svg',
      arLabel: 'AR-3',
      enLabel: '3',
    },
    {
      ar: 'assets/numbers/ar/4.svg',
      en: 'assets/numbers/en/4.svg',
      arLabel: 'AR-4',
      enLabel: '4',
    },
    {
      ar: 'assets/numbers/ar/5.svg',
      en: 'assets/numbers/en/5.svg',
      arLabel: 'AR-5',
      enLabel: '5',
    },
    {
      ar: 'assets/numbers/ar/6.svg',
      en: 'assets/numbers/en/6.svg',
      arLabel: 'AR-6',
      enLabel: '6',
    },
    {
      ar: 'assets/numbers/ar/7.svg',
      en: 'assets/numbers/en/7.svg',
      arLabel: 'AR-7',
      enLabel: '7',
    },
    {
      ar: 'assets/numbers/ar/8.svg',
      en: 'assets/numbers/en/8.svg',
      arLabel: 'AR-8',
      enLabel: '8',
    },
    {
      ar: 'assets/numbers/ar/9.svg',
      en: 'assets/numbers/en/9.svg',
      arLabel: 'AR-9',
      enLabel: '9',
    },
  ];

  const numberKeyboard = document.getElementById('numberKeyboard');
  const numberSlotsContainer = document.getElementById('numberSlots');
  const numberKeyButtons = Array.from(
    numberKeyboard.querySelectorAll('.key-btn'),
  );
  const numberSlotEls = Array.from(
    numberSlotsContainer.querySelectorAll('.plate-slot'),
  );

  // null = empty, otherwise an index into NUMBER_PAIRS (0-9)
  const numberSlotState = numberSlotEls.map(() => null);

  function renderNumberSlots() {
    numberSlotEls.forEach((el, i) => {
      const arSpan = el.querySelector('.slot-ar');
      const enSpan = el.querySelector('.slot-en');
      const state = numberSlotState[i];

      if (state === null) {
        arSpan.innerHTML = '';
        enSpan.innerHTML = '';
        el.classList.remove('filled');
      } else {
        const pair = NUMBER_PAIRS[state];
        arSpan.innerHTML = `<img src="${pair.ar}" alt="${pair.arLabel}">`;
        enSpan.innerHTML = `<img src="${pair.en}" alt="${pair.enLabel}">`;
        el.classList.add('filled');
      }
    });

    const full = numberSlotState.every((s) => s !== null);
    numberKeyButtons.forEach((btn) => {
      btn.disabled = full;
    });
  }

  // See collapseTrailingEmptyLetterSlots above for the rationale —
  // mirrors the same logic for the number group.
  function collapseTrailingEmptyNumberSlots() {
    numberSlotEls.forEach((el, i) => {
      const isTrailingEmpty =
        numberSlotState[i] === null &&
        numberSlotState.slice(i).every((s) => s === null);
      el.classList.toggle('empty-collapsed', isTrailingEmpty);
    });
  }

  function uncollapseNumberSlots() {
    numberSlotEls.forEach((el) => el.classList.remove('empty-collapsed'));
  }

  function fillNextNumberSlot(digitIndex) {
    const emptyIndex = numberSlotState.findIndex((s) => s === null);
    if (emptyIndex === -1) return; // full, max 4 reached
    numberSlotState[emptyIndex] = digitIndex;
    renderNumberSlots();
  }

  function clearNumberSlotsFrom(index) {
    for (let i = index; i < numberSlotState.length; i++) {
      numberSlotState[i] = null;
    }
    renderNumberSlots();
    uncollapseNumberSlots();
  }

  // --- Input display sync ---
  const numberInputSlots = Array.from(
    document.querySelectorAll('#numberInputDisplay .input-slot'),
  );

  function renderNumberInputDisplay() {
    numberInputSlots.forEach((el, i) => {
      const state = numberSlotState[i];
      if (state === null) {
        el.innerHTML = '<span class="slot-plus">+</span>';
        el.classList.remove('filled');
      } else {
        const pair = NUMBER_PAIRS[state];
        el.innerHTML =
          `<img class="slot-char-img" src="${pair.ar}" alt="${pair.arLabel}">` +
          `<img class="slot-en-img" src="${pair.en}" alt="${pair.enLabel}">`;
        el.classList.add('filled');
      }
    });
  }

  // Once the admin closes the number overlay, finalize the centered
  // layout the same way the letter keyboard does.
  window._overlay.onClose((type) => {
    if (type === 'number') collapseTrailingEmptyNumberSlots();
  });

  // Wire input display number slots
  numberInputSlots.forEach((el, i) => {
    el.addEventListener('click', () => {
      if (numberSlotState[i] !== null) {
        clearNumberSlotsFrom(i);
        renderNumberInputDisplay();
      } else {
        uncollapseNumberSlots();
        window._overlay.open('number');
      }
    });
  });

  numberKeyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      fillNextNumberSlot(Number(btn.dataset.numberIndex));
      renderNumberInputDisplay();
      if (numberSlotState.every((s) => s !== null)) {
        window._overlay.close();
      }
    });
  });

  numberSlotEls.forEach((el, i) => {
    el.addEventListener('click', () => {
      if (numberSlotState[i] !== null) {
        clearNumberSlotsFrom(i);
        renderNumberInputDisplay();
      }
    });
  });

  renderNumberSlots();
  renderNumberInputDisplay();

  // Expose clear function globally
  window._clearNumberSlots = function () {
    clearNumberSlotsFrom(0);
    renderNumberSlots();
    renderNumberInputDisplay();
  };
})();

(function () {
  // ===== Filter bar logic =====
  const filterBtns = document.querySelectorAll('.filter-btn');
  const plateOptions = document.querySelectorAll('.plate-option');

  // Categories already set by selector script via PLATE_CATEGORIES
  // Fallback only for any opt that somehow has no category
  plateOptions.forEach((opt) => {
    if (!opt.dataset.category) opt.dataset.category = 'sport';
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      plateOptions.forEach((opt) => {
        const match = filter === 'all' || opt.dataset.category === filter;
        opt.style.display = match ? '' : 'none';
      });
    });
  });
})();

