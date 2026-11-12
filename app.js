const form = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const searchButton = form.querySelector("button");
const fileInput = document.querySelector("#audio-file");
const fileStatus = document.querySelector("#file-status");
const uploadRow = document.querySelector(".upload-row");
const resultsSection = document.querySelector("#results-section");
const resultsGrid = document.querySelector("#results-grid");
const resultsCount = document.querySelector("#results-count");
const searchStatus = document.querySelector("#search-status");

let activeSearch;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchTracks(searchInput.value);
});

fileInput.addEventListener("change", () => {
  const [file] = fileInput.files;
  if (file) searchFile(file);
  fileInput.value = "";
});

for (const eventName of ["dragenter", "dragover"]) {
  uploadRow.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadRow.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  uploadRow.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadRow.classList.remove("is-dragging");
  });
}

uploadRow.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (file) searchFile(file);
});

async function searchFile(file) {
  const fallbackQuery = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const tags = await readTags(file);
  const title = cleanTag(tags.title);
  const artist = cleanTag(tags.artist);

  if (title || artist) {
    const query = [artist, title].filter(Boolean).join(" ");
    fileStatus.textContent = `using ${artist && title ? "artist and title" : artist ? "artist" : "title"} from the file tags`;
    searchTracks(query);
  } else if (fallbackQuery) {
    fileStatus.textContent = tags.error
      ? "couldn’t read file tags; searching its filename instead"
      : "no title or artist tags found; searching the filename instead";
    searchTracks(fallbackQuery);
  } else {
    fileStatus.textContent = "couldn’t find a title in the tags or filename.";
  }
}

function readTags(file) {
  return new Promise((resolve) => {
    const reader = window.jsmediatags;
    if (!reader || typeof reader.read !== "function") {
      resolve({ error: true });
      return;
    }

    reader.read(file, {
      onSuccess: ({ tags = {} }) => resolve({ title: tags.title, artist: tags.artist }),
      onError: () => resolve({ error: true })
    });
  });
}

function cleanTag(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function searchTracks(rawQuery) {
  const query = rawQuery.trim();
  if (!query) return;

  if (activeSearch) activeSearch.abort();
  const controller = new AbortController();
  activeSearch = controller;

  searchInput.value = query;
  resultsSection.hidden = false;
  resultsGrid.replaceChildren();
  resultsCount.textContent = "";
  searchStatus.textContent = `looking for “${query}”…`;
  searchButton.disabled = true;
  searchButton.querySelector("span").textContent = "searching";

  try {
    const params = new URLSearchParams({ term: query, entity: "song", media: "music", limit: "18" });
    const response = await fetch(`https://itunes.apple.com/search?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error("catalog request failed");
    const data = await response.json();
    if (controller.signal.aborted) return;

    const tracks = Array.isArray(data.results) ? data.results : [];
    resultsCount.textContent = `${tracks.length} ${tracks.length === 1 ? "match" : "matches"}`;
    if (tracks.length) {
      searchStatus.textContent = "press play for a little preview.";
      const fragment = document.createDocumentFragment();
      tracks.forEach((track) => fragment.append(makeTrackCard(track)));
      resultsGrid.replaceChildren(fragment);
    } else {
      searchStatus.textContent = "";
      showEmpty("no matches this time. try another title or artist.");
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    searchStatus.textContent = "";
    showEmpty("the music catalog couldn’t be reached. check your connection and try again.");
  } finally {
    if (activeSearch === controller) {
      activeSearch = null;
      searchButton.disabled = false;
      searchButton.querySelector("span").textContent = "search";
    }
  }
}

function makeTrackCard(track) {
  const card = document.createElement("article");
  card.className = "track-card";
  const artworkWrap = document.createElement("div");
  artworkWrap.className = "artwork-wrap";
  if (track.artworkUrl100) {
    const artwork = document.createElement("img");
    artwork.className = "artwork";
    artwork.src = track.artworkUrl100.replace("100x100bb", "400x400bb");
    artwork.alt = "";
    artwork.loading = "lazy";
    artworkWrap.append(artwork);
  } else {
    artworkWrap.append(makeArtworkPlaceholder());
  }

  const info = document.createElement("div");
  info.className = "track-info";
  const title = document.createElement("p");
  title.className = "track-title";
  title.textContent = track.trackName || "untitled track";
  title.title = title.textContent;
  const artist = document.createElement("p");
  artist.className = "track-artist";
  artist.textContent = track.artistName || "unknown artist";
  artist.title = artist.textContent;
  info.append(title, artist);

  if (track.previewUrl) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    audio.src = track.previewUrl;
    audio.setAttribute("aria-label", `preview ${title.textContent} by ${artist.textContent}`);
    audio.addEventListener("play", () => {
      document.querySelectorAll(".track-card audio").forEach((otherAudio) => {
        if (otherAudio !== audio) otherAudio.pause();
      });
    });
    info.append(audio);
  } else {
    const unavailable = document.createElement("p");
    unavailable.className = "no-preview";
    unavailable.textContent = "preview unavailable";
    info.append(unavailable);
  }

  card.append(artworkWrap, info);
  return card;
}

function makeArtworkPlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "artwork-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  const note = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  note.setAttribute("viewBox", "0 0 24 24");
  note.innerHTML = '<path d="M9 18V5l11-2v13" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="17" cy="16" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/>';
  placeholder.append(note);
  return placeholder;
}

function showEmpty(message) {
  resultsCount.textContent = "";
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  resultsGrid.replaceChildren(empty);
}
