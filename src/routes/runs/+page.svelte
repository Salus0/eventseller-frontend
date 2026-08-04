<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app/';

  let runs = [];
  let eventType = '';
  let eventDate = new Date().toISOString().split('T')[0];
  let runNote = '';

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

  async function createRun() {
    const trimmedType = eventType.trim();
    if (!trimmedType) {
      alert('Bitte gib eine Event-Art an.');
      return;
    }
    if (!eventDate) {
      alert('Bitte wähle ein Datum aus.');
      return;
    }

    const formattedDate = new Date(eventDate).toLocaleDateString('de-DE');
    const computedName = runNote.trim() 
      ? `${trimmedType} - ${formattedDate} (${runNote.trim()})`
      : `${trimmedType} - ${formattedDate}`;

    const payload = {
      name: computedName,
      event_type: trimmedType,
      date: eventDate,
      note: runNote.trim()
    };

    try {
      const res = await fetch(`${backendUrl}/runs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        eventType = '';
        runNote = '';
        await fetchRuns();
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
  <h2>Neuen Event-Run anlegen</h2>
  
  <form on:submit|preventDefault={createRun} class="form-grid">
    <div class="form-group">
      <label for="event-type">Event-Art *</label>
      <input 
        id="event-type"
        type="text" 
        bind:value={eventType} 
        placeholder="z. B. Endless Tower, Thanatos Tower" 
        required 
      />
    </div>

    <div class="form-group">
      <label for="event-date">Datum *</label>
      <input 
        id="event-date"
        type="date" 
        bind:value={eventDate} 
        required 
      />
    </div>

    <div class="form-group full-width">
      <label for="run-note">Zusatzbezeichnung (Optional)</label>
      <input 
        id="run-note"
        type="text" 
        bind:value={runNote} 
        placeholder="z. B. Team Alpha, Abend-Run, etc." 
      />
    </div>

    <div class="full-width">
      <button type="submit" class="submit-btn">Run anlegen</button>
    </div>
  </form>
</section>

<section class="card">
  <h2>Aktive Runs</h2>

  {#if isLoading}
    <p class="status-text">Lade Runs...</p>
  {:else if errorMessage}
    <p class="error">{errorMessage}</p>
  {:else if runs.length === 0}
    <p class="status-text">Noch keine Runs vorhanden. Erstelle oben deinen ersten Run!</p>
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
  h1 { color: #fbbf24; margin-bottom: 1.5rem; }
  .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
  .form-grid { display: flex; flex-wrap: wrap; gap: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; min-width: 200px; }
  .full-width { width: 100%; flex: 100%; }
  label { font-size: 0.875rem; font-weight: 600; color: #94a3b8; }
  input { padding: 0.6rem 0.8rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 6px; color: white; font-size: 0.95rem; }
  input:focus { outline: none; border-color: #fbbf24; }
  .submit-btn { background-color: #d97706; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; }
  .submit-btn:hover { background-color: #b45309; }
  .runs-list { list-style: none; padding: 0; margin: 0; }
  .runs-list li { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; margin-bottom: 0.5rem; }
  .run-info { display: flex; flex-direction: column; gap: 0.2rem; }
  .run-name { font-weight: 600; color: #f8fafc; }
  .run-meta { font-size: 0.8rem; color: #94a3b8; }
  .badge { background-color: #059669; color: white; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 4px; }
  .status-text { color: #94a3b8; }
  .error { color: #ef4444; }
</style>
