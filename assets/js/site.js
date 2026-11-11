(function () {
  "use strict";

  var nav = document.getElementById("nav");
  var progress = document.getElementById("scrollProgress");
  var progressBar = progress ? progress.querySelector("i") : null;
  var toTop = document.getElementById("toTop");

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (nav) nav.classList.toggle("is-scrolled", y > 24);
    if (progressBar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      progressBar.style.transform = "scaleX(" + ratio + ")";
    }
    if (toTop) toTop.classList.toggle("is-visible", y > 620);
  }

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- favorites (localStorage) ---------- */
  var FAV_KEY = "cnfish:favs";
  function readFavs() {
    try {
      var arr = JSON.parse(window.localStorage.getItem(FAV_KEY));
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function writeFavs(arr) {
    try { window.localStorage.setItem(FAV_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  var favs = readFavs();

  function syncFavButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-fav]"), function (btn) {
      var on = favs.indexOf(btn.getAttribute("data-fav")) !== -1;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
      if (btn.classList.contains("detail-fav")) {
        var label = btn.querySelector("span");
        if (label) label.textContent = on ? "已收藏" : (btn.getAttribute("data-fav-label") || "收藏");
      }
    });
    var count = document.getElementById("favCount");
    if (count) count.textContent = String(favs.length);
  }

  function toggleFav(slug) {
    var i = favs.indexOf(slug);
    if (i === -1) favs.push(slug);
    else favs.splice(i, 1);
    writeFavs(favs);
    syncFavButtons();
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("[data-fav]") : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    toggleFav(btn.getAttribute("data-fav"));
    if (grid && state.fav) resetPage();
  });

  syncFavButtons();

  /* ---------- atlas ---------- */
  var grid = document.getElementById("grid");
  if (grid) {

  var cards = Array.prototype.slice.call(grid.querySelectorAll(".card"));
  var chips = Array.prototype.slice.call(document.querySelectorAll("#regionFilters .chip"));
  var search = document.getElementById("atlasSearch");
  var family = document.getElementById("familySelect");
  var habitat = document.getElementById("habitatSelect");
  var sort = document.getElementById("sortSelect");
  var onlyProtected = document.getElementById("onlyProtected");
  var onlyEndemic = document.getElementById("onlyEndemic");
  var onlyRecent = document.getElementById("onlyRecent");
  var onlyFav = document.getElementById("onlyFav");
  var countEl = document.getElementById("atlasCount");
  var emptyEl = document.getElementById("emptyState");
  var resetEl = document.getElementById("resetFilters");
  var loadBtn = document.getElementById("loadMore");
  var visibleEl = document.getElementById("visibleCount");
  var randomBtn = document.getElementById("randomSpecies");
  var PAGE = 28;
  var state = {
    q: "", region: "all", family: "all", habitat: "all",
    prot: false, end: false, recent: false, fav: false,
    sort: "default", limit: PAGE
  };
  var matched = cards.slice();

  function matchCard(card) {
    if (state.region !== "all" && (" " + card.getAttribute("data-region") + " ").indexOf(" " + state.region + " ") === -1) return false;
    if (state.family !== "all" && card.getAttribute("data-family") !== state.family) return false;
    if (state.habitat !== "all" && card.getAttribute("data-habitat") !== state.habitat) return false;
    if (state.prot && card.getAttribute("data-protected") !== "1") return false;
    if (state.end && card.getAttribute("data-endemic") !== "1") return false;
    if (state.recent && card.getAttribute("data-recent") !== "1") return false;
    if (state.fav && favs.indexOf(card.getAttribute("data-slug")) === -1) return false;
    if (state.q) {
      var hay = (card.getAttribute("data-search") || "").toLowerCase();
      var words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) {
        if (hay.indexOf(words[i]) === -1) return false;
      }
    }
    return true;
  }

  function num(card, attr) {
    return parseFloat(card.getAttribute(attr)) || 0;
  }

  function sortMatched(list) {
    if (state.sort === "default") return list;
    return list.slice().sort(function (a, b) {
      if (state.sort === "name") {
        return (a.getAttribute("data-name") || "").localeCompare(b.getAttribute("data-name") || "", "zh-Hans-CN");
      }
      if (state.sort === "length-desc") return num(b, "data-cm") - num(a, "data-cm");
      if (state.sort === "length-asc") return num(a, "data-cm") - num(b, "data-cm");
      if (state.sort === "year-desc") return num(b, "data-year") - num(a, "data-year");
      if (state.sort === "year-asc") return num(a, "data-year") - num(b, "data-year");
      return 0;
    });
  }

  function render() {
    matched = sortMatched(cards.filter(matchCard));
    cards.forEach(function (card) { card.hidden = true; });
    var matchedSet = new Set(matched);
    var frag = document.createDocumentFragment();
    cards.forEach(function (card) { if (!matchedSet.has(card)) frag.appendChild(card); });
    matched.forEach(function (card) { frag.appendChild(card); });
    grid.appendChild(frag);

    var shown = 0;
    for (var i = 0; i < matched.length && i < state.limit; i++) {
      matched[i].hidden = false;
      shown += 1;
    }
    if (countEl) countEl.textContent = String(matched.length);
    if (emptyEl) emptyEl.hidden = matched.length !== 0;
    if (loadBtn) loadBtn.hidden = shown >= matched.length;
    if (visibleEl) visibleEl.textContent = matched.length ? "显示 " + shown + " / " + matched.length + " 种" : "";
  }

  function resetPage() {
    state.limit = PAGE;
    render();
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      state.region = chip.getAttribute("data-filter");
      chips.forEach(function (c) {
        var active = c === chip;
        c.classList.toggle("is-active", active);
        c.setAttribute("aria-pressed", String(active));
      });
      resetPage();
    });
  });

  if (search) {
    var timer = null;
    search.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = search.value.trim();
        resetPage();
      }, 120);
    });
  }

  if (family) {
    family.addEventListener("change", function () {
      state.family = family.value;
      resetPage();
    });
  }

  if (habitat) {
    habitat.addEventListener("change", function () {
      state.habitat = habitat.value;
      resetPage();
    });
  }

  if (sort) {
    sort.addEventListener("change", function () {
      state.sort = sort.value;
      resetPage();
    });
  }

  if (onlyProtected) {
    onlyProtected.addEventListener("change", function () {
      state.prot = onlyProtected.checked;
      resetPage();
    });
  }

  if (onlyEndemic) {
    onlyEndemic.addEventListener("change", function () {
      state.end = onlyEndemic.checked;
      resetPage();
    });
  }

  if (onlyRecent) {
    onlyRecent.addEventListener("change", function () {
      state.recent = onlyRecent.checked;
      resetPage();
    });
  }

  if (onlyFav) {
    onlyFav.addEventListener("change", function () {
      state.fav = onlyFav.checked;
      resetPage();
    });
  }

  if (loadBtn) {
    loadBtn.addEventListener("click", function () {
      state.limit += PAGE;
      render();
    });
  }

  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      var pool = cards.filter(matchCard);
      if (!pool.length) pool = cards;
      var pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) window.location.href = "species/" + pick.getAttribute("data-slug") + ".html";
    });
  }

  if (resetEl) {
    resetEl.addEventListener("click", function () {
      state.q = "";
      state.region = "all";
      state.family = "all";
      state.habitat = "all";
      state.prot = false;
      state.end = false;
      state.recent = false;
      state.fav = false;
      state.sort = "default";
      if (search) search.value = "";
      if (family) family.value = "all";
      if (habitat) habitat.value = "all";
      if (sort) sort.value = "default";
      if (onlyProtected) onlyProtected.checked = false;
      if (onlyEndemic) onlyEndemic.checked = false;
      if (onlyRecent) onlyRecent.checked = false;
      if (onlyFav) onlyFav.checked = false;
      chips.forEach(function (c) {
        var active = c.getAttribute("data-filter") === "all";
        c.classList.toggle("is-active", active);
        c.setAttribute("aria-pressed", String(active));
      });
      resetPage();
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll(".taxon"), function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-family");
      if (family) family.value = name;
      state.family = name;
      resetPage();
      var atlas = document.getElementById("atlas");
      if (atlas) atlas.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".habitat-card"), function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-habitat");
      if (habitat) habitat.value = key;
      state.habitat = key;
      resetPage();
      var atlas = document.getElementById("atlas");
      if (atlas) atlas.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  render();

  /* ---------- keyboard shortcuts ---------- */
  document.addEventListener("keydown", function (e) {
    var tag = document.activeElement ? document.activeElement.tagName : "";
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
      if (search) {
        e.preventDefault();
        search.focus();
        search.select();
      }
    }
    if (e.key === "Escape" && document.activeElement === search && search.value) {
      search.value = "";
      state.q = "";
      resetPage();
    }
  });
  }

  /* ---------- lightbox ---------- */
  var lightbox = document.getElementById("lightbox");
  if (!lightbox) return;

  var lbImg = lightbox.querySelector("img");
  var lbCap = lightbox.querySelector(".lightbox-cap");
  var lbClose = lightbox.querySelector(".lightbox-close");
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".shot-btn"));
  var lastFocus = null;
  var current = -1;

  function paint(btn) {
    var credit = btn.getAttribute("data-credit") || "";
    lbImg.src = btn.getAttribute("data-full");
    lbImg.alt = btn.querySelector("img") ? btn.querySelector("img").alt : "";
    lbCap.textContent = (btn.getAttribute("data-cap") || "") + (credit ? " · 摄影：" + credit : "");
  }

  function openLightbox(btn) {
    lastFocus = btn;
    current = buttons.indexOf(btn);
    paint(btn);
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    if (lbClose) lbClose.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lbImg.removeAttribute("src");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  function step(dir) {
    if (current === -1 || !buttons.length) return;
    current = (current + dir + buttons.length) % buttons.length;
    paint(buttons[current]);
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () { openLightbox(btn); });
  });

  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox || e.target === lbImg) closeLightbox();
  });

  if (lbClose) {
    lbClose.addEventListener("click", function (e) {
      e.stopPropagation();
      closeLightbox();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });
})();
