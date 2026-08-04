<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app/';

  let runs = [];
  let isLoading = true;
  let errorMessage = '';

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
    <p class="status-text">Noch keine Runs vorhanden. Klicke oben auf "+ Neuen Run anlegen"!</p>
  {:else}
    <ul class="runs-list">
      {#each runs as run}
        <li>
          <div class="run-info">
            <span class="run-name">{run.name}</span>
            <span class="run-meta">
              {#if run.event_type}📌 {run.event_type} {/if}
              {#if run.date}📅 {new Date(run.date).toLocaleDateString('de-DE')}{/if}
            </span>
          </div>
          <span class="badge">{run.status || 'Aktiv'}</span>
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
  .runs-list li { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; margin-bottom: 0.5rem; }
  .run-info { display: flex; flex-direction: column; gap: 0.2rem; }
  .run-name { font-weight: 600; color: #f8fafc; }
  .run-meta { font-size: 0.8rem; color: #94a3b8; }
  .badge { background-color: #059669; color: white; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 4px; }
  .status-text { color: #94a3b8; }
  .error { color: #ef4444; }
</style>
