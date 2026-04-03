<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import ChordDiagram from '$lib/components/ChordDiagram.svelte';
  import { getChordDiagrams, toDiagramId } from '$lib/chord-diagrams';
  import type { ChordDiagram as ChordDiagramData } from '$lib/chord-diagrams';
  import { extractUniqueChords, transformChordBlock } from '$lib/chord-utils';
  import { downloadSongPdf } from '$lib/pdf-export';
  import type { ArtistData, SearchArtist, SearchPost, SongData } from '$lib/types';

  const MIN_QUERY_LENGTH = 2;
  const MOBILE_BREAKPOINT = 760;
  const ZOOM_STORAGE_KEY_DESKTOP = 'chords4all:zoom-font-size:desktop';
  const ZOOM_STORAGE_KEY_MOBILE = 'chords4all:zoom-font-size:mobile';
  const VISITED_STORAGE_KEY = 'chords4all:visited-songs';
  const MAX_VISITED = 12;

  type VisitedSong = {
    title: string;
    artist: string;
    canonicalUrl: string;
    openedAt: string;
  };

  type VisibleChord = {
    chord: string;
    diagrams: ChordDiagramData[];
  };

  let query = '';
  let songResults: SearchPost[] = [];
  let artistResults: SearchArtist[] = [];
  let selectedSong: SongData | null = null;
  let selectedArtist: ArtistData | null = null;

  let searching = false;
  let loadingSong = false;
  let error = '';

  let semitones = 0;
  let fontSize = 20;
  let fittedFontSize = 20;
  let simplify = false;
  let autoscrollSpeed = 0;
  let hasUserAdjustedZoom = false;
  let visitedSongs: VisitedSong[] = [];
  let hydrationDone = false;
  let isMobileViewport = false;

  let lyricsContainerEl: HTMLElement | null = null;
  let lyricsPreEl: HTMLPreElement | null = null;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let autoscrollTimer: ReturnType<typeof setInterval> | null = null;
  let fitLyricsFrame: number | null = null;
  let resizeHandler: (() => void) | null = null;

  $: renderedSong = selectedSong
    ? transformChordBlock(selectedSong.chordsText, { semitones, simplify })
    : '';

  $: visibleChords = dedupeEquivalentChords(extractUniqueChords(renderedSong)).slice(0, 36);
  $: visibleChordDiagrams = visibleChords.map((chord): VisibleChord => ({
    chord,
    diagrams: getChordDiagrams(chord)
  }));
  $: youtubeId = extractYoutubeId(selectedSong?.youtubeUrl);
  $: youtubeWatchUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : undefined;
  $: youtubeThumbUrl = youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : undefined;
  $: canSearch = query.trim().length >= MIN_QUERY_LENGTH;

  $: if (selectedSong) {
    renderedSong;
    fontSize;
    scheduleLyricsFit();
  }

  $: if (hydrationDone && typeof localStorage !== 'undefined') {
    localStorage.setItem(activeZoomStorageKey(), String(fontSize));
  }

  function activeZoomStorageKey(): string {
    return isMobileViewport ? ZOOM_STORAGE_KEY_MOBILE : ZOOM_STORAGE_KEY_DESKTOP;
  }

  function clampFontSize(value: number): number {
    return Math.max(14, Math.min(40, value));
  }

  function artistName(post: SearchPost): string {
    return post.cats?.[0]?.n ?? 'Artista sconosciuto';
  }

  function normalizeChordKey(chord: string): string {
    const normalized = toDiagramId(chord);
    return normalized ? normalized.toUpperCase() : chord.trim().toUpperCase();
  }

  function dedupeEquivalentChords(chords: string[]): string[] {
    const deduped = new Map<string, string>();

    for (const chord of chords) {
      const key = normalizeChordKey(chord);
      if (!deduped.has(key)) {
        deduped.set(key, chord);
      }
    }

    return [...deduped.values()];
  }

  function setError(message: string): void {
    error = message;
  }

  function clearError(): void {
    error = '';
  }

  function scheduleSearch(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      searchSongs();
    }, 260);
  }

  async function searchSongs(force = false): Promise<void> {
    const term = query.trim();

    if (term.length < MIN_QUERY_LENGTH) {
      songResults = [];
      artistResults = [];
      return;
    }

    if (!force && searching) {
      return;
    }

    searching = true;
    clearError();

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Errore durante la ricerca.');
      }

      songResults = payload.data.posts ?? [];
      artistResults = payload.data.cats ?? [];
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Ricerca non riuscita.');
      songResults = [];
      artistResults = [];
    } finally {
      searching = false;
    }
  }

  async function openSong(url: string): Promise<void> {
    loadingSong = true;
    clearError();
    applyAutoscroll(0);

    try {
      const response = await fetch(`/api/song?url=${encodeURIComponent(url)}`);
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Caricamento brano non riuscito.');
      }

      selectedSong = payload.data as SongData;
      selectedArtist = null;
      songResults = [];
      artistResults = [];
      hasUserAdjustedZoom = false;
      resetTools();
      trackVisitedSong(selectedSong);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Errore sul brano richiesto.');
    } finally {
      loadingSong = false;
    }
  }

  async function openArtist(url: string): Promise<void> {
    loadingSong = true;
    clearError();
    applyAutoscroll(0);

    try {
      const response = await fetch(`/api/artist?url=${encodeURIComponent(url)}`);
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Caricamento artista non riuscito.');
      }

      selectedArtist = payload.data as ArtistData;
      selectedSong = null;
      songResults = [];
      artistResults = [];
      resetTools();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Errore sulla pagina artista.');
    } finally {
      loadingSong = false;
    }
  }

  function resetTools(): void {
    semitones = 0;
    simplify = false;
    applyAutoscroll(0);
  }

  function adjustSemitone(step: number): void {
    semitones = Math.max(-11, Math.min(11, semitones + step));
  }

  function adjustFont(delta: number): void {
    hasUserAdjustedZoom = true;
    fontSize = clampFontSize(fontSize + delta);
  }

  function stepFromSpeed(speed: number): number {
    if (speed === 0.5) return 0.6;
    if (speed === 1) return 1.1;
    if (speed === 1.5) return 1.7;
    return 2.3;
  }

  function applyAutoscroll(speed: number): void {
    autoscrollSpeed = speed;

    if (autoscrollTimer) {
      clearInterval(autoscrollTimer);
      autoscrollTimer = null;
    }

    const step = stepFromSpeed(speed);
    if (speed === 0) {
      return;
    }

    autoscrollTimer = setInterval(() => {
      window.scrollBy(0, step);
    }, 34);
  }

  function extractYoutubeId(url?: string): string | undefined {
    if (!url) {
      return undefined;
    }

    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{8,})/
    );

    return match?.[1];
  }

  function openArtistFromSong(): void {
    if (!selectedSong?.artistUrl) {
      return;
    }

    void openArtist(selectedSong.artistUrl);
  }

  async function fitLyricsToViewport(): Promise<void> {
    if (!selectedSong) {
      return;
    }

    fittedFontSize = fontSize;

    if (hasUserAdjustedZoom) {
      return;
    }

    await tick();

    if (!lyricsContainerEl || !lyricsPreEl) {
      return;
    }

    const availableWidth = Math.max(0, lyricsContainerEl.clientWidth - 2);
    const contentWidth = lyricsPreEl.scrollWidth;

    if (!availableWidth || contentWidth <= availableWidth) {
      return;
    }

    const ratio = availableWidth / contentWidth;
    const adjusted = Math.max(10, Number((fontSize * ratio).toFixed(2)));
    if (adjusted < fittedFontSize) {
      fittedFontSize = adjusted;
    }
  }

  function scheduleLyricsFit(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (fitLyricsFrame) {
      window.cancelAnimationFrame(fitLyricsFrame);
    }

    fitLyricsFrame = window.requestAnimationFrame(() => {
      fitLyricsFrame = null;
      void fitLyricsToViewport();
    });
  }

  function parseVisitedSongs(raw: string): VisitedSong[] {
    try {
      const decoded = JSON.parse(raw);
      if (!Array.isArray(decoded)) {
        return [];
      }

      return decoded
        .filter((item) => item && typeof item.canonicalUrl === 'string')
        .map((item) => ({
          title: String(item.title ?? 'Brano'),
          artist: String(item.artist ?? 'Artista'),
          canonicalUrl: String(item.canonicalUrl),
          openedAt: String(item.openedAt ?? new Date().toISOString())
        }))
        .slice(0, MAX_VISITED);
    } catch {
      return [];
    }
  }

  function persistVisitedSongs(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(VISITED_STORAGE_KEY, JSON.stringify(visitedSongs));
  }

  function trackVisitedSong(song: SongData): void {
    const entry: VisitedSong = {
      title: song.title,
      artist: song.artist,
      canonicalUrl: song.canonicalUrl,
      openedAt: new Date().toISOString()
    };

    visitedSongs = [entry, ...visitedSongs.filter((item) => item.canonicalUrl !== entry.canonicalUrl)].slice(
      0,
      MAX_VISITED
    );

    if (hydrationDone) {
      persistVisitedSongs();
    }
  }

  function clearVisitedSongs(): void {
    visitedSongs = [];
    if (hydrationDone) {
      persistVisitedSongs();
    }
  }

  function downloadPdf(): void {
    if (!selectedSong) {
      return;
    }

    downloadSongPdf({
      title: selectedSong.title,
      artist: selectedSong.artist,
      body: renderedSong,
      semitones,
      simplify,
      fontSize
    });
  }

  onMount(() => {
    if (typeof localStorage === 'undefined') {
      hydrationDone = true;
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    isMobileViewport = mediaQuery.matches;

    const savedZoom = Number(localStorage.getItem(activeZoomStorageKey()));
    if (Number.isFinite(savedZoom)) {
      fontSize = clampFontSize(savedZoom);
    } else {
      fontSize = isMobileViewport ? 14 : 20;
    }

    const savedVisited = localStorage.getItem(VISITED_STORAGE_KEY);
    if (savedVisited) {
      visitedSongs = parseVisitedSongs(savedVisited);
    }

    resizeHandler = () => {
      const mobileNow = mediaQuery.matches;
      if (mobileNow !== isMobileViewport) {
        isMobileViewport = mobileNow;
        const persistedZoom = Number(localStorage.getItem(activeZoomStorageKey()));
        if (Number.isFinite(persistedZoom)) {
          fontSize = clampFontSize(persistedZoom);
        } else {
          fontSize = isMobileViewport ? 14 : 20;
        }
      }

      scheduleLyricsFit();
    };

    window.addEventListener('resize', resizeHandler);

    hydrationDone = true;
    hasUserAdjustedZoom = false;
    scheduleLyricsFit();
  });

  onDestroy(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (autoscrollTimer) {
      clearInterval(autoscrollTimer);
    }

    if (fitLyricsFrame && typeof window !== 'undefined') {
      window.cancelAnimationFrame(fitLyricsFrame);
    }

    if (resizeHandler && typeof window !== 'undefined') {
      window.removeEventListener('resize', resizeHandler);
    }

  });
</script>

<svelte:head>
  <title>Chords4All | Reader</title>
  <meta
    name="description"
    content="Ricerca brani su accordiespartiti.it e leggi accordi/testo con traspositore, semplifica e autoscroll."
  />
</svelte:head>

<main class="app-shell">
  <section class="search-strip">
    <div class="search-head">
      <p class="eyebrow">chords4all</p>
    </div>

    <form
      class="searchbox"
      on:submit|preventDefault={() => {
        searchSongs(true);
      }}
    >
      <input
        type="search"
        bind:value={query}
        on:input={scheduleSearch}
        placeholder="Titolo o artista"
        autocomplete="off"
      />
      <button type="submit" disabled={searching || !canSearch}>
        {searching ? 'Cerco...' : 'Cerca'}
      </button>
    </form>

    {#if artistResults.length > 0 || songResults.length > 0}
      <div class="results-groups">
        {#if artistResults.length > 0}
          <div class="results-group">
            <p class="results-title">Artisti</p>
            <div class="results-list">
              {#each artistResults as item}
                <button
                  class="result-card artist-card"
                  on:click={() => {
                    openArtist(item.ln);
                  }}
                  disabled={loadingSong}
                >
                  <strong>{item.n}</strong>
                  <small>Apri pagina artista</small>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#if songResults.length > 0}
          <div class="results-group">
            <p class="results-title">Canzoni</p>
            <div class="results-list">
              {#each songResults as item}
                <button
                  class="result-card"
                  on:click={() => {
                    openSong(item.ln);
                  }}
                  disabled={loadingSong}
                >
                  <strong>{item.n}</strong>
                  <small>{artistName(item)}</small>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else if canSearch && !searching}
      <p class="empty">Nessun risultato</p>
    {/if}

    {#if visitedSongs.length > 0}
      <div class="visited-block">
        <div class="visited-head">
          <strong>Visitate</strong>
          <button class="clear-visited" on:click={clearVisitedSongs}>Svuota</button>
        </div>

        <div class="visited-list">
          {#each visitedSongs as item}
            <button
              class="visited-item"
              on:click={() => {
                openSong(item.canonicalUrl);
              }}
            >
              <strong>{item.title}</strong>
              <small>{item.artist}</small>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  {#if selectedSong}
    <section class="song-head">
      <div>
        <h1>{selectedSong.title}</h1>
        <p>
          {#if selectedSong.artistUrl}
            <a class="artist-inline-link" href={selectedSong.artistUrl} on:click|preventDefault={openArtistFromSong}
              >{selectedSong.artist}</a
            >
          {:else}
            {selectedSong.artist}
          {/if}
          {#if selectedSong.key}
            <span class="dot">•</span> Tonalità: {selectedSong.key}
          {/if}
        </p>
      </div>

      <div class="head-actions">
        <button class="download-btn" on:click={downloadPdf}>
          <svg
            class="download-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          <span>Scarica PDF</span>
        </button>
      </div>
    </section>

    <section class="tool-ribbon">
      <div class="tool">
        <label>Traspositore</label>
        <div class="row">
          <button on:click={() => adjustSemitone(-1)}>-</button>
          <output>{semitones > 0 ? `+${semitones}` : semitones}</output>
          <button on:click={() => adjustSemitone(1)}>+</button>
        </div>
      </div>

      <div class="tool">
        <label>Semplifica</label>
        <label class="switch">
          <input type="checkbox" bind:checked={simplify} />
          <span></span>
        </label>
      </div>

      <div class="tool">
        <label>Testo</label>
        <div class="row">
          <button on:click={() => adjustFont(-1)}>-</button>
          <output>{fontSize}px</output>
          <button on:click={() => adjustFont(1)}>+</button>
        </div>
      </div>

    </section>

    <section class="autoscroll-dock">
      <label>Auto-scroll</label>
      <div class="autoscroll-grid">
        <button class:active={autoscrollSpeed === 0.5} on:click={() => applyAutoscroll(0.5)}>0,5x</button>
        <button class:active={autoscrollSpeed === 1} on:click={() => applyAutoscroll(1)}>1x</button>
        <button class:active={autoscrollSpeed === 1.5} on:click={() => applyAutoscroll(1.5)}>1,5x</button>
        <button class:active={autoscrollSpeed === 2} on:click={() => applyAutoscroll(2)}>2x</button>
        <button class="stop" on:click={() => applyAutoscroll(0)}>Stop</button>
      </div>
    </section>

    <article class="lyrics-main" bind:this={lyricsContainerEl}>
      <pre bind:this={lyricsPreEl} style={`font-size:${fittedFontSize}px !important;`}>{renderedSong}</pre>
    </article>

    <section class="extras">
      <details class="extra-card">
        <summary>Diteggiature ({visibleChords.length})</summary>
        <div class="diagram-list">
          {#each visibleChordDiagrams as item}
            <ChordDiagram chord={item.chord} diagrams={item.diagrams} />
          {/each}
        </div>
      </details>

      {#if selectedSong.description}
        <details class="extra-card">
          <summary>Descrizione</summary>
          <p>{selectedSong.description}</p>
        </details>
      {/if}

      {#if selectedSong.youtubeUrl}
        <details class="extra-card">
          <summary>Video</summary>
          {#if youtubeWatchUrl && youtubeThumbUrl}
            <a class="video-link" href={youtubeWatchUrl} target="_blank" rel="noreferrer">
              <img src={youtubeThumbUrl} alt={`Anteprima video ${selectedSong.title}`} />
              <span>Apri su YouTube</span>
            </a>
          {:else}
            <a class="video-link fallback" href={selectedSong.youtubeUrl} target="_blank" rel="noreferrer">
              <span>Apri video originale</span>
            </a>
          {/if}
        </details>
      {/if}
    </section>
  {:else if selectedArtist}
    <section class="artist-head">
      <div class="artist-head-main">
        {#if selectedArtist.imageUrl}
          <img src={selectedArtist.imageUrl} alt={`Immagine ${selectedArtist.name}`} />
        {/if}
        <div>
          <h1>{selectedArtist.name}</h1>
          <p>{selectedArtist.songs.length} canzoni disponibili</p>
        </div>
      </div>
    </section>

    {#if selectedArtist.description}
      <section class="artist-description">
        <p>{selectedArtist.description}</p>
      </section>
    {/if}

    <section class="artist-songs">
      {#each selectedArtist.songs as song}
        <button
          class="artist-song-item"
          on:click={() => {
            openSong(song.url);
          }}
          disabled={loadingSong}
        >
          <strong>{song.title}</strong>
          <small>Apri accordi e testo</small>
        </button>
      {/each}
    </section>
  {:else}
    <section class="placeholder">
      <h1>Cerca e apri una canzone</h1>
      <p>Il testo e accordi occupano tutta la pagina e seguono lo scroll principale.</p>
    </section>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</main>

<style>
  .app-shell {
    width: min(1220px, 95vw);
    margin: 0.9rem auto 1.5rem;
  }

  .search-strip {
    position: relative;
    background: linear-gradient(180deg, rgba(15, 22, 40, 0.94), rgba(10, 16, 32, 0.92));
    border: 1px solid rgba(103, 145, 206, 0.26);
    border-radius: 16px;
    box-shadow: 0 12px 32px rgba(3, 7, 18, 0.45);
    backdrop-filter: blur(12px);
    padding: 0.65rem;
  }

  .search-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.45rem;
  }

  .eyebrow {
    margin: 0;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 0.74rem;
    color: var(--accent);
    font-family: 'IBM Plex Mono', monospace;
  }

  .searchbox {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.4rem;
  }

  .searchbox input {
    background: rgba(8, 12, 24, 0.9);
    border: 1px solid rgba(122, 167, 224, 0.3);
    border-radius: 11px;
    padding: 0.68rem 0.78rem;
    outline: none;
  }

  .searchbox input:focus {
    border-color: rgba(86, 215, 255, 0.72);
    box-shadow: 0 0 0 3px rgba(86, 215, 255, 0.16);
  }

  button,
  a {
    border: 1px solid rgba(122, 167, 224, 0.34);
    border-radius: 11px;
    background: linear-gradient(140deg, rgba(49, 101, 168, 0.45), rgba(32, 62, 110, 0.45));
    color: var(--text);
    padding: 0.62rem 0.82rem;
    cursor: pointer;
    transition: transform 120ms ease;
  }

  button:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .results-list {
    display: grid;
    gap: 0.35rem;
    max-height: min(44vh, 320px);
    overflow: auto;
    padding-right: 0.1rem;
  }

  .results-groups {
    margin-top: 0.45rem;
    display: grid;
    gap: 0.52rem;
  }

  .results-group {
    border: 1px solid rgba(114, 156, 212, 0.2);
    border-radius: 11px;
    padding: 0.45rem;
    background: rgba(9, 14, 26, 0.7);
  }

  .results-title {
    margin: 0 0 0.38rem;
    color: #b3d2f3;
    font-size: 0.83rem;
    letter-spacing: 0.02em;
  }

  .visited-block {
    margin-top: 0.75rem;
    border-top: 1px solid rgba(122, 167, 224, 0.25);
    padding-top: 0.65rem;
  }

  .visited-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.42rem;
  }

  .visited-head strong {
    font-size: 0.86rem;
    color: #c7dfff;
  }

  .clear-visited {
    padding: 0.24rem 0.5rem;
    font-size: 0.75rem;
  }

  .visited-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 0.34rem;
  }

  .visited-item {
    text-align: left;
    padding: 0.45rem 0.52rem;
    background: rgba(11, 18, 34, 0.9);
    border: 1px solid rgba(116, 161, 220, 0.26);
    display: grid;
    gap: 0.1rem;
  }

  .visited-item strong {
    font-size: 0.84rem;
    line-height: 1.2;
  }

  .visited-item small {
    color: #8fb1d6;
    font-size: 0.76rem;
  }

  .result-card {
    text-align: left;
    padding: 0.55rem 0.62rem;
    background: rgba(10, 15, 28, 0.92);
    display: grid;
    gap: 0.15rem;
  }

  .result-card strong {
    font-size: 0.98rem;
  }

  .result-card small {
    color: #9ec8ff;
  }

  .artist-card {
    border-color: rgba(99, 203, 255, 0.4);
    background: linear-gradient(130deg, rgba(13, 31, 46, 0.92), rgba(8, 20, 34, 0.92));
  }

  .result-card span {
    color: var(--muted);
    font-size: 0.76rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty {
    margin: 0.55rem 0 0;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .song-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    margin-top: 1rem;
    margin-bottom: 0.35rem;
    padding: 0.25rem 0;
  }

  .song-head h1 {
    margin: 0;
    font-size: clamp(1.26rem, 3vw, 2.05rem);
  }

  .song-head p {
    margin: 0.35rem 0 0;
    color: var(--muted);
  }

  .artist-inline-link {
    display: inline;
    color: #a9d7ff;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
    border: 0;
    background: transparent;
    padding: 0;
    border-radius: 0;
  }

  .artist-inline-link:hover {
    color: #d6eeff;
  }

  .artist-inline-link:focus-visible {
    outline: 2px solid rgba(86, 215, 255, 0.7);
    outline-offset: 2px;
  }

  .head-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .download-btn {
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 0.36rem;
  }

  .download-icon {
    flex: 0 0 auto;
  }

  .tool-ribbon {
    margin-top: 0.7rem;
    padding: 0.45rem;
    border: 1px solid rgba(120, 162, 220, 0.24);
    border-radius: 14px;
    background: rgba(10, 15, 29, 0.88);
    backdrop-filter: blur(10px);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.42rem;
  }

  .tool-ribbon .tool {
    min-width: 0;
  }

  .tool-ribbon .row {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) 2rem;
    gap: 0.3rem;
    align-items: center;
  }

  .tool-ribbon .row button {
    width: 2rem;
    height: 2rem;
    padding: 0;
    display: grid;
    place-items: center;
  }

  .tool-ribbon .row output {
    min-width: 0;
    width: 100%;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .autoscroll-dock {
    position: sticky;
    top: 0.6rem;
    z-index: 24;
    margin-top: 0.55rem;
    border: 1px solid rgba(125, 170, 226, 0.28);
    border-radius: 13px;
    background: rgba(9, 14, 27, 0.9);
    backdrop-filter: blur(10px);
    padding: 0.45rem;
    overflow: hidden;
  }

  .autoscroll-dock > label {
    display: block;
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 0.3rem;
  }

  .autoscroll-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.32rem;
  }

  .autoscroll-grid button {
    width: 100%;
    min-width: 0;
    padding: 0.38rem 0.2rem;
    font-size: 0.8rem;
  }

  .autoscroll-grid .active {
    border-color: rgba(86, 215, 255, 0.65);
    box-shadow: inset 0 0 0 1px rgba(86, 215, 255, 0.3);
  }

  .autoscroll-grid .stop {
    background: rgba(255, 110, 127, 0.16);
    border-color: rgba(255, 110, 127, 0.45);
  }

  .tool {
    border: 1px solid rgba(122, 167, 224, 0.24);
    background: rgba(8, 13, 24, 0.85);
    border-radius: 11px;
    padding: 0.56rem;
  }

  .tool label {
    display: block;
    color: var(--muted);
    font-size: 0.82rem;
    margin-bottom: 0.4rem;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.36rem;
  }

  .row output {
    min-width: 54px;
    text-align: center;
    font-family: 'IBM Plex Mono', monospace;
  }

  .row button {
    padding: 0.42rem 0.55rem;
  }

  .row button.stop {
    background: rgba(255, 110, 127, 0.16);
    border-color: rgba(255, 110, 127, 0.45);
  }

  .dot {
    margin: 0 0.28rem;
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 52px;
    height: 28px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .switch span {
    position: absolute;
    inset: 0;
    background: rgba(9, 15, 26, 0.86);
    border: 1px solid rgba(166, 209, 248, 0.3);
    border-radius: 999px;
    transition: all 120ms ease;
  }

  .switch span::before {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    left: 4px;
    top: 3px;
    border-radius: 999px;
    background: #cde7ff;
    transition: transform 120ms ease;
  }

  .switch input:checked + span {
    background: rgba(86, 215, 255, 0.25);
    border-color: rgba(86, 215, 255, 0.65);
  }

  .switch input:checked + span::before {
    transform: translateX(23px);
    background: #56d7ff;
  }

  .viewer-grid {
    display: block;
  }

  .lyrics-main {
    margin-top: 1rem;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .lyrics-main pre {
    margin: 0;
    line-height: 1.42;
    white-space: pre;
    overflow-wrap: normal;
    word-break: normal;
    font-family: 'IBM Plex Mono', monospace;
    letter-spacing: 0.005em;
    color: #e8f2ff;
    display: inline-block;
    min-width: max-content;
  }

  .extras {
    margin-top: 1.05rem;
    display: grid;
    gap: 0.6rem;
  }

  .extra-card {
    border: 1px solid rgba(122, 167, 224, 0.24);
    border-radius: 13px;
    background: rgba(10, 15, 29, 0.82);
    padding: 0.75rem;
  }

  .extra-card[open] summary {
    margin-bottom: 0.62rem;
  }

  summary {
    cursor: pointer;
    font-weight: 700;
    color: #c3ddff;
  }

  .diagram-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.5rem;
  }

  .extra-card p {
    margin: 0;
    color: #bed4eb;
    line-height: 1.46;
  }

  .video-link {
    margin-top: 0.2rem;
    border: 1px solid rgba(125, 170, 226, 0.3);
    border-radius: 11px;
    display: block;
    overflow: hidden;
    text-decoration: none;
    background: rgba(8, 13, 24, 0.9);
    padding: 0;
  }

  .video-link img {
    width: 100%;
    display: block;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  .video-link span {
    display: block;
    padding: 0.7rem;
    color: #a6c5e7;
    font-weight: 600;
  }

  .video-link.fallback {
    padding: 0.65rem;
  }

  .artist-head {
    margin-top: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;
  }

  .artist-head-main {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }

  .artist-head-main img {
    width: 58px;
    height: 58px;
    border-radius: 12px;
    object-fit: cover;
    border: 1px solid rgba(117, 161, 220, 0.4);
  }

  .artist-head h1 {
    margin: 0;
    font-size: clamp(1.2rem, 3vw, 1.9rem);
  }

  .artist-head p {
    margin: 0.22rem 0 0;
    color: var(--muted);
  }

  .artist-description {
    margin-top: 0.6rem;
    border: 1px solid rgba(122, 167, 224, 0.24);
    border-radius: 12px;
    background: rgba(10, 15, 29, 0.82);
    padding: 0.7rem 0.8rem;
  }

  .artist-description p {
    margin: 0;
    color: #bed4eb;
    line-height: 1.48;
  }

  .artist-songs {
    margin-top: 0.8rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.4rem;
  }

  .artist-song-item {
    text-align: left;
    display: grid;
    gap: 0.14rem;
    padding: 0.56rem 0.62rem;
    background: rgba(10, 15, 28, 0.92);
  }

  .artist-song-item strong {
    font-size: 0.94rem;
  }

  .artist-song-item small {
    color: #9ec8ff;
  }

  .placeholder {
    margin-top: 1rem;
    border: 1px dashed rgba(128, 171, 226, 0.36);
    border-radius: 14px;
    background: rgba(8, 12, 22, 0.64);
    padding: 1rem;
  }

  .placeholder h1 {
    margin: 0;
    font-size: 1.25rem;
  }

  .placeholder p {
    margin: 0.55rem 0 0;
    color: var(--muted);
    max-width: 68ch;
    line-height: 1.5;
  }

  .error {
    margin-top: 0.8rem;
    border-radius: 11px;
    border: 1px solid rgba(255, 110, 127, 0.42);
    background: rgba(255, 110, 127, 0.14);
    color: #ffd8de;
    padding: 0.64rem 0.72rem;
  }

  @media (max-width: 1180px) {
    .autoscroll-dock {
      top: 0.6rem;
    }
  }

  @media (max-width: 760px) {
    .app-shell {
      margin: 0.55rem auto 1rem;
    }

    .search-strip {
      padding: 0.55rem;
    }

    .tool-ribbon {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      padding: 0.4rem;
    }

    .tool-ribbon .row {
      grid-template-columns: 1.8rem minmax(0, 1fr) 1.8rem;
      gap: 0.22rem;
    }

    .tool-ribbon .row button {
      width: 1.8rem;
      height: 1.8rem;
      font-size: 0.78rem;
    }

    .tool-ribbon .row output {
      font-size: 0.78rem;
    }

    .autoscroll-dock {
      top: 0.45rem;
      padding: 0.4rem;
    }

    .autoscroll-grid {
      gap: 0.24rem;
    }

    .autoscroll-grid button {
      font-size: 0.74rem;
      padding: 0.32rem 0.14rem;
    }

    .searchbox {
      grid-template-columns: 1fr;
    }

    .results-list {
      max-height: 26vh;
    }

    .results-group {
      padding: 0.38rem;
    }

    .visited-list {
      grid-template-columns: 1fr;
    }

    .song-head {
      flex-direction: row;
      gap: 0.6rem;
      align-items: flex-start;
    }

    .artist-head {
      align-items: flex-start;
      flex-direction: column;
    }

    .artist-songs {
      grid-template-columns: 1fr;
    }

    .head-actions {
      flex-direction: column;
      align-items: stretch;
      width: 130px;
    }

    .download-btn {
      font-size: 0.8rem;
      padding: 0.3rem 0.45rem;
    }

    .lyrics-main pre {
      line-height: 1.35;
    }
  }
</style>
