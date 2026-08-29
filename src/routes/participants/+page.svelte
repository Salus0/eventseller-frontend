<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let participants = [];
  let newName = '';
  let newDiscordId = '';
  let isLoading = true;
  let errorMessage = '';

  // Helper State zum Namen-Sync via Raid-Helper
  let raidHelperEventId = '';
  let isFetchingDiscordName = false;

  // Auth & Admin Status
  let isAdmin = false;
  let jwtToken = '';

  // Zustand für das Editieren
  let editingId = null;
  let editName = '';
  let editDiscordId = '';

  function checkAdminStatus() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      jwtToken = token;
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
        isAdmin = decoded.role === 'admin';
      } catch (e) {
        isAdmin = false;
      }
    } else {
      isAdmin = false;
      jwtToken = '';
    }
  }

  async function loadParticipants() {
    isLoading = true;
    errorMessage = '';
    try {
      const res = await fetch(`${backendUrl}/participants/`);
      if (res.ok) {
        participants = await res.json();
      } else {
        errorMessage = 'Fehler beim Laden der Teilnehmer.';
      }
    } catch (err) {
      console.error(err);
      errorMessage = 'Verbindungsfehler zum Backend!';
    } finally {
      isLoading = false;
    }
  }

// Discord-Name aus einlesen
  async function fetchNameFromRaidHelper(discordIdToFind, targetMode = 'create') {
    const trimmedDiscordId = discordIdToFind ? discordIdToFind.trim() : '';
    const trimmedEventId = raidHelperEventId.trim();

    if (!trimmedDiscordId) {
      alert('Bitte trage zuerst eine Discord ID ein.');
      return;
    }
    if (!trimmedEventId) {
      alert('Bitte gib oben eine Raid-Helper Event ID ein, um den Namen daraus abzufragen.');
      return;
    }

    isFetchingDiscordName = true;
    try {
      // WICHTIG: Ruft deinen Backend-Proxy auf statt direkt raid-helper.dev
      const res = await fetch(`${backendUrl}/raidhelper/event/${trimmedEventId}`);
      
      if (!res.ok) {
        const errDetail = await res.json().catch(() => null);
        console.error('Backend-Fehler:', errDetail);
        alert(`Event konnte nicht geladen werden (Status ${res.status}). Bitte Event-ID und Server-Logs prüfen.`);
        return;
      }

      const data = await res.json();
      const signups = data.signUps || data.signups || [];

      // Suche nach der Discord ID im Event
      const foundSignup = signups.find(s => {
        const uid = String(s.userId || s.discordId || '').trim();
        return uid === trimmedDiscordId;
      });

      if (foundSignup) {
        const fetchedName = (foundSignup.name || foundSignup.discordName || '').trim();
        if (fetchedName) {
          if (targetMode === 'create') {
            newName = fetchedName;
          } else if (targetMode === 'edit') {
            editName = fetchedName;
          }
          alert(`Name "${fetchedName}" erfolgreich übernommen!`);
        } else {
          alert('Spieler gefunden, aber es konnte kein Name ausgelesen werden.');
        }
      } else {
        alert('Kein Spieler mit dieser Discord ID in diesem Raid-Helper Event gefunden.');
      }
    } catch (err) {
      console.error('Netzwerk- oder Parsing-Fehler:', err);
      alert(`Netzwerkfehler: ${err.message}`);
    } finally {
      isFetchingDiscordName = false;
    }
  }

  async function addParticipant() {
    if (!isAdmin) {
      alert('Keine Berechtigung! Nur Admins dürfen Teilnehmer anlegen.');
      return;
    }

    if (!newName.trim()) return;

    try {
      const res = await fetch(`${backendUrl}/participants/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ 
          name: newName.trim(),
          discord_id: newDiscordId.trim() || null
        })
      });

      if (res.ok) {
        newName = '';
        newDiscordId = '';
        await loadParticipants();
      } else {
        alert('Teilnehmer konnte nicht angelegt werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Anlegen des Teilnehmers.');
    }
  }

  function startEditing(participant) {
    if (!isAdmin) return;
    editingId = participant.id;
    editName = participant.name;
    editDiscordId = participant.discord_id || participant.discordId || '';
  }

  function cancelEditing() {
    editingId = null;
    editName = '';
    editDiscordId = '';
  }

  async function saveParticipant(id) {
    if (!isAdmin) {
      alert('Keine Berechtigung!');
      return;
    }

    if (!editName.trim()) {
      alert('Der Name darf nicht leer sein.');
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/participants/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ 
          name: editName.trim(),
          discord_id: editDiscordId.trim() || null
        })
      });

      if (res.ok) {
        editingId = null;
        editName = '';
        editDiscordId = '';
        await loadParticipants();
      } else {
        alert('Änderung konnte nicht gespeichert werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Aktualisieren des Teilnehmers.');
    }
  }

  onMount(() => {
    checkAdminStatus();
    loadParticipants();
  });
</script>

<div class="header-action">
  <h1>Teilnehmer Verwaltung</h1>
</div>

{#if isAdmin}
  <!-- HELPER BOX: RAID HELPER EVENT ID FÜR NAMEN-SYNC -->
  <section class="card sync-card">
    <h2>⚡ Discord-Namen Sync via Raid-Helper (Optional)</h2>
    <p class="sync-desc">Gib hier eine Event-ID ein, um beim Eintragen/Bearbeiten von Discord-IDs den Namen automatisch aus Raid-Helper abzufragen.</p>
    <input 
      type="text" 
      placeholder="Raid-Helper Event ID (z.B. 112233445566)" 
      bind:value={raidHelperEventId} 
      class="input-field sync-input" 
    />
  </section>

  <!-- Nur Admins dürfen neue Teilnehmer anlegen -->
  <section class="card margin-top">
    <h2>Neuen Teilnehmer anlegen</h2>
    <form on:submit|preventDefault={addParticipant} class="add-form">
      <input 
        type="text" 
        placeholder="Name des Teilnehmers *" 
        bind:value={newName} 
        class="input-field" 
        required
      />
      <input 
        type="text" 
        placeholder="Discord ID (Optional)" 
        bind:value={newDiscordId} 
        class="input-field" 
      />
      <button 
        type="button" 
        class="sync-btn" 
        on:click|preventDefault={() => fetchNameFromRaidHelper(newDiscordId, 'create')}
        disabled={isFetchingDiscordName}
      >
        🔍 Name ziehen
      </button>
      <button type="submit" class="create-btn">+ Hinzufügen</button>
    </form>
  </section>
{/if}

<section class="card margin-top">
  <h2>Alle Teilnehmer ({participants.length})</h2>

  {#if isLoading}
    <p class="status-text">Lade Teilnehmer...</p>
  {:else if errorMessage}
    <p class="error">{errorMessage}</p>
  {:else if participants.length === 0}
    <p class="status-text">Noch keine Teilnehmer eingetragen.</p>
  {:else}
    <ul class="participant-list">
      {#each participants as p, i (p.id)}
        {@const currentDiscordId = p.discord_id || p.discordId}
        <li class="participant-item">
          <span class="num">{i + 1}.</span>

          {#if editingId === p.id && isAdmin}
            <!-- Bearbeitungs-Modus (Nur Admins) -->
            <div class="edit-fields">
              <input 
                type="text" 
                bind:value={editName} 
                class="input-field edit-input"
                placeholder="Name *"
                on:keydown={(e) => e.key === 'Enter' && saveParticipant(p.id)}
              />
              <input 
                type="text" 
                bind:value={editDiscordId} 
                class="input-field edit-input"
                placeholder="Discord ID"
                on:keydown={(e) => e.key === 'Enter' && saveParticipant(p.id)}
              />
              <button 
                type="button" 
                class="sync-btn-small" 
                on:click={() => fetchNameFromRaidHelper(editDiscordId, 'edit')}
                disabled={isFetchingDiscordName}
                title="Namen aus Raid-Helper Event ziehen"
              >
                🔍
              </button>
            </div>
            <div class="btn-group">
              <button type="button" class="save-btn" on:click={() => saveParticipant(p.id)}>Speichern</button>
              <button type="button" class="cancel-btn" on:click={cancelEditing}>Abbrechen</button>
            </div>
          {:else}
            <!-- Normaler Anzeige-Modus -->
            <div class="info-group">
              <span class="name">{p.name}</span>
              {#if currentDiscordId}
                <code class="discord-badge">ID: {currentDiscordId}</code>
              {/if}
            </div>
            {#if isAdmin}
              <button type="button" class="action-btn" on:click={() => startEditing(p)}>✏️ Edit</button>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .header-action { margin-bottom: 1.5rem; }
  h1 { color: #fbbf24; margin: 0; }
  .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; }
  .margin-top { margin-top: 1.5rem; }
  h2 { color: #f8fafc; font-size: 1.1rem; margin-top: 0; margin-bottom: 1rem; }

  .sync-card { border-color: #6366f1; background-color: #1e1b4b; }
  .sync-card h2 { color: #a5b4fc; }
  .sync-desc { color: #c7d2fe; font-size: 0.85rem; margin-top: -0.5rem; margin-bottom: 1rem; }
  .sync-input { max-width: 350px; border-color: #6366f1 !important; }

  .add-form { display: flex; flex-wrap: wrap; gap: 0.5rem; max-width: 750px; }
  .input-field { flex: 1; min-width: 160px; padding: 0.5rem 0.8rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 6px; color: white; font-size: 0.9rem; }
  .edit-input { min-width: 130px; }

  .sync-btn { background-color: #4f46e5; color: white; border: none; padding: 0.5rem 0.8rem; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; font-size: 0.85rem; }
  .sync-btn:hover { background-color: #4338ca; }
  .sync-btn-small { background-color: #4f46e5; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; }
  .sync-btn-small:hover { background-color: #4338ca; }

  .create-btn { background-color: #d97706; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .create-btn:hover { background-color: #b45309; }

  .participant-list { list-style: none; padding: 0; margin: 0; max-width: 750px; }
  .participant-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem; border-bottom: 1px solid #334155; background-color: #0f172a; margin-bottom: 0.4rem; border-radius: 6px; }
  .num { color: #fbbf24; font-weight: 600; min-width: 25px; }
  
  .info-group { flex: 1; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .name { color: #f8fafc; font-weight: 500; }
  .discord-badge { background-color: #1e1b4b; color: #818cf8; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid #312e81; font-family: monospace; }

  .edit-fields { flex: 1; display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }

  .action-btn { background-color: #334155; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
  .action-btn:hover { background-color: #475569; }

  .btn-group { display: flex; gap: 0.4rem; }
  .save-btn { background-color: #059669; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
  .cancel-btn { background-color: #475569; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }

  .status-text { color: #94a3b8; }
  .error { color: #ef4444; }
</style>