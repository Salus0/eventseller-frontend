<script>
  import { onMount } from 'svelte';
  // Importiert die öffentliche Umgebungsvariable aus SvelteKit
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  // Falls die Variable lokal nicht geladen wird, nutzen wir localhost als Fallback
  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app/';

  let runs = [];
  let newRunName = '';
  let isLoading = true;
  let errorMessage = '';

  // Runs vom Backend abrufen
  async function fetchRuns() {
    isLoading = true;
    errorMessage = '';
    try {
      const res = await fetch(`${backendUrl}/runs/`);
      if (res.ok) {
        runs = await res.json();
      } else {
        errorMessage = 'Fehler beim Laden der Runs (Status: ' + res.status + ')';
      }
    } catch (err) {
      errorMessage = 'Verbindungsfehler zum Backend!';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }

  // Neuen Run im Backend erstellen
  async function createRun() {
    if (!newRunName.trim()) return;

    try {
      const res = await fetch(`${backendUrl}/runs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRunName })
      });

      if (res.ok) {
        newRunName = '';
        await fetchRuns(); // Liste neu laden
      } else {
        alert('Run konnte nicht erstellt werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Netzwerkfehler beim Erstellen des Runs.');
    }
  }

  onMount(() => {
    fetchRuns();
  });
</script>

<h1>Event Runs</h1>

<section class="card">
  <h2>Neuen Run erstellen</h2>
  <form on:submit|preventDefault={createRun} class="form">
    <input 
      type="text" 
      bind:value={newRunName} 
      placeholder="z. B. Endless Tower - 04.08." 
      required 
    />
    <button type="submit">Run anlegen</button>
  </form>
</section>

<section class="card">
  <h2>Aktive Runs</h2>

  {#if isLoading}
    <p>Lade Runs...</p>
  {:else if errorMessage}
    <p class="error">{errorMessage}</p>
  {:else if runs.length === 0}
    <p>Noch keine Runs vorhanden. Erstelle oben deinen ersten Run!</p>
  {:else}
    <ul class="runs-list">
      {#each runs as run}
        <li>
          <span class="run-name">{run.name}</span>
          <span class="badge">{run.status || 'Aktiv'}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  h1 {
    color: #fbbf24;
    margin-bottom: 1.5rem;
  }

  .card {
    background-color: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .form {
    display: flex;
    gap: 0.75rem;
  }

  input {
    flex: 1;
    padding: 0.6rem 1rem;
    background-color: #0f172a;
    border: 1px solid #475569;
    border-radius: 6px;
    color: white;
  }

  button {
    background-color: #d97706;
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }

  button:hover {
    background-color: #b45309;
  }

  .runs-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .runs-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background-color: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    margin-bottom: 0.5rem;
  }

  .run-name {
    font-weight: 500;
  }

  .badge {
    background-color: #059669;
    color: white;
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .error {
    color: #ef4444;
  }
</style>
