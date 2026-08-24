<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let runs = [];
  let availableParticipants = [];
  let isLoading = true;
  let errorMessage = '';
  
  let expandedRunIds = new Set();
  let editingParticipants = {};
  let editingItems = {};

  let participantInputs = {};
  let itemInputs = {};

  const roClasses = [
    'Rune Knight', 'Warlock', 'Ranger', 'Arch Bishop', 'Mechanic', 'Guillotine Cross',
    'Royal Guard', 'Sorcerer', 'Minstrel', 'Wanderer', 'Genetic', 'Shadow Chaser',
    'Soul Reaper', 'Star Emperor', 'Kagerou/Oboro', 'Rebellion', 'Super Novice', 'Sonstiges'
  ];

  async function toggleExpand(id) {
    if (expandedRunIds.has(id)) {
      expandedRunIds.delete(id);
    } else {
      expandedRunIds.add(id);
      await loadRunDetails(id);
    }
    expandedRunIds = expandedRunIds;
  }

  async function loadRunDetails(runId) {
    try {
      const [partsRes, itemsRes] = await Promise.all([
        fetch(`${backendUrl}/runs/${runId}/participants`),
        fetch(`${backendUrl}/runs/${runId}/sales`)
      ]);

      let loadedParticipants = [];
      let loadedItems = [];

      if (partsRes.ok) loadedParticipants = await partsRes.json();
      if (itemsRes.ok) loadedItems = await itemsRes.json();

      runs = runs.map(r => {
        if (r.id === runId) {
          return {
            ...r,
            participants: loadedParticipants,
            items: loadedItems
          };
        }
        return r;
      });
    } catch (err) {
      console.error(`Fehler beim Nachladen der Details für Run ${runId}:`, err);
    }
  }

  async function fetchData() {
    isLoading = true;
    errorMessage = '';
    try {
      const [runsRes, partsRes] = await Promise.all([
        fetch(`${backendUrl}/runs/`),
        fetch(`${backendUrl}/participants/`)
      ]);

      if (runsRes.ok) {
        runs = await runsRes.json();
        for (const run of runs) {
          loadRunDetails(run.id);
        }
      } else {
        errorMessage = `Fehler beim Laden der Runs (Status: ${runsRes.status})`;
      }

      if (partsRes.ok) availableParticipants = await partsRes.json();
    } catch (err) {
      errorMessage = 'Verbindungsfehler zum Backend!';
      console.error(err);
    } finally {
      isLoading = false;
    }
  }

  // --- TEILNEHMER EDITIEREN ---
  function enableParticipantEditing(run) {
    participantInputs[run.id] = {
      list: run.participants ? JSON.parse(JSON.stringify(run.participants)) : [],
      newParticipantId: '',
      newClass: ''
    };
    editingParticipants[run.id] = true;
  }

  function addParticipantToBuffer(runId) {
    const input = participantInputs[runId];
    if (!input.newParticipantId) return;

    const selectedId = Number(input.newParticipantId);

    // Duplikat-Sicherheitsprüfung
    const isAlreadyInList = input.list.some(p => Number(p.participant_id) === selectedId);
    if (isAlreadyInList) {
      alert('Dieser Teilnehmer befindet sich bereits in der Liste!');
      return;
    }

    const pObj = availableParticipants.find(p => Number(p.id) === selectedId);
    const pName = pObj ? pObj.name : 'Unbekannt';

    // Garantiert UNTEN anhängen (Reihenfolge 1, 2, 3... bleibt erhalten)
    input.list = [
      ...input.list,
      {
        participant_id: selectedId,
        name: pName,
        class_name: input.newClass || 'Unbekannt'
      }
    ];

    input.newParticipantId = '';
    input.newClass = '';
    participantInputs = { ...participantInputs };
  }

  function removeParticipantFromBuffer(runId, index) {
    participantInputs[runId].list.splice(index, 1);
    participantInputs[runId].list = [...participantInputs[runId].list];
    participantInputs = { ...participantInputs };
  }

  async function saveParticipants(runId) {
    const updatedList = participantInputs[runId].list.map(p => ({
      participant_id: Number(p.participant_id),
      class_name: p.class_name || 'Unbekannt'
    }));

    try {
      const res = await fetch(`${backendUrl}/runs/${runId}/participants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedList)
      });

      if (res.ok) {
        editingParticipants[runId] = false;
        await loadRunDetails(runId);
      } else {
        alert('Teilnehmer konnten nicht gespeichert werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Speichern der Teilnehmer.');
    }
  }

  // --- ITEMS / DROPS EDITIEREN ---
  function enableItemEditing(run) {
    itemInputs[run.id] = {
      list: run.items ? JSON.parse(JSON.stringify(run.items)) : [],
      newName: '',
      newQuantity: 1
    };
    editingItems[run.id] = true;
  }

  function addItemToBuffer(runId) {
    const input = itemInputs[runId];
    if (!input.newName.trim()) return;

    input.list = [
      ...input.list,
      {
        name: input.newName.trim(),
        quantity: input.newQuantity || 1
      }
    ];

    input.newName = '';
    input.newQuantity = 1;
    itemInputs = { ...itemInputs };
  }

  function removeItemFromBuffer(runId, index) {
    itemInputs[runId].list.splice(index, 1);
    itemInputs[runId].list = [...itemInputs[runId].list];
    itemInputs = { ...itemInputs };
  }

  async function saveItems(runId) {
    const updatedList = itemInputs[runId].list;
    try {
      const res = await fetch(`${backendUrl}/runs/${runId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedList)
      });

      if (res.ok) {
        editingItems[runId] = false;
        await loadRunDetails(runId);
      } else {
        alert('Items konnten nicht gespeichert werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Speichern der Items.');
    }
  }

  onMount(() => {
    fetchData();
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
        {@const isExpanded = expandedRunIds.has(run.id)}
        <li class="run-item">
          <!-- Header -->
          <div class="run-header" on:click={() => toggleExpand(run.id)} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && toggleExpand(run.id)}>
            <div class="run-info">
              <span class="run-name">{run.name}</span>
              {#if run.run_type}
                <span class="run-meta">📌 {run.run_type}</span>
              {/if}
            </div>

            <div class="header-right">
              <span class="badge">{run.status || 'Aktiv'}</span>
              <button class="expand-btn" type="button">
                {isExpanded ? '▲ Verbergen' : '▼ Details'}
              </button>
            </div>
          </div>

          <!-- Detailbereich -->
          {#if isExpanded}
            <div class="run-details">
              <div class="details-grid">
                
                <!-- BEREICH 1: TEILNEHMER -->
                <div class="detail-block">
                  <h3>👥 Teilnehmer ({run.participants ? run.participants.length : 0})</h3>

                  {#if !editingParticipants[run.id]}
                    {#if run.participants && run.participants.length > 0}
                      <ul>
                        {#each run.participants as p, i}
                          <li>
                            <span><strong class="num-prefix">{i + 1}.</strong> {p.name}</span>
                            {#if p.class_name}
                              <span class="class-tag">{p.class_name}</span>
                            {/if}
                          </li>
                        {/each}
                      </ul>
                    {:else}
                      <p class="empty-text">Keine Teilnehmer eingetragen</p>
                    {/if}

                    <button type="button" class="action-btn" on:click={() => enableParticipantEditing(run)}>
                      ✏️ Edit
                    </button>

                  {:else}
                    <!-- Editier-Ansicht -->
                    <ul class="edit-list">
                      {#each participantInputs[run.id].list as p, idx}
                        <li class="edit-row">
                          <span class="edit-name"><strong class="num-prefix">{idx + 1}.</strong> {p.name}</span>
                          <select bind:value={p.class_name} class="small-select inline-select">
                            {#each roClasses as roClass}
                              <option value={roClass}>{roClass}</option>
                            {/each}
                          </select>
                          <button type="button" class="del-btn" on:click={() => removeParticipantFromBuffer(run.id, idx)}>✕</button>
                        </li>
                      {/each}
                    </ul>

                    <div class="add-row">
                      <!-- Dropdown filtert bereits ausgewählte Teilnehmer automatisch heraus -->
                      <select bind:value={participantInputs[run.id].newParticipantId} class="small-select">
                        <option value="">-- Spieler wählen --</option>
                        {#each availableParticipants.filter(ap => !participantInputs[run.id].list.some(p => Number(p.participant_id) === Number(ap.id))) as ap}
                          <option value={ap.id}>{ap.name}</option>
                        {/each}
                      </select>

                      <select bind:value={participantInputs[run.id].newClass} class="small-select">
                        <option value="">-- Klasse --</option>
                        {#each roClasses as roClass}
                          <option value={roClass}>{roClass}</option>
                        {/each}
                      </select>

                      <button type="button" class="mini-add-btn" on:click={() => addParticipantToBuffer(run.id)}>+</button>
                    </div>

                    <div class="btn-group">
                      <button type="button" class="save-btn" on:click={() => saveParticipants(run.id)}>Speichern</button>
                      <button type="button" class="cancel-btn" on:click={() => editingParticipants[run.id] = false}>Abbrechen</button>
                    </div>
                  {/if}
                </div>

                <!-- BEREICH 2: ITEMS / DROPS -->
                <div class="detail-block">
                  <h3>📦 Drops / Items ({run.items ? run.items.length : 0})</h3>

                  {#if !editingItems[run.id]}
                    {#if run.items && run.items.length > 0}
                      <ul>
                        {#each run.items as item}
                          <li>
                            <span class="item-name">{item.item_name || item.name}</span>
                            <span class="item-qty">x{item.quantity || item.amount || 1}</span>
                          </li>
                        {/each}
                      </ul>
                    {:else}
                      <p class="empty-text">Keine Items eingetragen</p>
                    {/if}

                    <button type="button" class="action-btn" on:click={() => enableItemEditing(run)}>
                      ➕ Add/Edit
                    </button>

                  {:else}
                    <ul class="edit-list">
                      {#each itemInputs[run.id].list as item, idx}
                        <li class="edit-row">
                          <span>{item.name || item.item_name} (x{item.quantity || 1})</span>
                          <button type="button" class="del-btn" on:click={() => removeItemFromBuffer(run.id, idx)}>✕</button>
                        </li>
                      {/each}
                    </ul>

                    <div class="add-row">
                      <input 
                        type="text" 
                        placeholder="Item Name" 
                        bind:value={itemInputs[run.id].newName}
                        class="small-input"
                      />
                      <input 
                        type="number" 
                        min="1" 
                        placeholder="Anzahl" 
                        bind:value={itemInputs[run.id].newQuantity}
                        class="qty-field"
                      />
                      <button type="button" class="mini-add-btn" on:click={() => addItemToBuffer(run.id)}>+</button>
                    </div>

                    <div class="btn-group">
                      <button type="button" class="save-btn" on:click={() => saveItems(run.id)}>Speichern</button>
                      <button type="button" class="cancel-btn" on:click={() => editingItems[run.id] = false}>Abbrechen</button>
                    </div>
                  {/if}
                </div>

              </div>
            </div>
          {/if}
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
  .run-item { background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; margin-bottom: 0.75rem; overflow: hidden; }
  .run-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; cursor: pointer; user-select: none; }
  .run-header:hover { background-color: #1a2436; }
  
  .run-info { display: flex; flex-direction: column; gap: 0.25rem; }
  .run-name { font-weight: 600; color: #f8fafc; font-size: 1.05rem; }
  .run-meta { font-size: 0.85rem; color: #94a3b8; }
  .header-right { display: flex; align-items: center; gap: 0.75rem; }
  .badge { background-color: #059669; color: white; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 4px; }
  .expand-btn { background: none; border: 1px solid #475569; color: #cbd5e1; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }

  .run-details { padding: 1rem; border-top: 1px solid #334155; background-color: #090d16; }
  .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
  .detail-block { background-color: #1e293b; padding: 0.8rem; border-radius: 6px; border: 1px solid #334155; display: flex; flex-direction: column; justify-content: space-between; }
  .detail-block h3 { font-size: 0.9rem; color: #fbbf24; margin-top: 0; margin-bottom: 0.5rem; }
  
  .detail-block ul { list-style: none; padding: 0; margin: 0 0 0.8rem 0; }
  .detail-block li { display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; color: #e2e8f0; padding: 0.3rem 0; border-bottom: 1px dashed #334155; }
  .num-prefix { color: #fbbf24; font-weight: 600; margin-right: 0.3rem; }
  .class-tag { background-color: #334155; color: #38bdf8; font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; }
  
  .action-btn { background-color: #334155; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; align-self: flex-start; margin-top: 0.5rem; }
  .action-btn:hover { background-color: #475569; }

  .edit-list { margin-bottom: 0.5rem !important; }
  .edit-row { background-color: #0f172a; padding: 0.3rem 0.5rem !important; border-radius: 4px; margin-bottom: 0.2rem; display: flex; gap: 0.5rem; align-items: center; }
  .edit-name { flex: 1; }
  .inline-select { flex: 1; max-width: 140px; }
  .del-btn { background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; }
  
  .add-row { display: flex; gap: 0.3rem; margin-bottom: 0.6rem; }
  .small-select, .small-input { flex: 1; padding: 0.3rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 4px; color: white; font-size: 0.8rem; }
  .qty-field { width: 50px; padding: 0.3rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 4px; color: white; font-size: 0.8rem; }
  .mini-add-btn { background-color: #d97706; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-weight: bold; }
  
  .btn-group { display: flex; gap: 0.4rem; }
  .save-btn { background-color: #059669; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
  .cancel-btn { background-color: #475569; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }

  .status-text { color: #94a3b8; }
  .empty-text { font-size: 0.85rem; color: #64748b; font-style: italic; margin-bottom: 0.5rem; }
  .error { color: #ef4444; }
</style>
