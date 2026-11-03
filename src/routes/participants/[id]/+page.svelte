<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';
  const participantId = $page.params.id;

  let participant = null;
  let characters = [];
  
  let isLoading = true;
  let errorMessage = '';

  // Zustand für das Bearbeiten des Teilnehmer-Profils (Admins)
  let isEditingParticipant = false;
  let editName = '';
  let editRole = 'user';
  let editDiscordId = '';
  let isSavingParticipant = false;

  // Zustand für das Einblenden des Charakter-Bearbeitungsbereichs
  let showCharacterForm = false;

  // Formular-Felder für neuen Charakter
  let newAccountNumber = '';
  let selectedClass = 'Lord Knight';
  let selectedBuild = 'Spiral Pierce';
  let newCharName = '';

  let isAdmin = false;
  let userDiscordId = '';

  const availableRoles = [
    { value: 'user', label: 'User' },
    { value: 'seller', label: 'Seller' },
    { value: 'admin', label: 'Admin' }
  ];

  const classSkillMap = {
    'Lord Knight': ['Spiral Pierce', 'Bowling Bash', 'Auto-Attacker', 'Sonstige'],
    'Paladin': ['Devotion', 'Grand Cross', 'Shield Chain', 'Sonstige'],
    'High Wizard': ['Damage', 'Sonstige'],
    'Scholar': ['Support', 'Abra', 'Support & Abra', 'Sonstige'],
    'Sniper': ['DS, FA, Sharpshoot', 'Crit-Autohitter', 'Sonstige'],
    'Clown': ['Support', 'Sonstige'],
    'Gypsy': ['Support', 'Sonstige'],
    'High Priest': ['Full Support', 'ME', 'Turn Undead', 'Sonstige'],
    'Champion': ['Steal Body', 'Asura', 'Sonstige'],
    'Assassin Cross': ['Crit', 'Soul Breaker', 'Sonic Blow', 'Sonstige'],
    'Stalker': ['Bow', 'Dagger', 'Full Strip', 'Sonstige'],
    'Whitesmith': ['Cart Termination', 'Forging', 'Auto-Attacker', 'Sonstige'],
    'Creator': ['Acid Bomb', 'Potter', 'FCP', 'Sonstige'],
    'Gunslinger': ['Desperado', 'Full Blast', 'Sonstige'],
    'Ninja': ['Ninjutsu', 'Huuma/Shuriken', 'Sonstige'],
    'Star Gladiator': ['SLS', 'Sonstige'],
    'Soul Linker': ['Support', 'Sonstige'],
    'Super Novice': ['Sonstige']
  };

  const classIconMap = {
    'Lord Knight': 'LordKnight.webp',
    'Paladin': 'Paladin.webp',
    'High Wizard': 'HighWizard.webp',
    'Scholar': 'Scholar.webp',
    'Sniper': 'Sniper.webp',
    'Clown': 'Clown.webp',
    'Gypsy': 'Gypsy.webp',
    'High Priest': 'HighPriest.webp',
    'Champion': 'Champion.webp',
    'Assassin Cross': 'Assa-X.webp',
    'Stalker': 'Stalker.webp',
    'Whitesmith': 'WhiteSmith.webp',
    'Creator': 'Creator.webp',
    'Gunslinger': 'Gunslinger.webp',
    'Ninja': 'Ninja.webp',
    'Star Gladiator': 'StarGladiator.webp',
    'Soul Linker': 'SoulLinker.webp',
    'Super Novice': 'SuperNovice.webp'
  };

  function checkUserStatus() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
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
        userDiscordId = decoded.discord_id || decoded.discordId || decoded.id || '';
      } catch (e) {
        isAdmin = false;
      }
    }
  }

  $: isOwner = participant && userDiscordId && (String(participant.discord_id) === String(userDiscordId));
  $: canModify = isAdmin || isOwner;

  function handleClassChange(e) {
    selectedClass = e.target.value;
    const availableBuilds = classSkillMap[selectedClass] || ['Sonstige'];
    selectedBuild = availableBuilds[0];
  }

  async function loadData() {
    isLoading = true;
    errorMessage = '';
    try {
      const token = localStorage.getItem('jwt_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const pRes = await fetch(`${backendUrl}/participants/${participantId}`, { headers });
      if (pRes.ok) {
        participant = await pRes.json();
      } else {
        errorMessage = 'Teilnehmer konnte nicht geladen werden.';
        return;
      }

      const cRes = await fetch(`${backendUrl}/participants/${participantId}/characters`, { headers });
      if (cRes.ok) {
        characters = await cRes.json();
      }
    } catch (err) {
      console.error(err);
      errorMessage = 'Fehler beim Laden der Daten.';
    } finally {
      isLoading = false;
    }
  }

  function startEditingParticipant() {
    if (!isAdmin || !participant) return;
    editName = participant.name || '';
    editRole = participant.role || 'user';
    editDiscordId = participant.discord_id || participant.discordId || '';
    isEditingParticipant = true;
  }

  function cancelEditingParticipant() {
    isEditingParticipant = false;
  }

  async function saveParticipant() {
    if (!editName.trim()) {
      alert('Der Name darf nicht leer sein.');
      return;
    }

    isSavingParticipant = true;
    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`${backendUrl}/participants/${participantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName.trim(),
          discord_id: editDiscordId.trim() || null,
          role: editRole || 'user',
          avatar: participant.avatar || null
        })
      });

      if (res.ok) {
        isEditingParticipant = false;
        await loadData();
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.detail || 'Änderung konnte nicht gespeichert werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Speichern des Teilnehmers.');
    } finally {
      isSavingParticipant = false;
    }
  }

  async function addCharacter() {
    if (!newAccountNumber.trim()) {
      alert('Bitte gib eine Account-Nummer ein.');
      return;
    }

    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`${backendUrl}/participants/${participantId}/characters`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          account_number: newAccountNumber.trim(),
          class_name: selectedClass,
          build_name: selectedBuild,
          name: newCharName.trim() || null
        })
      });

      if (res.ok) {
        newAccountNumber = '';
        newCharName = '';
        showCharacterForm = false; 
        await loadData();
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.detail || 'Charakter konnte nicht hinzugefügt werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Speichern des Charakters.');
    }
  }

  async function deleteCharacter(charId) {
    if (!confirm('Möchtest du diesen Charakter wirklich löschen?')) return;

    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`${backendUrl}/participants/${participantId}/characters/${charId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await loadData();
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.detail || 'Fehler beim Löschen des Charakters.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  onMount(async () => {
    checkUserStatus();
    await loadData();
  });
</script>

<div class="back-nav">
  <a href="/participants" class="back-link">← Zurück zur Übersicht</a>
</div>

{#if isLoading}
  <p class="status-text">Lade Details...</p>
{:else if errorMessage}
  <p class="error">{errorMessage}</p>
{:else if participant}
  {@const discordId = participant.discord_id || participant.discordId}
  {@const discordAvatar = participant.avatar || participant.discord_avatar}
  {@const role = participant.role || 'user'}

  <header class="header-action">
    <h1>Teilnehmer Infoseite</h1>
  </header>

  <div class="stack-container">
    
    <!-- TEILNEHMER-HEADER (Einzeilig / Tabellarisch) -->
    <section class="card participant-info-widget">
      {#if isEditingParticipant && isAdmin}
        <!-- BEARBEITUNGS-MODUS ZEILE -->
        <form on:submit|preventDefault={saveParticipant} class="edit-fields">
          <input 
            type="text" 
            bind:value={editName} 
            class="input-field input-sm" 
            placeholder="Name *" 
            required 
          />
          <select bind:value={editRole} class="input-field input-sm">
            {#each availableRoles as r}
              <option value={r.value}>{r.label}</option>
            {/each}
          </select>
          <input 
            type="text" 
            bind:value={editDiscordId} 
            class="input-field input-sm" 
            placeholder="Discord ID" 
          />

          <div class="btn-group">
            <button type="submit" class="btn btn-primary btn-small" disabled={isSavingParticipant}>
              Speichern
            </button>
            <button type="button" class="btn btn-secondary btn-small" on:click={cancelEditingParticipant}>
              Abbrechen
            </button>
        </div>
        </form>
      {:else}
        <!-- NORMALER EINZEILIGER TABELLEN-ANZEIGE-MODUS -->
        <div class="participant-header-row">
          <div class="participant-header-info">
        <div class="user-avatar-wrapper">
          {#if discordId && discordAvatar}
            <img 
              src="https://cdn.discordapp.com/avatars/{discordId}/{discordAvatar}.png" 
              alt={participant.name} 
              class="avatar-img" 
            />
          {:else}
            <div class="avatar-fallback">
              {participant.name ? participant.name.charAt(0).toUpperCase() : '?'}
            </div>
          {/if}
        </div>

            <span class="name">{participant.name}</span>

            <span class="badge {role === 'admin' ? 'admin' : role === 'seller' ? 'status-payout' : 'status-onsale'}">
              {role}
            </span>

            {#if discordId}
              <code class="discord-badge">ID: {discordId}</code>
            {:else}
              <span class="discord-id text-muted">Keine Discord ID</span>
            {/if}
      </div>

          {#if isAdmin}
            <button type="button" class="btn btn-secondary btn-small" on:click={startEditingParticipant}>
              ✏️ Edit
            </button>
        {/if}
      </div>
      {/if}
    </section>

    <!-- BEREICH: CHARAKTERE & ACCOUNTS -->
    <section class="card margin-top">
      <div class="section-header-row">
        <h2>⚔️ Charaktere & Accounts</h2>
        {#if canModify}
        <button class="btn btn-secondary btn-small" on:click={() => showCharacterForm = !showCharacterForm}>
          {showCharacterForm ? '✖ Schließen' : '✏️ Charaktere bearbeiten'}
        </button>
        {/if}
      </div>
      
      {#if showCharacterForm && canModify}
        <form on:submit|preventDefault={addCharacter} class="add-char-form margin-top">
          <input 
            type="text" 
            placeholder="Account-Nr. (z.B. 1,2,3)" 
            bind:value={newAccountNumber} 
            class="input-field" 
            required 
          />
          
          <div class="class-select-wrapper">
            {#if classIconMap[selectedClass]}
              <img 
                src="/classicons/{classIconMap[selectedClass]}" 
                alt={selectedClass} 
                class="icon-preview" 
              />
            {/if}
            <select bind:value={selectedClass} on:change={handleClassChange} class="input-field select-dropdown">
              {#each Object.keys(classSkillMap) as cls}
                <option value={cls}>{cls}</option>
              {/each}
            </select>
          </div>

          <select bind:value={selectedBuild} class="input-field select-dropdown">
            {#each (classSkillMap[selectedClass] || []) as build}
              <option value={build}>{build}</option>
            {/each}
          </select>

          <input 
            type="text" 
            placeholder="Ingame-Name (optional)" 
            bind:value={newCharName} 
            class="input-field" 
          />

          <button type="submit" class="btn btn-primary">+ Hinzufügen</button>
        </form>
      {/if}

      <div class="char-list margin-top">
        {#if characters.length === 0}
          <p class="status-text">Noch keine Charaktere eingetragen.</p>
        {:else}
          <div class="table-container">
            <table class="item-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Klasse</th>
                  <th>Skillung</th>
                  <th>Name</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each characters as char}
                  <tr>
                    <td><span class="badge-acc">{char.account_number}</span></td>
                    <td class="class-td">
                      <div class="class-content-wrapper">
                        {#if classIconMap[char.class_name]}
                          <img src="/classicons/{classIconMap[char.class_name]}" alt="" class="table-icon" />
                        {/if}
                        {char.class_name}
                      </div>
                    </td>
                    <td>{char.build_name}</td>
                    <td><strong>{char.name || '-'}</strong></td>
                    <td class="text-right">
                      {#if canModify}
                        <button class="btn btn-danger btn-small" on:click={() => deleteCharacter(char.id)} title="Löschen">🗑️</button>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </section>

  </div>
{/if}