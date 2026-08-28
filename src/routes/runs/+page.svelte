<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let runs = [];
  let availableParticipants = [];
  let masterItems = []; 
  let isLoading = true;
  let errorMessage = '';
  
  let expandedRunIds = new Set();
  let editingParticipants = {};
  let editingItems = {};
  let addingSaleForItemId = {};

  let participantInputs = {};
  let itemInputs = {};
  let saleInputs = {};

  const roClasses = [
    'Lord Knight', 'High Wizard', 'Sniper', 'High Priest', 'Whitesmith', 'Assassin Cross',
    'Paladin', 'Professor', 'Clown', 'Gypsy', 'Champion', 'Creator', 'Stalker',
    'Gunslinger', 'Ninja', 'Star Gladiator', 'Super Novice', 'Sonstiges'
  ];

  function getMasterItem(itemId) {
    if (!itemId) return null;
    return masterItems.find(m => Number(m.item_id || m.id) === Number(itemId)) || null;
  }

  function getItemName(itemId, fallbackName) {
    const master = getMasterItem(itemId);
    if (master && master.name) return master.name;
    if (fallbackName && fallbackName !== 'Unbekannt' && !fallbackName.startsWith('Item #')) {
      return fallbackName;
    }
    return itemId ? `Item #${itemId}` : 'Unbekanntes Item';
  }

  // Ermittelt die Bild-URL analog zur Item-Seite
  function getItemIconUrl(itemId) {
    const master = getMasterItem(itemId);
    if (master && (master.image_url || master.icon_url || master.icon)) {
      return master.image_url || master.icon_url || master.icon;
    }
    return itemId ? `/items/${itemId}.png` : '/items/default.png';
  }

  // Error-Handling für Bilder genau wie auf der Item-Seite
  function handleImgError(e, itemId) {
    const img = e.target;
    if (img.src.endsWith('.png')) {
      img.src = `/items/${itemId || 501}.gif`;
    } else if (img.src.endsWith('.gif')) {
      img.onerror = null;
      img.src = '/items/default.png';
    }
  }

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
        fetch(`${backendUrl}/runs/${runId}/items`)
      ]);

      let loadedParticipants = [];
      let loadedItems = [];

      if (partsRes.ok) loadedParticipants = await partsRes.json();
      if (itemsRes.ok) loadedItems = await itemsRes.json();

      loadedItems = loadedItems.map(item => {
        const id = item.item_id ?? item.master_item_id ?? item.id;
        return {
          ...item,
          item_id: id ? Number(id) : null,
          name: getItemName(id, item.name || item.item_name)
        };
      });

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
      const [partsRes, itemsRes] = await Promise.all([
        fetch(`${backendUrl}/participants/`),
        fetch(`${backendUrl}/items/`)
      ]);

      if (itemsRes.ok) masterItems = await itemsRes.json();
      if (partsRes.ok) availableParticipants = await partsRes.json();

      const runsRes = await fetch(`${backendUrl}/runs/`);
      if (runsRes.ok) {
        const loadedRuns = await runsRes.json();
        runs = loadedRuns;
        
        await Promise.all(loadedRuns.map(r => loadRunDetails(r.id)));
      } else {
        errorMessage = `Fehler beim Laden der Runs (Status: ${runsRes.status})`;
      }
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
    if (input.list.some(p => Number(p.participant_id) === selectedId)) {
      alert('Dieser Teilnehmer befindet sich bereits in der Liste!');
      return;
    }

    const pObj = availableParticipants.find(p => Number(p.id) === selectedId);
    input.list = [...input.list, { participant_id: selectedId, name: pObj ? pObj.name : 'Unbekannt', class_name: input.newClass || 'Unbekannt' }];
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
      }
    } catch (err) {
      console.error(err);
    }
  }

  // --- DROPS / ITEMS EDITIEREN ---
  function enableItemEditing(run) {
    itemInputs[run.id] = {
      list: run.items ? run.items.map(item => {
        const id = item.item_id ?? item.master_item_id ?? item.id;
        return {
          item_id: id ? Number(id) : null,
          name: getItemName(id, item.name || item.item_name),
          amount: item.amount || item.quantity || 1
        };
      }) : [],
      newNameOrId: '',
      newAmount: 1
    };
    editingItems[run.id] = true;
  }

  function addItemToBuffer(runId) {
    const input = itemInputs[runId];
    if (!input.newNameOrId.trim()) return;

    const rawInput = input.newNameOrId.trim();
    const query = rawInput.toLowerCase();

    const matchedMasterItem = masterItems.find(
      i => String(i.item_id || i.id) === query ||
           i.name.toLowerCase() === query ||
           `${i.name} (id: ${i.item_id || i.id})`.toLowerCase() === query
    );

    let finalItemId = null;
    let finalName = rawInput;

    if (matchedMasterItem) {
      finalItemId = Number(matchedMasterItem.item_id ?? matchedMasterItem.id);
      finalName = matchedMasterItem.name;
    } else if (!isNaN(query)) {
      finalItemId = Number(query);
      finalName = getItemName(finalItemId, finalName);
    }

    input.list = [
      ...input.list, 
      { 
        item_id: finalItemId,
        name: finalName,
        amount: Number(input.newAmount) || 1 
      }
    ];

    input.newNameOrId = '';
    input.newAmount = 1;
    itemInputs = { ...itemInputs };
  }

  function removeItemFromBuffer(runId, index) {
    itemInputs[runId].list.splice(index, 1);
    itemInputs[runId].list = [...itemInputs[runId].list];
    itemInputs = { ...itemInputs };
  }

  async function saveItems(runId) {
    const updatedList = itemInputs[runId].list.map(item => {
      const resolvedId = item.item_id ? Number(item.item_id) : null;
      const resolvedName = getItemName(resolvedId, item.name);

      return {
        item_id: resolvedId,
        name: resolvedName,
        amount: Number(item.amount) || 1,
        quantity: Number(item.amount) || 1
      };
    });

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
        const errDetails = await res.json().catch(() => null);
        alert(`Fehler beim Speichern (HTTP ${res.status}):\n${JSON.stringify(errDetails || res.statusText)}`);
      }
    } catch (err) {
      console.error(err);
      alert('Netzwerkfehler beim Speichern der Items.');
    }
  }

  // --- VERKAUF FÜR EIN ITEM HINZUFÜGEN ---
  function openSaleForm(runItemId) {
    saleInputs[runItemId] = { price: '', isShop: false };
    addingSaleForItemId[runItemId] = true;
  }

  async function saveSaleForItem(runId, runItem) {
    const input = saleInputs[runItem.id];
    if (!input || !input.price || input.price <= 0) {
      alert('Bitte gib einen gültigen Verkaufspreis ein.');
      return;
    }

    const payload = {
      run_item_id: runItem.id,
      item_id: runItem.item_id || null,
      amount: runItem.amount || runItem.quantity || 1,
      price: Number(input.price),
      is_shop: Boolean(input.isShop)
    };

    try {
      const res = await fetch(`${backendUrl}/runs/${runId}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        addingSaleForItemId[runItem.id] = false;
        await loadRunDetails(runId);
      } else {
        alert('Verkauf konnte nicht gespeichert werden.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  function formatZeny(amount) {
    return new Intl.NumberFormat('de-DE').format(amount || 0) + ' z';
  }

  onMount(() => {
    fetchData();
  });
</script>

<datalist id="master-items-list">
  {#each masterItems as item}
    <option value={item.name}>{item.name}</option>
  {/each}
</datalist>

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

          {#if isExpanded}
            <div class="run-details">
              <div class="details-grid">
                
                <div class="detail-block participant-block">
                  <h3>👥 Teilnehmer ({run.participants ? run.participants.length : 0})</h3>
                  {#if !editingParticipants[run.id]}
                    {#if run.participants && run.participants.length > 0}
                      <ul>
                        {#each run.participants as p, i}
                          <li>
                            <span><strong class="num-prefix">{i + 1}.</strong> {p.name}</span>
                            {#if p.class_name}<span class="class-tag">{p.class_name}</span>{/if}
                          </li>
                        {/each}
                      </ul>
                    {:else}
                      <p class="empty-text">Keine Teilnehmer eingetragen</p>
                    {/if}
                    <button type="button" class="action-btn" on:click={() => enableParticipantEditing(run)}>✏️ Edit</button>
                  {:else}
                    <ul class="edit-list">
                      {#each participantInputs[run.id].list as p, idx}
                        <li class="edit-row">
                          <span class="edit-name"><strong class="num-prefix">{idx + 1}.</strong> {p.name}</span>
                          <select bind:value={p.class_name} class="small-select inline-select">
                            {#each roClasses as roClass}<option value={roClass}>{roClass}</option>{/each}
                          </select>
                          <button type="button" class="del-btn" on:click={() => removeParticipantFromBuffer(run.id, idx)}>✕</button>
                        </li>
                      {/each}
                    </ul>
                    <div class="add-row">
                      <select bind:value={participantInputs[run.id].newParticipantId} class="small-select">
                        <option value="">-- Spieler wählen --</option>
                        {#each availableParticipants.filter(ap => !participantInputs[run.id].list.some(p => Number(p.participant_id) === Number(ap.id))) as ap}
                          <option value={ap.id}>{ap.name}</option>
                        {/each}
                      </select>
                      <select bind:value={participantInputs[run.id].newClass} class="small-select">
                        <option value="">-- Klasse --</option>
                        {#each roClasses as roClass}<option value={roClass}>{roClass}</option>{/each}
                      </select>
                      <button type="button" class="mini-add-btn" on:click={() => addParticipantToBuffer(run.id)}>+</button>
                    </div>
                    <div class="btn-group">
                      <button type="button" class="save-btn" on:click={() => saveParticipants(run.id)}>Speichern</button>
                      <button type="button" class="cancel-btn" on:click={() => editingParticipants[run.id] = false}>Abbrechen</button>
                    </div>
                  {/if}
                </div>

                <div class="detail-block item-block">
                  <h3>📦 Drops / Items ({run.items ? run.items.length : 0})</h3>
                  
                  {#if !editingItems[run.id]}
                    {#if run.items && run.items.length > 0}
                      <ul class="items-sales-list">
                        {#each run.items as item}
                          {@const iconSrc = getItemIconUrl(item.item_id)}
                          <li class="item-sale-row">
                            <div class="item-info">
                              <span class="item-qty">{item.amount || item.quantity || 1}x</span>
                              
                              <img 
                                src={iconSrc} 
                                alt={item.name} 
                                class="item-icon-img"
                                on:error={(e) => handleImgError(e, item.item_id)} 
                              />

                              <span class="item-name">{getItemName(item.item_id, item.name || item.item_name)}</span>
                            </div>

                            <div class="sale-action-area">
                              {#if item.sale_price || item.price || item.actual_price}
                                <span class="price-tag">{formatZeny(item.sale_price || item.actual_price || item.price)}</span>
                                {#if item.is_shop || item.sale_type === 'Shop'}
                                  <span class="shop-badge">Shop (-2%)</span>
                                {/if}
                              {:else if addingSaleForItemId[item.id]}
                                <div class="inline-sale-form">
                                  <input 
                                    type="number" 
                                    placeholder="Preis" 
                                    bind:value={saleInputs[item.id].price} 
                                    class="price-input" 
                                  />
                                  <label class="checkbox-label">
                                    <input type="checkbox" bind:checked={saleInputs[item.id].isShop} />
                                    Shop
                                  </label>
                                  <button type="button" class="save-mini-btn" on:click={() => saveSaleForItem(run.id, item)}>✓</button>
                                  <button type="button" class="cancel-mini-btn" on:click={() => addingSaleForItemId[item.id] = false}>✕</button>
                                </div>
                              {:else}
                                <button type="button" class="add-sale-btn" on:click={() => openSaleForm(item.id)}>
                                  + Verkauf hinzufügen
                                </button>
                              {/if}
                            </div>
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
                        {@const iconSrc = getItemIconUrl(item.item_id)}
                        <li class="edit-row">
                          <span class="item-info">
                            <span class="item-qty">{item.amount || 1}x</span>
                            <img 
                              src={iconSrc} 
                              alt={item.name} 
                              class="item-icon-img" 
                              on:error={(e) => handleImgError(e, item.item_id)} 
                            />
                            <span>{getItemName(item.item_id, item.name)}</span>
                          </span>
                          <button type="button" class="del-btn" on:click={() => removeItemFromBuffer(run.id, idx)}>✕</button>
                        </li>
                      {/each}
                    </ul>

                    <div class="add-row">
                      <input 
                        type="number" 
                        min="1" 
                        placeholder="Anzahl" 
                        bind:value={itemInputs[run.id].newAmount}
                        class="qty-field"
                      />
                      <input 
                        type="text" 
                        placeholder="Item Name oder ID" 
                        list="master-items-list"
                        bind:value={itemInputs[run.id].newNameOrId}
                        class="small-input"
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
  
  /* Top-Ausrichtung für das Grid */
  .details-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 1rem; align-items: start; }
  
  @media (max-width: 768px) {
    .details-grid { grid-template-columns: 1fr; }
  }

  /* Blöcke richten Inhalte oben aus */
  .detail-block { 
    background-color: #1e293b; 
    padding: 0.8rem; 
    border-radius: 6px; 
    border: 1px solid #334155; 
    display: flex; 
    flex-direction: column; 
    justify-content: flex-start;
    align-items: stretch;
  }
  
  .detail-block h3 { font-size: 0.9rem; color: #fbbf24; margin-top: 0; margin-bottom: 0.5rem; }
  .detail-block ul { list-style: none; padding: 0; margin: 0 0 0.8rem 0; width: 100%; }
  .detail-block li { display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; color: #e2e8f0; padding: 0.4rem 0; border-bottom: 1px dashed #334155; }
  
  .num-prefix { color: #fbbf24; font-weight: 600; margin-right: 0.3rem; }
  .class-tag { background-color: #334155; color: #38bdf8; font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; }
  
  .action-btn { background-color: #334155; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; align-self: flex-start; margin-top: 0.5rem; }
  .action-btn:hover { background-color: #475569; }

  .edit-list { margin-bottom: 0.5rem !important; }
  .edit-row { background-color: #0f172a; padding: 0.3rem 0.5rem !important; border-radius: 4px; margin-bottom: 0.2rem; display: flex; justify-content: space-between; align-items: center; }
  .del-btn { background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; }
  
  .add-row { display: flex; gap: 0.4rem; margin-bottom: 0.6rem; align-items: center; flex-wrap: wrap; }
  .small-select, .small-input { flex: 2; min-width: 140px; padding: 0.4rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 4px; color: white; font-size: 0.8rem; }
  .qty-field { width: 65px; padding: 0.4rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 4px; color: white; font-size: 0.8rem; }
  .mini-add-btn { background-color: #d97706; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.8rem; }

  .items-sales-list { margin-bottom: 0.5rem !important; }
  .item-sale-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  
  /* Reihenfolge: Menge -> Icon -> Name */
  .item-info { display: flex; align-items: center; gap: 0.5rem; }
  .item-qty { color: #fbbf24; font-weight: 600; font-size: 0.85rem; min-width: 24px; }
  .item-icon-img { width: 24px; height: 24px; object-fit: contain; vertical-align: middle; }
  .item-name { font-weight: 500; }
  
  .sale-action-area { display: flex; align-items: center; gap: 0.5rem; }
  .price-tag { color: #34d399; font-weight: 600; font-size: 0.85rem; }
  .add-sale-btn { background-color: #064e3b; color: #6ee7b7; border: 1px solid #047857; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
  .add-sale-btn:hover { background-color: #047857; color: white; }

  .inline-sale-form { display: flex; align-items: center; gap: 0.3rem; }
  .price-input { width: 80px; padding: 0.2rem 0.4rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 4px; color: white; font-size: 0.75rem; }
  .checkbox-label { font-size: 0.75rem; color: #cbd5e1; display: flex; align-items: center; gap: 0.2rem; cursor: pointer; }
  .save-mini-btn { background: #059669; color: white; border: none; padding: 0.2rem 0.4rem; border-radius: 3px; cursor: pointer; font-size: 0.75rem; }
  .cancel-mini-btn { background: #475569; color: white; border: none; padding: 0.2rem 0.4rem; border-radius: 3px; cursor: pointer; font-size: 0.75rem; }
  .shop-badge { background: #7c2d12; color: #fdba74; font-size: 0.7rem; padding: 0.1rem 0.3rem; border-radius: 3px; font-weight: 600; }

  .btn-group { display: flex; gap: 0.4rem; margin-top: 0.5rem; }
  .save-btn { background-color: #059669; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
  .cancel-btn { background-color: #475569; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }

  .status-text { color: #94a3b8; }
  .empty-text { font-size: 0.85rem; color: #64748b; font-style: italic; margin-bottom: 0.5rem; }
  .error { color: #ef4444; }
</style>