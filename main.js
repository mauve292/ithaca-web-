import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let closeMobileNav = null;

/** Anime.js compatibility wrapper:
 * - Anime v4 (UMD): window.anime is an object with .animate(), .stagger(), etc.
 * - Anime v3: window.anime is a function (call anime({targets,...}))
 */
const A = window.anime;
const isV3 = typeof A === "function";
const stagger = A ? (isV3 ? A.stagger : A.stagger) : null;

function anim(targets, props) {
  if (!A) return null;

  const p = { ...props };

  // Normalize easing naming
  if (isV3) {
    if (p.ease && !p.easing) p.easing = p.ease;
    delete p.ease;
    return A({ targets, ...p });
  }

  // v4 uses "ease"
  if (p.easing && !p.ease) p.ease = p.easing;
  delete p.easing;

  return A.animate(targets, p);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function supportsHoverFinePointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function isSmallScreen() {
  return window.matchMedia("(max-width: 720px)").matches;
}

/* ---------------------------
   Three.js background (subtle, matte, adaptive)
--------------------------- */
function initBackground() {
  const canvas = $("#bg");
  if (!canvas) return;
  if (prefersReducedMotion()) return;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    80
  );
  camera.position.set(0, 0, 7);

  const group = new THREE.Group();
  scene.add(group);

  const ico = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.15, 2),
    new THREE.MeshBasicMaterial({
      color: 0x2c5d73,
      wireframe: true,
      transparent: true,
      opacity: isSmallScreen() ? 0.16 : 0.22,
    })
  );
  group.add(ico);

  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.25, 0.38, 160, 16),
    new THREE.MeshBasicMaterial({
      color: 0x3b7f73,
      wireframe: true,
      transparent: true,
      opacity: isSmallScreen() ? 0.06 : 0.09,
    })
  );
  group.add(knot);

  // Particles (reduced on small screens)
  const ptsCount = isSmallScreen() ? 480 : 900;
  const positions = new Float32Array(ptsCount * 3);
  for (let i = 0; i < ptsCount; i++) {
    const r = 7 * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(
    ptsGeo,
    new THREE.PointsMaterial({
      color: 0x2c5d73,
      size: isSmallScreen() ? 0.018 : 0.02,
      transparent: true,
      opacity: isSmallScreen() ? 0.22 : 0.35,
      depthWrite: false,
    })
  );
  scene.add(pts);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  const state = { mx: 0, my: 0, sy: 0 };
  window.addEventListener(
    "pointermove",
    (e) => {
      state.mx = (e.clientX / window.innerWidth - 0.5) * 2;
      state.my = (e.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true }
  );
  window.addEventListener(
    "scroll",
    () => {
      state.sy = window.scrollY || 0;
    },
    { passive: true }
  );

  const clock = new THREE.Clock();

  function tick() {
    const t = clock.getElapsedTime();

    // Calm motion; slightly reactive to scroll + pointer
    group.position.x = state.mx * 0.35;
    group.position.y = -state.my * 0.22;

    ico.rotation.x = t * 0.12 + state.sy * 0.00025;
    ico.rotation.y = t * 0.16 + state.mx * 0.25;

    knot.rotation.x = -t * 0.08;
    knot.rotation.y = t * 0.06 + state.my * 0.2;

    pts.rotation.y = t * 0.02;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  tick();
}

/* ---------------------------
   Hero split (accessible)
--------------------------- */
function splitHeadline() {
  const el = $("[data-split]");
  if (!el) return;

  const text = ((el.getAttribute("data-split-text") || el.textContent || "").trim());
  if (!text) return;

  // Keep a stable source for re-splitting (e.g., after language switching)
  el.setAttribute("data-split-text", text);
  el.setAttribute("aria-label", text);

  const words = text.split(/\s+/);

  // Screen-reader only fallback
  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = text;

  // Visual split
  const wrap = document.createElement("span");
  wrap.className = "split-wrap";
  wrap.setAttribute("aria-hidden", "true");

  wrap.innerHTML = words
    .map((w) => `<span class="w"><span class="wi">${w}</span></span>`)
    .join(" ");

  el.innerHTML = "";
  el.appendChild(sr);
  el.appendChild(wrap);
}


/* ---------------------------
   I18N (EN / EL)
--------------------------- */
const LANG_STORAGE_KEY = "ithaca_lang";

function normalizeLang(lang) {
  return lang === "el" ? "el" : "en";
}

function applyLang(lang) {
  const l = normalizeLang(lang);
  const isEl = l === "el";

  document.documentElement.setAttribute("lang", isEl ? "el" : "en");

  // Title + description (keep them aligned with the copy in the HTML)
  const titleEn = "Ithaca Agency — Vision & Function";
  const titleEl = "Ithaca Agency — Όραμα & Λειτουργία";
  document.title = isEl ? titleEl : titleEn;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute(
      "content",
      isEl
        ? "Η Ithaca Agency ειδικεύεται σε αυτοματισμούς κάθε μορφής και στο software. Σχεδιάζουμε και υλοποιούμε συστήματα που βοηθούν τις επιχειρήσεις να λειτουργούν πιο έξυπνα, πιο αποδοτικά και με λιγότερη τριβή."
        : "Ithaca Agency specializes in automation and software. We design and build systems that help businesses operate smarter, more efficiently, and with less friction."
    );
  }

  // Text nodes
  $$('[data-i18n-en][data-i18n-el]').forEach((node) => {
    const value = isEl ? node.getAttribute('data-i18n-el') : node.getAttribute('data-i18n-en');
    if (value == null) return;

    // Special handling for split headlines
    if (node.hasAttribute('data-split')) {
      node.setAttribute('data-split-text', value);
      node.textContent = value;
      return;
    }

    node.textContent = value;
  });

  // Placeholders
  $$('[data-i18n-placeholder-en][data-i18n-placeholder-el]').forEach((node) => {
    const value = isEl
      ? node.getAttribute('data-i18n-placeholder-el')
      : node.getAttribute('data-i18n-placeholder-en');
    if (value == null) return;
    node.setAttribute('placeholder', value);
  });

  // Toggle state
  $$('[data-lang]').forEach((btn) => {
    const isActive = normalizeLang(btn.getAttribute('data-lang')) === l;
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function setLang(lang) {
  const l = normalizeLang(lang);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, l);
  } catch (_) {}

  applyLang(l);
  // Rebuild split headline after replacing text
  splitHeadline();
}

function initI18n() {
  const btns = $$('[data-lang]');
  if (!btns.length) return;

  let lang = null;
  try {
    lang = localStorage.getItem(LANG_STORAGE_KEY);
  } catch (_) {}

  if (!lang) {
    const n = (navigator.language || '').toLowerCase();
    lang = n.startsWith('el') ? 'el' : 'en';
  }

  applyLang(lang);

  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.getAttribute('data-lang'));
      // If a language click happens inside the mobile menu, close it.
      if (typeof closeMobileNav === 'function') closeMobileNav();
    });
  });
}

/* ---------------------------
   Scroll reveals (unique per block, repeatable)
   - Animate IN when entering view
   - When fully out of view, reset invisibly so it can replay
--------------------------- */
function initRevealsUniqueLoop() {
  const items = $$("[data-reveal]");
  if (!items.length) return;

  // Always ensure we never carry a blur filter on content
  items.forEach((el) => (el.style.filter = "none"));

  if (prefersReducedMotion()) {
    items.forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.clipPath = "none";
      el.style.filter = "none";
    });
    return;
  }

  const STATES = new WeakMap();

  function localIndex(el, containerSel) {
    const c = el.closest(containerSel);
    if (!c) return null;
    const nodes = Array.from(c.querySelectorAll("[data-reveal]"));
    return nodes.indexOf(el);
  }

  function pickVariant(el, idx) {
    const explicit = el.getAttribute("data-reveal-style");
    if (explicit) return explicit;

    if (el.classList.contains("section-head") || el.tagName === "HEADER") return "wipe-up";
    if (el.classList.contains("hero-panel")) return "slide-left-soft";
    if (el.classList.contains("metrics")) return "scale-in";

    const ci = localIndex(el, ".cards-grid");
    if (ci != null) return ["slide-up", "slide-left", "slide-right", "scale-in"][ci % 4];

    const wi = localIndex(el, ".work-grid");
    if (wi != null) return ["slide-left-soft", "scale-in", "slide-right-soft"][wi % 3];

    const si = localIndex(el, ".steps");
    if (si != null) return ["slide-up", "slide-left-soft", "slide-right-soft", "scale-in"][si % 4];

    return ["slide-up-soft", "slide-left-soft", "slide-right-soft", "scale-in", "tilt-in"][idx % 5];
  }

  function configFor(v) {
    switch (v) {
      case "slide-up":
        return { x: 0, y: 26, s: 1, r: 0, dur: 760 };
      case "slide-up-soft":
        return { x: 0, y: 16, s: 1, r: 0, dur: 720 };
      case "slide-left":
        return { x: -34, y: 0, s: 1, r: 0, dur: 760 };
      case "slide-left-soft":
        return { x: -18, y: 0, s: 1, r: 0, dur: 720 };
      case "slide-right":
        return { x: 34, y: 0, s: 1, r: 0, dur: 760 };
      case "slide-right-soft":
        return { x: 18, y: 0, s: 1, r: 0, dur: 720 };
      case "scale-in":
        return { x: 0, y: 10, s: 0.965, r: 0, dur: 820 };
      case "tilt-in":
        return { x: 0, y: 14, s: 0.985, r: -1.0, dur: 820 };
      case "wipe-up":
        return { x: 0, y: 10, s: 1, r: 0, dur: 780, clip: true };
      default:
        return { x: 0, y: 16, s: 1, r: 0, dur: 720 };
    }
  }

  function cancelAnim(st) {
    if (!st || !st.anim) return;
    try {
      if (typeof st.anim.pause === "function") st.anim.pause();
      if (typeof st.anim.cancel === "function") st.anim.cancel();
    } catch {}
    st.anim = null;
  }

  function prepare(el, conf) {
    el.style.opacity = "0";
    el.style.filter = "none";
    el.style.transform = `translate3d(${conf.x}px, ${conf.y}px, 0) scale(${conf.s}) rotate(${conf.r}deg)`;

    if (conf.clip) {
      el.style.clipPath = "inset(0 0 100% 0)";
      el.style.willChange = "opacity, transform, clip-path";
    } else {
      el.style.clipPath = "none";
      el.style.willChange = "opacity, transform";
    }
  }

  function delayFor(el) {
    const ci = localIndex(el, ".cards-grid");
    if (ci != null) return ci * 80;
    const wi = localIndex(el, ".work-grid");
    if (wi != null) return wi * 90;
    const si = localIndex(el, ".steps");
    if (si != null) return si * 70;
    return 0;
  }

  function reveal(el, st) {
    const conf = st.conf;
    const d = delayFor(el);

    cancelAnim(st);

    const base = {
      opacity: [0, 1],
      translateX: [conf.x, 0],
      translateY: [conf.y, 0],
      scale: [conf.s, 1],
      rotate: [conf.r, 0],
      duration: conf.dur,
      delay: d,
      ease: "out(3)",
      complete: () => {
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.clipPath = "none";
        el.style.filter = "none";
        el.style.willChange = "auto";
      },
    };

    if (conf.clip) {
      base.clipPath = ["inset(0 0 100% 0)", "inset(0 0 0% 0)"];
    }

    st.anim = anim(el, base);
  }

  items.forEach((el, idx) => {
    const conf = configFor(pickVariant(el, idx));
    const st = { conf, visible: false, anim: null };
    STATES.set(el, st);
    prepare(el, conf);
  });

  // Let intro handle hero text; keep hero elements visible immediately.
  const hero = document.querySelector(".hero");
  if (hero) {
    hero.querySelectorAll("[data-reveal]").forEach((el) => {
      el.dataset.revealLock = "true";
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.clipPath = "none";
      el.style.filter = "none";
      el.style.willChange = "auto";
    });
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        const el = en.target;
        const st = STATES.get(el);
        if (!st) return;
        if (el.dataset.revealLock === "true") return;

        const ratio = en.intersectionRatio || 0;
        const wantShow = en.isIntersecting && ratio > 0.18;

        if (wantShow && !st.visible) {
          st.visible = true;
          reveal(el, st);
          return;
        }

        // When fully out of view, reset invisibly so it can animate again next time
        if (!en.isIntersecting && st.visible) {
          st.visible = false;
          cancelAnim(st);
          prepare(el, st.conf);
        }
      });
    },
    {
      threshold: [0, 0.12, 0.18, 0.28],
      rootMargin: "0px 0px 0px 0px",
    }
  );

  items.forEach((el) => {
    if (el.dataset.revealLock === "true") return;
    io.observe(el);
  });
}

function initCounters() {
  const counters = $$("[data-count]");
  if (!counters.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);

        const el = en.target;
        const to = Number(el.getAttribute("data-count") || "0");

        const obj = { v: 0 };
        anim(obj, {
          v: to,
          duration: 1100,
          ease: "out(3)",
          round: 1,
          update: () => {
            el.textContent = String(obj.v);
          },
        });
      });
    },
    { threshold: 0.6 }
  );

  counters.forEach((el) => io.observe(el));
}

/* ---------------------------
   Tilt + magnetic CTA (desktop only)
--------------------------- */
function initTilt() {
  const cards = $$(".tilt");
  if (!cards.length) return;

  if (prefersReducedMotion()) return;
  if (!supportsHoverFinePointer()) return;

  const strength = 9;

  cards.forEach((card) => {
    let raf = 0;

    function onMove(e) {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;

      const rx = (0.5 - py) * strength;
      const ry = (px - 0.5) * strength;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-1px)`;
      });
    }

    function onLeave() {
      cancelAnimationFrame(raf);
      card.style.transform = "none";
    }

    card.addEventListener("pointermove", onMove, { passive: true });
    card.addEventListener("pointerleave", onLeave, { passive: true });
  });
}

function initMagneticButtons() {
  const btns = $$(".btn-magnetic");
  if (!btns.length) return;

  if (prefersReducedMotion()) return;
  if (!supportsHoverFinePointer()) return;

  btns.forEach((btn) => {
    let raf = 0;

    btn.addEventListener(
      "pointermove",
      (e) => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;

        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          btn.style.transform = `translate(${dx * 10}px, ${dy * 10}px)`;
        });
      },
      { passive: true }
    );

    btn.addEventListener(
      "pointerleave",
      () => {
        btn.style.transform = "translate(0, 0)";
      },
      { passive: true }
    );
  });
}

/* ---------------------------
   Intro choreography
--------------------------- */
function intro() {
  if (!A || prefersReducedMotion()) return;

  anim(".site-header .brand", {
    opacity: [0, 1],
    translateY: [-8, 0],
    duration: 700,
    ease: "out(3)",
  });

  anim(".site-header .header-cta .btn", {
    opacity: [0, 1],
    translateY: [-8, 0],
    duration: 700,
    delay: stagger ? stagger(90, { start: 120 }) : 120,
    ease: "out(3)",
  });

  anim(".hero-title .wi", {
    translateY: ["110%", "0%"],
    opacity: [0, 1],
    duration: 900,
    delay: stagger ? stagger(40, { start: 140 }) : 140,
    ease: "out(3)",
  });
}

function wireNavSmoothScroll() {
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
      history.replaceState(null, "", id);

      if (
        (a.dataset.mobileLink === "true" || document.body.classList.contains("nav-open")) &&
        typeof closeMobileNav === "function"
      ) {
        closeMobileNav();
      }
    });
  });
}

function setYear() {
  const y = $("#year");
  if (y) y.textContent = String(new Date().getFullYear());
}

/* Utility: screen-reader only */
function injectSrOnlyCSS() {
  const style = document.createElement("style");
  style.textContent = `
    .sr-only{
      position:absolute !important;
      width:1px !important;
      height:1px !important;
      padding:0 !important;
      margin:-1px !important;
      overflow:hidden !important;
      clip:rect(0,0,0,0) !important;
      white-space:nowrap !important;
      border:0 !important;
    }
    .split-wrap .w{ display:inline-block; overflow:hidden; vertical-align:bottom; }
    .split-wrap .wi{ display:inline-block; will-change: transform; }
  `;
  document.head.appendChild(style);
}

/* ---------------------------
   Mobile / Tablet off-canvas nav
--------------------------- */
function initMobileNav() {
  const toggle = $(".nav-toggle");
  const root = $("#mobileNav");
  if (!toggle || !root) return;

  const panel = $(".mobile-nav__panel", root);
  const backdrop = $(".mobile-nav__backdrop", root);
  const closeBtn = $(".nav-close", root);

  // mark menu links so smooth-scroll can close the menu
  $$('a[href^="#"]', root).forEach((a) => (a.dataset.mobileLink = "true"));

  let isOpen = false;
  let lastFocus = null;

  function setExpanded(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;

    root.removeAttribute("hidden");
    document.body.classList.add("nav-open");
    setExpanded(true);

    // Initial state
    if (backdrop) backdrop.style.opacity = "0";
    if (panel) {
      panel.style.opacity = "0";
      panel.style.transform = "translate3d(110%,0,0)";
    }

    if (A) {
      anim(backdrop, { opacity: [0, 1], duration: 220, ease: "out(2)" });
      anim(panel, { opacity: [0, 1], translateX: ["110%", "0%"], duration: 420, ease: "out(3)" });
    } else {
      if (backdrop) backdrop.style.opacity = "1";
      if (panel) {
        panel.style.opacity = "1";
        panel.style.transform = "translate3d(0,0,0)";
      }
    }

    const firstLink = root.querySelector(".mobile-nav__links a");
    if (firstLink) firstLink.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    document.body.classList.remove("nav-open");
    setExpanded(false);

    const finish = () => {
      root.setAttribute("hidden", "");
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
      lastFocus = null;
    };

    if (A) {
      anim(backdrop, { opacity: [1, 0], duration: 160, ease: "out(2)" });
      anim(panel, {
        opacity: [1, 0],
        translateX: ["0%", "110%"],
        duration: 230,
        ease: "out(3)",
        complete: finish,
      });
    } else {
      finish();
    }
  }

  closeMobileNav = close;

  toggle.addEventListener("click", () => (isOpen ? close() : open()));
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (backdrop) backdrop.addEventListener("click", close);

  window.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") close();
  });

  // If viewport becomes desktop again, ensure menu closes
  window.addEventListener(
    "resize",
    () => {
      if (window.innerWidth > 980 && isOpen) close();
    },
    { passive: true }
  );
}

/* ---------------------------
   Boot
--------------------------- */
setYear();
injectSrOnlyCSS();
initI18n();
splitHeadline();
initBackground();
initRevealsUniqueLoop();
initCounters();
initTilt();
initMagneticButtons();
initMobileNav();
wireNavSmoothScroll();

window.addEventListener("load", () => {
  intro();
});
