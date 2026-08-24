<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  // Fest hinterlegte Public-Backend-URL als primärer Wert
  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let participants = [];
  let newParticipantName = '';
  let newParticipantClass = '';
  let isLoading = true;
  let errorMessage = '';

  // Typische Ragnarok Online Klassen für die Auswahl
  const roClasses = [
    'Rune Knight', 'Warlock', 'Ranger', 'Arch Bishop', 'Mechanic', 'Guillotine Cross',
    'Royal Guard', 'Sorcerer', 'Minstrel', 'Wanderer', 'Genetic', 'Shadow Chaser',
    'Soul Reaper', 'Star Emperor', 'Kagerou/Oboro', 'Rebellion', 'Super Novice', 'Sonstiges'
  ];

  // Teilnehmer vom Backend abrufen
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

  // Neuen Teilnehmer im Backend erstellen
  async function createParticipant() {
    const trimmedName = newParticipantName.trim();
    if (!trimmedName) {
      alert('Bitte gib einen Spielernamen ein.');
      return;
    }

    const payload = {
      name: trimmedName,
      main_class: newParticipantClass || null
    };

    try {
      const res = await fetch(`${backendUrl}/participants/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        newParticipantName = '';
        newParticipantClass = '';
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

<!-- Formular zum Hinzufügen von Teilnehmern -->
<section class="card">
  <h2>Neuen Teilnehmer / Spieler anlegen</h2>
  
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

    <div class="form-group">
      <label for="participant-class">Hauptklasse (Optional)</label>
      <select id="participant-class" bind:value={newParticipantClass}>
        <option value="">-- Klasse wählen --</option>
        {#each roClasses as roClass}
          <option value={roClass}>{roClass}</option>
        {/each}
      </select>
    </div>

    <div class="full-width">
      <button type="submit" class="submit-btn">+ Spieler anlegen</button>
    </div>
  </form>
</section>

<!-- Liste der vorhandenen Teilnehmer -->
<section class="card">
  <h2>Registrierte Spieler</h2>

  {#if isLoading}
    <p class="status-text">Lade Teilnehmer...</p>
  {:else if errorMessage}
    <p class="error">{errorMessage}</p>
  {:else if participants.length === 0}
    <p class="status-text">Noch keine Spieler eingetragen. Lege oben deinen ersten Teilnehmer an!</p>
  {:else}
    <div class="participants-grid">
      {#each participants as p}
        <div class="participant-card">
          <div class="p-header">
            <span class="p-name">{p.name}</span>
            {#if p.main_class}
              <span class="class-badge">{p.main_class}</span>
            {/if}
          </div>
          
          <div class="p-stats">
            <div class="stat-row">
              <span>Status Auszahlung:</span>
              <span class={p.is_paid ? 'status-paid' : 'status-open'}>
                {p.is_paid ? '✓ Ausgezahlt' : '⏳ Offen'}
              </span>
            </div>
          </div>
        </div>
      {/each}
    </div>
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
  input, select { padding: 0.6rem 0.8rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 6px; color: white; font-size: 0.95rem; }
  input:focus, select:focus { outline: none; border-color: #fbbf24; }
  
  .submit-btn { background-color: #d97706; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; }
  .submit-btn:hover { background-color: #b45309; }
  
  /* Raster-Ansicht für Teilnehmer */
  .participants-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
  .participant-card { background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 1rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem; }
  
  .p-header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .p-name { font-weight: 600; color: #f8fafc; font-size: 1.05rem; }
  
  .class-badge { background-color: #334155; color: #38bdf8; font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 4px; }
  
  .p-stats { border-top: 1px solid #1e293b; padding-top: 0.5rem; font-size: 0.85rem; }
  .stat-row { display: flex; justify-content: space-between; align-items: center; color: #94a3b8; }
  
  .status-paid { color: #10b981; font-weight: 600; }
  .status-open { color: #f59e0b; font-weight: 600; }
  
  .status-text { color: #94a3b8; }
  .error { color: #ef4444; }
</style>
