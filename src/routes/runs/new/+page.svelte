<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let eventType = '';
  let eventDate = new Date().toISOString().split('T')[0];
  let runNote = '';

  let raidHelperId = '';
  let isFetchingRaidHelper = false;

  let availableParticipants = [];
  let isLoadingParticipants = true;
  let jwtToken = '';

  let selectedParticipants = [{ participant_id: '', class_name: '' }];

  const roClasses = [
    'Lord Knight', 'High Wizard', 'Sniper', 'High Priest', 'Whitesmith', 'Assassin Cross',
    'Paladin', 'Professor', 'Clown', 'Gypsy', 'Champion', 'Creator', 'Stalker',
    'Gunslinger', 'Ninja', 'Star Gladiator', 'Super Novice', 'Sonstiges'
  ];

  // Mapping von Raid-Helper Klassennamen/Rollen auf RO-Klassen
  const classMapping = {
    'lord knight': 'Lord Knight', 'lk': 'Lord Knight',
    'high wizard': 'High Wizard', 'hw': 'High Wizard', 'wizard': 'High Wizard',
    'sniper': 'Sniper', 'hunter': 'Sniper',
    'high priest': 'High Priest', 'hp': 'High Priest', 'priest': 'High Priest',
    'whitesmith': 'Whitesmith', 'ws': 'Whitesmith', 'blacksmith': 'Whitesmith',
    'assassin cross': 'Assassin Cross', 'sinx': 'Assassin Cross', 'assassin': 'Assassin Cross',
    'paladin': 'Paladin', 'pala': 'Paladin',
    'professor': 'Professor', 'prof': 'Professor', 'sage': 'Professor',
    'clown': 'Clown', 'bard': 'Clown',
    'gypsy': 'Gypsy', 'dancer': 'Gypsy',
    'champion': 'Champion', 'champ': 'Champion', 'monk': 'Champion',
    'creator': 'Creator', 'creo': 'Creator', 'alchemist': 'Creator',
    'stalker': 'Stalker', 'rogue': 'Stalker',
    'gunslinger': 'Gunslinger',
    'ninja': 'Ninja',
    'star gladiator': 'Star Gladiator', 'sg': 'Star Gladiator',
    'super novice': 'Super Novice', 'snovi': 'Super Novice'
  };

  function mapClass(rawClass) {
    if (!rawClass) return 'Sonstiges';
    const cleaned = rawClass.trim().toLowerCase();
    return classMapping[cleaned] || 'Sonstiges';
  }

  function checkAdminAccess() {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      goto('/runs');
      return false;
    }
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const decoded = JSON.parse(jsonPayload);
      if (decoded.role !== 'admin') {
        goto('/runs');
        return false;
      }
      jwtToken = token;
      return true;
    } catch (e) {
      goto('/runs');
      return false;
    }
  }

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

  // --- RAID HELPER IMPORT (Prio 1: Discord ID, Prio 2: Name) ---
  async function importFromRaidHelper() {
    const trimmedId = raidHelperId.trim();
    if (!trimmedId) {
      alert('Bitte gib eine gültige Raid-Helper Event-ID ein.');
      return;
    }

    isFetchingRaidHelper = true;

    try {
      const res = await fetch(`${backendUrl}/raidhelper/event/${trimmedId}`);
      if (!res.ok) {
        alert(`Event konnte nicht geladen werden (Status ${res.status}). Bitte ID prüfen.`);
        return;
      }

      const data = await res.json();

      // 1. Titel & Datum setzen
      if (data.title) {
        eventType = data.title;
      }

      if (data.startTime) {
        const dateObj = new Date(data.startTime * 1000);
        eventDate = dateObj.toISOString().split('T')[0];
      }

      // 2. Angemeldete Teilnehmer verarbeiten
      const signups = data.signUps || data.signups || [];
      const importedParticipants = [];

      for (const signup of signups) {
        const signupDiscordId = String(signup.userId || signup.discordId || '').trim();
        const nameToMatch = (signup.name || signup.discordName || '').trim().toLowerCase();
        const mappedClass = mapClass(signup.className || signup.role);

        // Abgleich: Erst nach Discord-ID matchen, danach Fallback auf den Namen
        const matchedPlayer = availableParticipants.find(p => {
          const dbDiscordId = String(p.discord_id || p.discordId || '').trim();
          const dbName = p.name.trim().toLowerCase();

          if (signupDiscordId && dbDiscordId && signupDiscordId === dbDiscordId) {
            return true;
          }
          return dbName === nameToMatch;
        });

        if (matchedPlayer) {
          importedParticipants.push({
            participant_id: matchedPlayer.id,
            class_name: mappedClass
          });
        }
      }

      if (importedParticipants.length > 0) {
        selectedParticipants = importedParticipants;
        alert(`${importedParticipants.length} angemeldete Spieler aus Raid-Helper übernommen!`);
      } else {
        alert('Event-Daten geladen, aber keine Übereinstimmungen mit den Stammdaten gefunden.');
      }

    } catch (err) {
      console.error('Fehler beim Raid-Helper-Import:', err);
      alert('Netzwerkfehler beim Abrufen der Raid-Helper Daten.');
    } finally {
      isFetchingRaidHelper = false;
    }
  }

  function addParticipant() {
    selectedParticipants = [...selectedParticipants, { participant_id: '', class_name: '' }];
  }
  
  function removeParticipant(index) {
    selectedParticipants = selectedParticipants.filter((_, i) => i !== index);
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

    const validParticipants = selectedParticipants
      .filter(p => p.participant_id !== '')
      .map(p => ({
        participant_id: Number(p.participant_id),
        class_name: p.class_name || 'Unbekannt'
      }));

    const payload = {
      name: computedName,
      event_type: trimmedType,
      date: eventDate,
      note: runNote.trim(),
      participants: validParticipants
    };

    try {
      const res = await fetch(`${backendUrl}/runs/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        goto('/runs');
      } else {
        const errorData = await res.json().catch(() => null);
        alert(`Run konnte nicht erstellt werden (Status ${res.status}).\n${JSON.stringify(errorData || res.statusText)}`);
      }
    } catch (err) {
      console.error(err);
      alert('Netzwerkfehler beim Erstellen des Runs.');
    }
  }

  onMount(() => {
    if (checkAdminAccess()) {
      fetchAvailableParticipants();
    }
  });
</script>

<div class="header">
  <a href="/runs" class="back-link">← Zurück zur Übersicht</a>
  <h1>Neuen Event-Run anlegen</h1>
</div>

<!-- RAID HELPER IMPORT BOX -->
<section class="card raid-helper-card">
  <h2>⚡ Import aus Raid-Helper</h2>
  <p class="import-desc">Gib die Event-ID aus Discord ein, um Name, Datum und angemeldete Spieler automatisch einzulesen.</p>
  <div class="import-row">
    <input 
      type="text" 
      placeholder="Raid-Helper Event ID (z.B. 112233445566)" 
      bind:value={raidHelperId}
      class="import-input" 
    />
    <button type="button" class="import-btn" on:click={importFromRaidHelper} disabled={isFetchingRaidHelper}>
      {isFetchingRaidHelper ? 'Lade...' : '📥 Event Importieren'}
    </button>
  </div>
</section>

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
      <p class="status-text">Lade verfügbare Spieler...</p>
    {:else if availableParticipants.length === 0}
      <p class="status-text">Keine Spieler in den Stammdaten gefunden. Lege zuerst welche unter <strong>Teilnehmer</strong> an!</p>
    {:else}
      <div class="dynamic-list">
        {#each selectedParticipants as entry, index}
          <div class="row">
            <select bind:value={selectedParticipants[index].participant_id} class="select-player" required>
              <option value="">-- Spieler wählen --</option>
              {#each availableParticipants as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>

            <select bind:value={selectedParticipants[index].class_name} class="select-class">
              <option value="">-- Klasse wählen --</option>
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

  <div class="actions">
    <button type="submit" class="submit-btn">Run anlegen</button>
  </div>
</form>

<style>
  .header { margin-bottom: 1.5rem; }
  .back-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; }
  .back-link:hover { color: #fbbf24; }
  h1 { color: #fbbf24; margin-top: 0.5rem; }
  h2 { font-size: 1.1rem; color: #f8fafc; margin-bottom: 1rem; }
  
  .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
  
  .raid-helper-card { border-color: #6366f1; background-color: #1e1b4b; }
  .raid-helper-card h2 { color: #a5b4fc; }
  .import-desc { color: #c7d2fe; font-size: 0.85rem; margin-top: -0.5rem; margin-bottom: 1rem; }
  .import-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .import-input { flex: 1; min-width: 220px; border-color: #6366f1 !important; }
  .import-btn { background-color: #4f46e5; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .import-btn:hover { background-color: #4338ca; }
  .import-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .form-grid { display: flex; flex-wrap: wrap; gap: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; min-width: 200px; }
  .full-width { width: 100%; flex: 100%; }
  label { font-size: 0.875rem; font-weight: 600; color: #94a3b8; }
  input, select { padding: 0.6rem 0.8rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 6px; color: white; font-size: 0.95rem; }
  input:focus, select:focus { outline: none; border-color: #fbbf24; }
  .dynamic-list { display: flex; flex-direction: column; gap: 0.6rem; }
  .row { display: flex; gap: 0.5rem; align-items: center; }
  .select-player, .select-class { flex: 1; }
  .add-btn { background-color: #334155; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; align-self: flex-start; font-size: 0.85rem; margin-top: 0.4rem; }
  .add-btn:hover { background-color: #475569; }
  .remove-btn { background-color: #ef4444; color: white; border: none; padding: 0.6rem 0.8rem; border-radius: 6px; cursor: pointer; }
  .remove-btn:hover { background-color: #dc2626; }
  .submit-btn { background-color: #d97706; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; font-size: 1rem; }
  .submit-btn:hover { background-color: #b45309; }
  .status-text { color: #94a3b8; }
</style>