<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let participants = [];
  let newParticipantName = '';
  let isLoading = true;
  let errorMessage = '';

  async function fetchParticipants() {
    isLoading = true;
    errorMessage = '';
    try {
      const res = await fetch(`${backendUrl}/participants/`);
      if (res.ok) {
        participants = await res.json();
      } else {
        errorMessage = `Fehler beim Laden der Teilnehmer (Status: ${res.status})`;
      }
    } catch (err) {
      errorMessage = 'Verbindungsfehler zum Backend!';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }

  async function createParticipant() {
    const trimmedName = newParticipantName.trim();
    if (!trimmedName) {
      alert('Bitte gib einen Spielernamen ein.');
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/participants/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });

      if (res.ok) {
        newParticipantName = '';
        await fetchParticipants();
      } else {
        alert('Teilnehmer konnte nicht angelegt werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Netzwerkfehler beim Anlegen des Teilnehmers.');
    }
  }

  onMount(() => {
    fetchParticipants();
  });
</script>

<h1>👥 Teilnehmer-Verwaltung</h1>

<section class="card">
  <h2>Neuen Spieler anlegen</h2>
  
  <form on:submit|preventDefault={createParticipant} class="form-grid">
    <div class="form-group">
      <label for="participant-name">Spielername / Ingame-Name *</label>
      <input 
        id="participant-name"
        type="text" 
        bind:value={newParticipantName} 
        placeholder="z. B. Valkyrie_RO" 
        required 
      />
    </div>

    <div class="full-width">
      <button type="submit" class="submit-btn">+ Spieler anlegen</button>
    </div>
  </form>
</section>

<section class="card">
  <h2>Registrierte Spieler</h2>

  {#if isLoading}
    <p class="status-text">Lade Teilnehmer...</p>
  {:else if errorMessage}
    <p class="error">{errorMessage}</p>
  {:else if participants.length === 0}
    <p class="status-text">Noch keine Spieler eingetragen. Lege oben deinen ersten Teilnehmer an!</p>
  {:else}
    <ul class="participants-list">
      {#each participants as p}
        <li class="participant-item">
          <span class="p-name">👤 {p.name}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  h1 { color: #fbbf24; margin-bottom: 1.5rem; }
  h2 { font-size: 1.1rem; color: #f8fafc; margin-bottom: 1rem; }
  .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
  
  .form-grid { display: flex; flex-wrap: wrap; gap: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; min-width: 220px; }
  .full-width { width: 100%; flex: 100%; margin-top: 0.5rem; }
  
  label { font-size: 0.875rem; font-weight: 600; color: #94a3b8; }
  input { padding: 0.6rem 0.8rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 6px; color: white; font-size: 0.95rem; }
  input:focus { outline: none; border-color: #fbbf24; }
  
  .submit-btn { background-color: #d97706; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; }
  .submit-btn:hover { background-color: #b45309; }
  
  .participants-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
  .participant-item { background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 0.75rem 1rem; display: flex; align-items: center; }
  .p-name { font-weight: 600; color: #f8fafc; font-size: 0.95rem; }
  
  .status-text { color: #94a3b8; }
  .error { color: #ef4444; }
</style>
