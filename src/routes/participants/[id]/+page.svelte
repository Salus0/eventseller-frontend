<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';
  const participantId = $page.params.id;

  let participant = null;
  let payouts = [];
  let characters = [];
  
  let isLoading = true;
  let errorMessage = '';

  // Zustand für das Einblenden des Charakter-Bearbeitungsbereichs
  let showCharacterForm = false;

  // Formular-Felder für neuen Charakter
  let newAccountNumber = '';
  let selectedClass = 'Lord Knight';
  let selectedBuild = 'Spiral Pierce';
  let newCharName = '';

  let isAdmin = false;

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

  function checkAdminStatus() {
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
      } catch (e) {
        isAdmin = false;
      }
    }
  }

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

      // 1. Participant laden
      const pRes = await fetch(`${backendUrl}/participants/${participantId}`, { headers });
      if (pRes.ok) {
        participant = await pRes.json();
      } else {
        errorMessage = 'Teilnehmer konnte nicht geladen werden.';
        return;
      }

      // 2. Charaktere laden
      const cRes = await fetch(`${backendUrl}/participants/${participantId}/characters`, { headers });
      if (cRes.ok) {
        characters = await cRes.json();
      }

      // 3. Auszahlungen laden
      const payoutRes = await fetch(`${backendUrl}/participants/${participantId}/payouts`, { headers });
      if (payoutRes.ok) {
        payouts = await payoutRes.json();
      }
    } catch (err) {
      console.error(err);
      errorMessage = 'Fehler beim Laden der Daten.';
    } finally {
      isLoading = false;
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
        showCharacterForm = false; // Formular nach Erfolg wieder zuklappen
        await loadData();
      } else {
        alert('Charakter konnte nicht hinzugefügt werden.');
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
        alert('Fehler beim Löschen des Charakters.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Berechnete Kennzahlen für Auszahlungen
  $: totalPayout = payouts.reduce((sum, p) => sum + (p.payout_amount || 0), 0);
  $: paidRunsCount = payouts.length;
  $: averagePayoutPerRun = paidRunsCount > 0 ? Math.round(totalPayout / paidRunsCount) : 0;

  function formatZeny(val) {
    return (val || 0).toLocaleString('de-DE') + ' Zeny';
  }

  onMount(() => {
    checkAdminStatus();
    loadData();
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
  <header class="header-action">
    <h1>👤 Teilnehmer-Detail: {participant.name}</h1>
  </header>

  <div class="stack-container">
    
    <!-- BEREICH 1: CHARAKTERE & ACCOUNTS (Untereinander angeordnet) -->
    <section class="card">
      <div class="section-header-row">
        <h2>⚔️ Charaktere & Accounts</h2>
        <button class="btn btn-secondary btn-small" on:click={() => showCharacterForm = !showCharacterForm}>
          {showCharacterForm ? '✖ Schließen' : '✏️ Charakter bearbeiten'}
        </button>
      </div>
      
      {#if showCharacterForm}
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
                      {#if isAdmin}
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

    <!-- BEREICH 2: AUSZAHLUNGEN & STATISTIKEN (Untereinander angeordnet) -->
    <section class="card">
      <h2>💰 Auszahlungen & Statistik</h2>

      <div class="stats-grid">
        <div class="stat-box green">
          <span class="stat-title">Gesamtsumme Ausgezahlt</span>
          <span class="stat-value total-zeny">{formatZeny(totalPayout)}</span>
        </div>
        <div class="stat-box blue">
          <span class="stat-title">Durchschnitt je Run</span>
          <span class="stat-value split-zeny">{formatZeny(averagePayoutPerRun)}</span>
        </div>
      </div>

      <h3>Auszahlungs-Historie (Abgeschlossene Runs)</h3>
      {#if payouts.length === 0}
        <p class="status-text">Bisher keine ausgezahlten Runs vorhanden.</p>
      {:else}
        <div class="table-container">
          <table class="item-table">
            <thead>
              <tr>
                <th>Run-Name</th>
                <th>Datum</th>
                <th class="text-right">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {#each payouts as payout}
                <tr>
                  <td>
                    <a href="/runs/{payout.run_id}" class="run-link">
                      {payout.run_name || `Run #${payout.run_id}`}
                    </a>
                  </td>
                  <td class="date-cell">{payout.date || '-'}</td>
                  <td class="text-right price-cell">
                    {formatZeny(payout.payout_amount)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

  </div>
{/if}