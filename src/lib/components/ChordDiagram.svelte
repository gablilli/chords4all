<script lang="ts">
  import type { ChordDiagram as DiagramData, Fret } from '$lib/chord-diagrams';

  export let chord = '';
  export let diagrams: DiagramData[] = [];

  const strings = ['E', 'A', 'D', 'G', 'B', 'e'];
  const stringIndexes = [0, 1, 2, 3, 4, 5];
  const fretIndexes = [0, 1, 2, 3, 4];

  let variantIndex = 0;
  let previousVariantsKey = '';

  function marker(fret: Fret): string {
    if (fret === 'x') return 'x';
    if (fret === 0) return 'o';
    return '';
  }

  function previousVariant(): void {
    if (diagrams.length <= 1) {
      return;
    }

    variantIndex = (variantIndex - 1 + diagrams.length) % diagrams.length;
  }

  function nextVariant(): void {
    if (diagrams.length <= 1) {
      return;
    }

    variantIndex = (variantIndex + 1) % diagrams.length;
  }

  function computeBarres(frets: DiagramData['frets'], baseFret: number): Array<{
    relativeFret: number;
    fromStringIndex: number;
    toStringIndex: number;
  }> {
    const byFret = new Map<number, number[]>();

    frets.forEach((fret, stringIndex) => {
      if (typeof fret !== 'number' || fret <= 0) {
        return;
      }

      const indexes = byFret.get(fret) ?? [];
      indexes.push(stringIndex);
      byFret.set(fret, indexes);
    });

    const barres: Array<{ relativeFret: number; fromStringIndex: number; toStringIndex: number }> = [];

    byFret.forEach((stringIndexes, fret) => {
      const relativeFret = fret - baseFret + 1;
      if (relativeFret < 1 || relativeFret > 5) {
        return;
      }

      const sorted = [...stringIndexes].sort((a, b) => a - b);
      let runStart = sorted[0];
      let previous = sorted[0];

      for (let i = 1; i <= sorted.length; i += 1) {
        const current = sorted[i];
        const contiguous = typeof current === 'number' && current === previous + 1;

        if (contiguous) {
          previous = current;
          continue;
        }

        if (previous - runStart + 1 >= 2) {
          barres.push({
            relativeFret,
            fromStringIndex: runStart,
            toStringIndex: previous
          });
        }

        runStart = current;
        previous = current;
      }
    });

    return barres;
  }

  $: variantsKey = `${chord}:${diagrams.map((item) => item.id).join('|')}`;

  $: if (variantsKey !== previousVariantsKey) {
    variantIndex = 0;
    previousVariantsKey = variantsKey;
  }

  $: activeDiagram = diagrams[variantIndex];

  $: barres = activeDiagram ? computeBarres(activeDiagram.frets, activeDiagram.baseFret) : [];

  $: dots = activeDiagram
    ? activeDiagram.frets
        .map((fret, stringIndex) => {
          if (typeof fret !== 'number' || fret <= 0) {
            return null;
          }

          const relativeFret = fret - activeDiagram.baseFret + 1;
          if (relativeFret < 1 || relativeFret > 5) {
            return null;
          }

          return { stringIndex, relativeFret };
        })
        .filter((item): item is { stringIndex: number; relativeFret: number } => item !== null)
    : [];
</script>

<div class="diagram-card">
  <header>
    <strong>{chord}</strong>
    {#if activeDiagram}
      <small>
        {activeDiagram.baseFret === 1 ? 'aperto' : `barrè al ${activeDiagram.baseFret} tasto`}
      </small>
    {/if}
  </header>

  {#if activeDiagram}
    <div class="markers">
      {#each activeDiagram.frets as fret}
        <span>{marker(fret)}</span>
      {/each}
    </div>

    <div class="fretboard">
      {#each stringIndexes as stringIndex}
        <i class="string" style={`left:${(stringIndex / 5) * 100}%`}></i>
      {/each}

      {#each fretIndexes as fretIndex}
        <i class="fret" style={`top:${(fretIndex / 4) * 100}%`}></i>
      {/each}

      {#if activeDiagram.baseFret === 1}
        <i class="nut"></i>
      {/if}

      {#each barres as barre}
        <span
          class="barre"
          style={`left:${(barre.fromStringIndex / 5) * 100}%; width:${((barre.toStringIndex - barre.fromStringIndex) / 5) * 100}%; top:${((barre.relativeFret - 0.5) / 5) * 100}%`}
        ></span>
      {/each}

      {#each dots as dot}
        <span
          class="dot"
          style={`left:${(dot.stringIndex / 5) * 100}%; top:${((dot.relativeFret - 0.5) / 5) * 100}%`}
        ></span>
      {/each}
    </div>

    <div class="labels">
      {#each strings as string}
        <span>{string}</span>
      {/each}
    </div>

    {#if diagrams.length > 1}
      <div class="variants-nav">
        <button class="variant-arrow" on:click={previousVariant} aria-label="Variante precedente">◀</button>
        <span>{variantIndex + 1} / {diagrams.length}</span>
        <button class="variant-arrow" on:click={nextVariant} aria-label="Variante successiva">▶</button>
      </div>
    {/if}
  {:else}
    <div class="missing">Diagramma non disponibile</div>
  {/if}
</div>

<style>
  .diagram-card {
    background: linear-gradient(170deg, rgba(18, 26, 46, 0.94), rgba(12, 18, 34, 0.94));
    border: 1px solid rgba(122, 165, 220, 0.25);
    border-radius: 12px;
    padding: 0.7rem;
    width: 100%;
    max-width: 190px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.45rem;
  }

  strong {
    font-size: 0.95rem;
    letter-spacing: 0.01em;
  }

  small {
    color: var(--muted);
    font-size: 0.72rem;
  }

  .markers,
  .labels {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.25rem;
    text-align: center;
  }

  .markers {
    font-family: 'IBM Plex Mono', monospace;
    color: #a8bfd8;
    font-size: 0.72rem;
    margin-bottom: 0.45rem;
    min-height: 14px;
  }

  .fretboard {
    position: relative;
    width: min(100%, 170px);
    margin: 0 auto;
    height: 155px;
    border-radius: 8px;
    background: linear-gradient(180deg, rgba(20, 31, 56, 0.86), rgba(11, 18, 33, 0.86));
    overflow: hidden;
  }

  .string,
  .fret,
  .nut {
    position: relative;
    display: block;
  }

  .string {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: linear-gradient(180deg, rgba(220, 236, 255, 0.95), rgba(166, 193, 225, 0.8));
    box-shadow: 0 0 3px rgba(95, 145, 205, 0.35);
  }

  .fret {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    margin-top: -1px;
    background: rgba(170, 197, 230, 0.35);
  }

  .nut {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 4px;
    background: rgba(228, 240, 255, 0.9);
  }

  .dot {
    position: absolute;
    width: 16px;
    height: 16px;
    margin-left: -8px;
    margin-top: -8px;
    border-radius: 999px;
    background: radial-gradient(circle at 35% 30%, #b8e8ff, #67c6ff 62%, #2c639e);
    box-shadow: 0 0 10px rgba(91, 193, 255, 0.5);
    display: block;
    z-index: 2;
  }

  .barre {
    position: absolute;
    height: 10px;
    margin-top: -5px;
    border-radius: 999px;
    background: rgba(124, 198, 235, 0.52);
    box-shadow: 0 0 4px rgba(80, 148, 200, 0.25);
    z-index: 1;
    min-width: 10px;
  }

  .labels {
    margin-top: 0.52rem;
    color: #95b2ce;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.65rem;
  }

  .variants-nav {
    margin-top: 0.55rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.44rem;
  }

  .variants-nav span {
    min-width: 42px;
    text-align: center;
    color: #a9c4df;
    font-size: 0.72rem;
    font-family: 'IBM Plex Mono', monospace;
  }

  .variant-arrow {
    border: 1px solid rgba(122, 167, 224, 0.34);
    border-radius: 8px;
    background: linear-gradient(140deg, rgba(49, 101, 168, 0.45), rgba(32, 62, 110, 0.45));
    color: #ecf4ff;
    padding: 0.24rem 0.42rem;
    line-height: 1;
    cursor: pointer;
  }

  .missing {
    border: 1px dashed rgba(156, 178, 201, 0.45);
    border-radius: 8px;
    color: var(--muted);
    text-align: center;
    padding: 0.7rem 0.5rem;
    font-size: 0.8rem;
  }
</style>
