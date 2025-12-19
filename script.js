// Simple DOM helpers
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Audio element and state
const currentSong = new Audio();
let songs = [];
let manifestData = null;

const formatTime = (seconds) =>
  isNaN(seconds)
    ? "00:00"
    : `${~~(seconds / 60)}`.padStart(2, "0") +
      ":" +
      `${~~(seconds % 60)}`.padStart(2, "0");

// Load the generated manifest (requires HTTP server)
const loadManifest = async () => {
  if (manifestData) return manifestData;
  try {
    const res = await fetch("songs/manifest.json");
    manifestData = await res.json();
  } catch (err) {
    console.error("Failed to load songs/manifest.json:", err);
    manifestData = {};
  }
  return manifestData;
};

// Play a track by the filename without extension
const playMusic = (trackName) => {
  const songUrl = songs.find(
    (s) => s.split("/").pop().replace(".mp3", "") === trackName
  );
  if (!songUrl) return;

  currentSong.src = songUrl;
  currentSong.load();

  const playImg = $("#play");
  if (playImg) playImg.src = "./svg/pause.svg";

  const infoEl = document.querySelector(".songinfo");
  if (infoEl)
    infoEl.innerHTML = `\n    <div class="song-name">${trackName}</div>\n    <div class="artist-name">Playing Now</div>`;

  const timeEl = $(".songtime");
  if (timeEl) timeEl.innerHTML = "00:00 / 00:00";

  $$(".songList li").forEach((li) =>
    li.classList.toggle("playing", li.dataset.file === trackName)
  );

  const promise = currentSong.play();
  if (promise !== undefined)
    promise.catch((e) => {
      console.warn("Playback failed", e);
      if (playImg) playImg.src = "play.svg";
    });
};

const toggleMenu = (open) => {
  const left = $(".left");
  const container = $(".container");
  if (left) left.style.left = open ? "0" : "-320px";
  if (container) container.classList.toggle("menu-open", open);
  document.body.style.overflow = open ? "hidden" : "";
  // show/hide the close button element without adding CSS rules in stylesheet
  try {
    const closeBtn = document.querySelector(".close-menu");
    if (closeBtn) {
      // use inline display control so we don't modify external CSS files
      closeBtn.style.display = open ? "" : "none";
    }
  } catch (e) {
    // ignore if DOM not ready
  }
};

const getCurrentSongIndex = () => {
  const currentSongName = $(".songinfo .song-name")?.textContent;
  if (!currentSongName) return -1;
  return Array.from($$(".songList li")).findIndex(
    (li) => li.dataset.file === currentSongName
  );
};

let currentFolder = "CAR";

const setupSongControls = () => {
  const playImg = $("#play");
  if (playImg) {
    playImg.addEventListener("click", () => {
      if (!currentSong.src) return;
      if (!currentSong.paused) {
        currentSong.pause();
        playImg.src = "./svg/play.svg";
      } else {
        const p = currentSong.play();
        if (p !== undefined) p.catch((e) => console.warn("play failed", e));
        playImg.src = "./svg/pause.svg";
      }
    });
  }

  const prev = $("#previous");
  if (prev)
    prev.addEventListener("click", () => {
      const idx = getCurrentSongIndex();
      if (idx > 0) {
        const prevLi = $$(".songList li")[idx - 1];
        playMusic(prevLi.dataset.file);
      }
    });

  const next = $("#next");
  if (next)
    next.addEventListener("click", () => {
      const idx = getCurrentSongIndex();
      const list = $$(".songList li");
      if (idx >= 0 && idx < list.length - 1) {
        playMusic(list[idx + 1].dataset.file);
      }
    });

  currentSong.addEventListener("ended", () => {
    const idx = getCurrentSongIndex();
    const list = $$(".songList li");
    if (idx >= 0 && idx < list.length - 1) {
      playMusic(list[idx + 1].dataset.file);
    } else {
      const playImg2 = $("#play");
      if (playImg2) playImg2.src = "play.svg";
    }
  });
};

// Volume controls: slider + mute button
const setupVolumeControls = () => {
  const volumeBtn = $("#volume-btn");
  const volumeImg = volumeBtn?.querySelector("img");
  const volumeSlider = $("#volume-slider");

  // load saved volume (0-100) or default 100
  let saved = localStorage.getItem("player-volume");
  let vol = saved !== null ? Number(saved) : 100;
  vol = Math.min(100, Math.max(0, vol));

  const setVolume = (value) => {
    const v = Math.min(100, Math.max(0, Number(value)));
    currentSong.volume = v / 100;
    if (volumeSlider) volumeSlider.value = String(v);
    localStorage.setItem("player-volume", String(v));
    updateVolumeUI(v, currentSong.muted || v === 0);
    // update the visual fill of the slider
    updateSliderFill(v);
  };

  const updateSliderFill = (value) => {
    if (!volumeSlider) return;
    const v = Math.min(100, Math.max(0, Number(value)));
    // create a gradient where the accent color fills up to v% and the track color is the rest
    volumeSlider.style.background = `linear-gradient(90deg, var(--accent, #1DB954) ${v}%, #444 ${v}%)`;
  };

  const updateVolumeUI = (value, muted) => {
    if (!volumeBtn) return;
    volumeBtn.classList.remove(
      "muted",
      "volume-low",
      "volume-med",
      "volume-high"
    );
    if (muted || value === 0) {
      volumeBtn.classList.add("muted");
      if (volumeImg) volumeImg.src = "./svg/mute.svg";
    } else {
      if (value <= 33) volumeBtn.classList.add("volume-low");
      else if (value <= 66) volumeBtn.classList.add("volume-med");
      else volumeBtn.classList.add("volume-high");
      if (volumeImg) volumeImg.src = "./svg/volume.svg";
    }
  };

  // initialize
  setVolume(vol);
  // ensure slider visual matches initial value
  updateSliderFill(vol);

  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      const v = Number(e.target.value);
      currentSong.muted = false;
      setVolume(v);
    });
  }

  if (volumeBtn) {
    volumeBtn.addEventListener("click", () => {
      // toggle mute: if currently muted or vol==0 -> restore to last saved >0 value
      const currentVol = Number(localStorage.getItem("player-volume") || "100");
      if (currentSong.muted || currentSong.volume === 0) {
        currentSong.muted = false;
        const restore = Math.max(1, currentVol);
        setVolume(restore);
      } else {
        currentSong.muted = true;
        updateVolumeUI(0, true);
        if (volumeSlider) volumeSlider.value = "0";
      }
    });
  }
};

const initializePlayer = async (folder = "CAR") => {
  try {
    ["previous", "next"].forEach((btn) => {
      const el = $(`#${btn}`);
      if (el) el.replaceWith(el.cloneNode(true));
    });

    currentFolder = folder;
    await loadManifest();
    const fileList =
      manifestData && Array.isArray(manifestData[folder])
        ? manifestData[folder]
        : [];
    songs = fileList.map((s) => `songs/${folder}/${s}`);

    currentSong.addEventListener("timeupdate", () => {
      const timeEl = $(".songtime");
      if (timeEl)
        timeEl.innerHTML = `${formatTime(
          currentSong.currentTime
        )} / ${formatTime(currentSong.duration)}`;
      if (currentSong.duration) {
        const circle = $(".circle");
        if (circle)
          circle.style.left = `${
            (currentSong.currentTime / currentSong.duration) * 100
          }%`;
      }
    });

    const seek = $(".seekbar");
    if (seek)
      seek.addEventListener("click", (e) => {
        currentSong.currentTime =
          (e.offsetX / e.currentTarget.offsetWidth) * currentSong.duration;
      });

    const hamb = $(".hamburger");
    if (hamb) hamb.addEventListener("click", () => toggleMenu(true));
    const close = $(".close-menu");
    if (close) close.addEventListener("click", () => toggleMenu(false));

    document.addEventListener("click", (e) => {
      if (
        window.innerWidth <= 740 &&
        $(".container")?.classList.contains("menu-open") &&
        !$(".left")?.contains(e.target) &&
        !$(".hamburger")?.contains(e.target)
      )
        toggleMenu(false);
    });

    const songList = $(".songList ul");
    if (songList) {
      if (songs.length === 0) {
        songList.innerHTML = `<li class="no-songs"><div class="info"><div>No songs found</div><div>Add MP3 files to the ${currentFolder} folder</div></div></li>`;
        return;
      }

      songList.innerHTML = songs
        .map((song) => {
          const actualName = song.split("/").pop().replace(".mp3", "");
          let displayName = actualName;
          if (displayName.length > 30)
            displayName = displayName.substring(0, 30) + "...";
          const escaped = actualName.replace(/'/g, "\\'");
          return `<li data-file="${escaped}" onclick="playMusic('${escaped}')"><img class="invert" src="./svg/music.svg" alt="music icon" /><div class="info"><div>${displayName}</div><div>Click to play</div></div><div class="playnow"><span>Play Now</span><img class="invert" src="./svg/play.svg" alt="play icon" /></div></li>`;
        })
        .join("");
    }

    setupSongControls();
  } catch (err) {
    console.error("initializePlayer failed", err);
  }
};

// Auto-init once DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  // Determine an appropriate default folder: prefer the first non-empty folder in the manifest
  await loadManifest();
  let defaultFolder = currentFolder; // fallback to the existing default
  try {
    const keys = Object.keys(manifestData || {});
    console.debug("[player] manifest keys:", keys);
    const firstNonEmpty = keys.find(
      (k) => Array.isArray(manifestData[k]) && manifestData[k].length > 0
    );
    if (firstNonEmpty) defaultFolder = firstNonEmpty;
    else if (keys.length > 0) defaultFolder = keys[0];
  } catch (e) {
    console.warn(
      "Could not determine default folder from manifest, using fallback",
      e
    );
  }

  // Initialize player with chosen default folder
  console.debug("[player] chosen defaultFolder ->", defaultFolder);
  await initializePlayer(defaultFolder);

  // mark the matching playlist card as selected (if present)
  const _cards = $$(".card");
  if (_cards && _cards.length) {
    _cards.forEach((c) =>
      c.classList.toggle("selected", c.dataset.folder === defaultFolder)
    );
  }

  // quick debug info about what initializePlayer produced
  try {
    const leftListCount = $$(".songList li")?.length || 0;
    console.debug("[player] songList items in DOM:", leftListCount);
  } catch (e) {
    // ignore
  }

  // Attach click handlers to playlist cards so clicking a card loads that folder
  const cards = $$(".card");
  cards.forEach((card) => {
    card.addEventListener("click", async () => {
      const folder = card.dataset.folder;
      if (!folder) return;
      // mark selected card (optional visual)
      cards.forEach((c) => c.classList.toggle("selected", c === card));
      await initializePlayer(folder);
    });
  });
  // initialize volume controls (slider + mute button)
  setupVolumeControls();
  // ensure close button has an icon and closes the menu when clicked
  const closeBtn = document.querySelector(".close-menu");
  if (closeBtn && !closeBtn.querySelector("img")) {
    const img = document.createElement("img");
    img.src = "close.svg";
    img.alt = "Close menu";
    img.style.width = "18px";
    img.style.height = "18px";
    closeBtn.appendChild(img);
  }
  // set initial visibility according to whether the left menu appears open
  if (closeBtn) {
    try {
      const leftEl = document.querySelector(".left");
      const container = document.querySelector(".container");
      // consider the menu open if container has the menu-open class or left is positioned at 0
      const menuOpen =
        container?.classList.contains("menu-open") ||
        window.getComputedStyle(leftEl || {}).left === "0px";
      closeBtn.style.display = menuOpen ? "" : "none";
    } catch (e) {
      // fallback: hide the close button
      closeBtn.style.display = "none";
    }
  }
  if (closeBtn) closeBtn.addEventListener("click", () => toggleMenu(false));
});

