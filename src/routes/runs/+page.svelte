<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'http://localhost:8000';

  let runs = [];
  let isLoading = true;
  let errorMessage = '';

  // Speicher für die IDs der aktuell aufgeklappten Runs
  let expandedRunIds = new Set();

  function toggleExpand(id) {
    if (expandedRunIds.has(id)) {
      expandedRunIds.delete(id);
    } else {
      expandedRunIds.add(id);
    }
    expandedRunIds = expandedRunIds; // Svelte-Reaktivität auslösen
  }

  async function fetchRuns() {
    isLoading = true;
    errorMessage = '';
    try {
      const res = await fetch(`${backendUrl}/runs/`);
      if (res.ok) {
        runs = await res.json();
      } else {
        errorMessage = `Fehler beim Laden der Runs (Status: ${res.status})`;
      }
    } catch (err) {
      errorMessage = 'Verbindungsfehler zum Backend!';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    fetchRuns();
  });
</script>

<div class="header-action">
  <h1>Event Runs</h1>
  <a href="/runs/new" class="create-btn">+ Neuen Run anlegen</a>
</div>

<section class="card">
  <h2>Aktive Runs</h2>

  {#if isLoading}
    <p class="status-text">Lade Runs...</p>
  {:else if errorMessage}
    <p class="error">{errorMessage}</p>
  {:else if runs.length === 0}
    <p class="status-text">Noch keine Runs vorhanden. Erstelle einen neuen Run!</p>
  {:else}
    <ul class="runs-list">
      {#each runs as run}
        {@const isExpanded = expandedRunIds.has(run.id)}
        <li class="run-item">
          <div class="run-header" on:click={() => toggleExpand(run.id)} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && toggleExpand(run.id)}>
            <div class="run-info">
              <span class="run-name">{run.name}</span>
              <span class="run-meta">
                {#if run.event_type}📌 {run.event_type} {/if}
                {#if run.date}📅 {new Date(run.date).toLocaleDateString('de-DE')}{/if}
              </span>
            </div>

            <div class="header-right">
              <span class="badge">{run.status || 'Aktiv'}</span>
              <button class="expand-btn" type="button">
                {isExpanded ? '▲ Verbergen' : '▼ Details'}
              </button>
            </div>
          </div>

          {#if isExpanded}
            <div class="run-details">
              {#if run.note}
                <p class="note"><strong>Notiz:</strong> {run.note}</p>
              {/if}

              <div class="details-grid">
                <div class="detail-block">
                  <h3>👥 Teilnehmer ({run.participants ? run.participants.length : 0})</h3>
                  {#if run.participants && run.participants.length > 0}
                    <ul>
                      {#each run.participants as participant}
                        <li>{participant}</li>
                      {/each}
                    </ul>
                  {:else}
                    <p class="empty-text">Keine Teilnehmer eingetragen</p>
                  {/if}
                </div>

                <div class="detail-block">
                  <h3>📦 Drops / Items ({run.items ? run.items.length : 0})</h3>
                  {#if run.items && run.items.length > 0}
                    <ul>
                      {#each run.items as item}
                        <li>
                          <span class="item-name">{item.name}</span>
                          <span class="item-qty">x{item.quantity}</span>
                        </li>
                      {/each}
                    </ul>
                  {:else}
                    <p class="empty-text">Keine Items eingetragen</p>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .header-action { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  h1 { color: #fbbf24; margin: 0; }
  .create-btn { background-color: #d97706; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
  .create-btn:hover { background-color: #b45309; }
  .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; }
  
  .runs-list { list-style: none; padding: 0; margin: 0; }
  .run-item { background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; margin-bottom: 0.75rem; overflow: hidden; }
  
  .run-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; cursor: pointer; user-select: none; }
  .run-header:hover { background-color: #1a2436; }
  
  .run-info { display: flex; flex-direction: column; gap: 0.25rem; }
  .run-name { font-weight: 600; color: #f8fafc; font-size: 1.05rem; }
  .run-meta { font-size: 0.85rem; color: #94a3b8; }
  
  .header-right { display: flex; align-items: center; gap: 0.75rem; }
  .badge { background-color: #059669; color: white; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 4px; }
  
  .expand-btn { background: none; border: 1px solid #475569; color: #cbd5e1; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
  .expand-btn:hover { background-color: #334155; color: white; }

  /* Details Styling */
  .run-details { padding: 1rem; border-top: 1px solid #334155; background-color: #090d16; }
  .note { font-size: 0.9rem; color: #cbd5e1; margin-bottom: 1rem; }
  
  .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .detail-block { background-color: #1e293b; padding: 0.8rem; border-radius: 6px; border: 1px solid #334155; }
  .detail-block h3 { font-size: 0.9rem; color: #fbbf24; margin-top: 0; margin-bottom: 0.5rem; }
  
  .detail-block ul { list-style: none; padding: 0; margin: 0; }
  .detail-block li { display: flex; justify-content: space-between; font-size: 0.875rem; color: #e2e8f0; padding: 0.25rem 0; border-bottom: 1px dashed #334155; }
  .detail-block li:last-child { border-bottom: none; }
  
  .item-name { color: #f8fafc; }
  .item-qty { color: #38bdf8; font-weight: 600; }
  
  .status-text { color: #94a3b8; }
  .empty-text { font-size: 0.85rem; color: #64748b; font-style: italic; margin: 0; }
  .error { color: #ef4444; }
</style>
