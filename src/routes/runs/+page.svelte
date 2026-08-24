<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  // Formular-Zustände
  let eventType = '';
  let eventDate = new Date().toISOString().split('T')[0];
  let runNote = '';

  // Stammdaten für Dropdowns
  let availableParticipants = [];
  let isLoadingParticipants = true;

  // Dynamische Listen für diesen Run
  // Jeder Teilnehmer hat eine ausgewählte participant_id und eine class_name
  let selectedParticipants = [{ participant_id: '', class_name: '' }];
  let items = [{ name: '', quantity: 1 }];

  // Typische Ragnarok Online Klassen
  const roClasses = [
    'Rune Knight', 'Warlock', 'Ranger', 'Arch Bishop', 'Mechanic', 'Guillotine Cross',
    'Royal Guard', 'Sorcerer', 'Minstrel', 'Wanderer', 'Genetic', 'Shadow Chaser',
    'Soul Reaper', 'Star Emperor', 'Kagerou/Oboro', 'Rebellion', 'Super Novice', 'Sonstiges'
  ];

  // Vorhandene Spieler aus der Stammdatenbank laden
  async function fetchAvailableParticipants() {
    try {
      const res = await fetch(`${backendUrl}/participants/`);
      if (res.ok) {
        availableParticipants = await res.json();
      }
    } catch (err) {
      console.error('Fehler beim Laden der Teilnehmer-Stammdaten:', err);
    } finally {
      isLoadingParticipants = false;
    }
  }

  // Teilnehmer-Zeilen verwalten
  function addParticipant() {
    selectedParticipants = [...selectedParticipants, { participant_id: '', class_name: '' }];
  }
  function removeParticipant(index) {
    selectedParticipants = selectedParticipants.filter((_, i) => i !== index);
  }

  // Item-Zeilen verwalten
  function addItem() {
    items = [...items, { name: '', quantity: 1 }];
  }
  function removeItem(index) {
    items = items.filter((_, i) => i !== index);
  }

  async function createRun() {
    const trimmedType = eventType.trim();
    if (!trimmedType) {
      alert('Bitte gib eine Event-Art an.');
      return;
    }

    const formattedDate = new Date(eventDate).toLocaleDateString('de-DE');
    const computedName = runNote.trim() 
      ? `${trimmedType} - ${formattedDate} (${runNote.trim()})`
      : `${trimmedType} - ${formattedDate}`;

    // Nur vollständige Teilnehmer-Einträge übernehmen
    const validParticipants = selectedParticipants
      .filter(p => p.participant_id !== '')
      .map(p => ({
        participant_id: p.participant_id,
        class_name: p.class_name || 'Unbekannt'
      }));

    // Nur gültige Items übernehmen
    const validItems = items.filter(item => item.name.trim() !== '');

    const payload = {
      name: computedName,
      event_type: trimmedType,
      date: eventDate,
      note: runNote.trim(),
      participants: validParticipants,
      items: validItems
    };

    try {
      const res = await fetch(`${backendUrl}/runs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        goto('/runs');
      } else {
        alert('Run konnte nicht erstellt werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Netzwerkfehler beim Erstellen des Runs.');
    }
  }

  onMount(() => {
    fetchAvailableParticipants();
  });
</script>

<div class="header">
  <a href="/runs" class="back-link">← Zurück zur Übersicht</a>
  <h1>Neuen Event-Run anlegen</h1>
</div>

<form on:submit|preventDefault={createRun} class="form-container">
  
  <!-- Sektion 1: Grunddaten -->
  <section class="card">
    <h2>1. Allgemeine Infos</h2>
    <div class="form-grid">
      <div class="form-group">
        <label for="event-type">Event-Art *</label>
        <input id="event-type" type="text" bind:value={eventType} placeholder="z. B. Endless Tower" required />
      </div>

      <div class="form-group">
        <label for="event-date">Datum *</label>
        <input id="event-date" type="date" bind:value={eventDate} required />
      </div>

      <div class="form-group full-width">
        <label for="run-note">Zusatzbezeichnung (Optional)</label>
        <input id="run-note" type="text" bind:value={runNote} placeholder="z. B. Team Alpha" />
      </div>
    </div>
  </section>

  <!-- Sektion 2: Teilnehmer & Klassenauswahl -->
  <section class="card">
    <h2>2. Teilnehmer & Klassen für diesen Run</h2>
    
    {#if isLoadingParticipants}
      <p class="status-text">Lade verfuegbare Spieler...</p>
    {:else if availableParticipants.length === 0}
      <p class="status-text">Keine Spieler in den Stammdaten gefunden. Lege zuerst welche unter <strong>Teilnehmer</strong> an!</p>
    {:else}
      <div class="dynamic-list">
        {#each selectedParticipants as entry, index}
          <div class="row">
            <!-- Spielerauswahl aus Stammdaten -->
            <select bind:value={selectedParticipants[index].participant_id} class="select-player" required>
              <option value="">-- Spieler waehlen --</option>
              {#each availableParticipants as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>

            <!-- Klassenauswahl für diesen Run -->
            <select bind:value={selectedParticipants[index].class_name} class="select-class">
              <option value="">-- Klasse waehlen --</option>
              {#each roClasses as roClass}
                <option value={roClass}>{roClass}</option>
              {/each}
            </select>

            {#if selectedParticipants.length > 1}
              <button type="button" class="remove-btn" on:click={() => removeParticipant(index)}>✕</button>
            {/if}
          </div>
        {/each}

        <button type="button" class="add-btn" on:click={addParticipant}>+ Spieler hinzufügen</button>
      </div>
    {/if}
  </section>

  <!-- Sektion 3: Items / Drops -->
  <section class="card">
    <h2>3. Erbeutete Items / Drops</h2>
    <div class="dynamic-list">
      {#each items as item, index}
        <div class="row item-row">
          <input 
            type="text" 
            bind:value={items[index].name} 
            placeholder="Item-Name (z.B. Card, Weapon)" 
          />
          <input 
            type="number" 
            min="1" 
            bind:value={items[index].quantity} 
            placeholder="Anzahl" 
            class="qty-input"
          />
          {#if items.length > 1}
            <button type="button" class="remove-btn" on:click={() => removeItem(index)}>✕</button>
          {/if}
        </div>
      {/each}
      <button type="button" class="add-btn" on:click={addItem}>+ Item hinzufügen</button>
    </div>
  </section>

  <div class="actions">
    <button type="submit" class="submit-btn">Run speichern</button>
  </div>
</form>

<style>
  .header { margin-bottom: 1.5rem; }
  .back-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; }
  .back-link:hover { color: #fbbf24; }
  h1 { color: #fbbf24; margin-top: 0.5rem; }
  h2 { font-size: 1.1rem; color: #f8fafc; margin-bottom: 1rem; }
  .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
  .form-grid { display: flex; flex-wrap: wrap; gap: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; min-width: 200px; }
  .full-width { width: 100%; flex: 100%; }
  label { font-size: 0.875rem; font-weight: 600; color: #94a3b8; }
  input, select { padding: 0.6rem 0.8rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 6px; color: white; font-size: 0.95rem; }
  input:focus, select:focus { outline: none; border-color: #fbbf24; }
  
  .dynamic-list { display: flex; flex-direction: column; gap: 0.6rem; }
  .row { display: flex; gap: 0.5rem; align-items: center; }
  .select-player { flex: 2; }
  .select-class { flex: 2; }
  .qty-input { max-width: 100px; }
  
  .add-btn { background-color: #334155; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; align-self: flex-start; font-size: 0.85rem; margin-top: 0.4rem; }
  .add-btn:hover { background-color: #475569; }
  
  .remove-btn { background-color: #ef4444; color: white; border: none; padding: 0.6rem 0.8rem; border-radius: 6px; cursor: pointer; }
  .remove-btn:hover { background-color: #dc2626; }
  
  .submit-btn { background-color: #d97706; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; font-size: 1rem; }
  .submit-btn:hover { background-color: #b45309; }
  .status-text { color: #94a3b8; }
</style>
