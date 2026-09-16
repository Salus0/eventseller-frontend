<script>
  import RunCard from '$lib/components/RunCard.svelte';
  import { parseJwt } from '$lib/utils/jwt';
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';
  import { page } from '$app/stores';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let runs = [];
  let availableParticipants = [];
  let masterItems = []; 
  let isLoading = true;
  let errorMessage = '';

  // Auth & Rechte
  let isAdmin = false;
  let isSeller = false;
  let canEdit = false;
  let jwtToken = '';

  let expandedRunIds = new Set();
  let loadingDetailsIds = new Set();

  // KONTROLLE FÜR DIE ABGESCHLOSSENE RUNS SEKTION (Initial zugeklappt)
  let showClosedRuns = false;

  // ZENTRALER UI-STATE (Ersetzt die 8 einzelnen Puffer-Objekte)
  let uiState = {
    headers: {},      // [runId]: { isEditing, name, run_type }
    participants: {}, // [runId]: { isEditing, list, newParticipantId, newClass }
    items: {},        // [runId]: { isEditing, list, newNameOrId, newAmount }
    sales: {}         // [itemId]: { mode: 'add'|'edit', price, priceDisplay, isShop, saleDate }
  };

  const roClasses = [
    'Lord Knight', 'High Wizard', 'Sniper', 'High Priest', 'Whitesmith', 'Assassin Cross',
    'Paladin', 'Professor', 'Clown', 'Gypsy', 'Champion', 'Creator', 'Stalker',
    'Gunslinger', 'Ninja', 'Star Gladiator', 'Super Novice', 'Sonstiges'
  ];

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function toLocalDatetimeInput(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function getAuthHeaders() {
    const token = localStorage.getItem('jwt_token') || jwtToken;
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  function checkAdminStatus() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      jwtToken = token;
      const decoded = parseJwt(token);
      if (decoded) {
        const userRole = (decoded.role || '').toLowerCase();
        isAdmin = userRole === 'admin';
        isSeller = userRole === 'seller';
        canEdit = isAdmin || isSeller;
      }
    } else {
      isAdmin = false; isSeller = false; canEdit = false; jwtToken = '';
    }
  }

  function getMasterItem(rawId) {
    if (rawId === null || rawId === undefined || rawId === '') return null;
    const num = Number(rawId);
    if (isNaN(num)) return null;
    return masterItems.find(m => Number(m?.item_id) === num || Number(m?.ro_item_id) === num || Number(m?.id) === num) || null;
  }

  function getROItemId(item) {
    if (!item) return null;
    const master = getMasterItem(item.item_id ?? item.ro_item_id ?? item.master_item_id);
    if (master) {
      const masterRoId = master.item_id ?? master.ro_item_id;
      if (masterRoId) return Number(masterRoId);
    }
    const directId = item.item_id ?? item.ro_item_id ?? item.master_item_id;
    return directId && !isNaN(Number(directId)) ? Number(directId) : null;
  }

  function getItemName(item, fallbackName) {
    const roId = getROItemId(item);
    const master = getMasterItem(roId);
    if (master && master.name) return master.name;
    if (fallbackName && fallbackName !== 'Unbekannt' && !fallbackName.startsWith('Item #')) return fallbackName;
    return roId ? `Item #${roId}` : 'Unbekanntes Item';
  }

  function getItemIconUrl(item) {
    if (!item) return '/items/default.png';
    const roId = getROItemId(item);
    const master = getMasterItem(roId);
    if (master && (master.image_url || master.icon_url || master.icon)) return master.image_url || master.icon_url || master.icon;
    if (item.image_url || item.icon_url || item.icon) return item.image_url || item.icon_url || item.icon;
    return roId ? `/items/${roId}.png` : '/items/default.png';
  }

  function handleImgError(e, item) {
    const img = e.target;
    if (!img) return;
    const roId = getROItemId(item);
    if (!roId) { img.onerror = null; img.src = '/items/default.png'; return; }
    if (img.src.endsWith('.png')) img.src = `/items/${roId}.gif`;
    else if (img.src.endsWith('.gif')) { img.onerror = null; img.src = '/items/default.png'; }
  }

  function getRunStatusInfo(run) {
    if (run.status) {
      const rawStatus = String(run.status).toLowerCase().trim();
      switch (rawStatus) {
        case 'closed': case 'close': return { label: 'close', cssClass: 'status-close' };
        case 'payout': case 'paid': return { label: 'Payout', cssClass: 'status-payout' };
        case 'on_sale': case 'onsale': case 'on sale': return { label: 'On Sale', cssClass: 'status-onsale' };
        case 'open': case 'offen': return { label: 'Open', cssClass: 'status-open' };
      }
    }
    const items = run.items || [];
    const participants = run.participants || [];
    const allItemsSold = items.length > 0 && items.filter(i => Boolean(i.sale_price || i.price || i.actual_price)).length === items.length;
    const allPaidOut = participants.length > 0 && participants.filter(p => p.is_paid).length === participants.length;

    if (allItemsSold && allPaidOut) return { label: 'close', cssClass: 'status-close' };
    if (allItemsSold) return { label: 'Payout', cssClass: 'status-payout' };
    if (items.length > 0) return { label: 'On Sale', cssClass: 'status-onsale' };
    return null;
  }

  function getRunTimestamp(run) {
    const dateVal = run.created_at || run.date || run.updated_at;
    return dateVal ? new Date(dateVal).getTime() || 0 : 0;
  }

  $: sortedRuns = [...runs].sort((a, b) => getRunTimestamp(b) - getRunTimestamp(a));
  $: activeRuns = sortedRuns.filter(r => getRunStatusInfo(r)?.label !== 'close');
  $: closedRuns = sortedRuns.filter(r => getRunStatusInfo(r)?.label === 'close');

  // --- RUN HEADER EDITIEREN ---
  function startEditRunHeader(run, e) {
    if (e) e.stopPropagation();
    uiState.headers[run.id] = { isEditing: true, name: run.name, run_type: run.run_type || '' };
  }

  function cancelEditRunHeader(runId, e) {
    if (e) e.stopPropagation();
    if (uiState.headers[runId]) uiState.headers[runId].isEditing = false;
  }

  async function saveRunHeader(runId, e) {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    const input = uiState.headers[runId];
    if (!input || !input.name.trim()) return alert('Bitte gib einen gültigen Run-Namen ein.');

    try {
      const res = await fetch(`${backendUrl}/runs/${runId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: input.name.trim(), run_type: input.run_type.trim() || null })
      });
      if (res.ok) {
        uiState.headers[runId].isEditing = false;
        await fetchData();
      } else alert('Fehler beim Aktualisieren des Runs.');
    } catch (err) { alert('Netzwerkfehler beim Aktualisieren.'); }
  }

  async function deleteRun(runId, runName, e) {
    if (e) e.stopPropagation();
    if (!isAdmin || !confirm(`Möchtest du den Run "${runName}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`${backendUrl}/runs/${runId}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) runs = runs.filter(r => r.id !== runId);
      else alert('Fehler beim Löschen des Runs.');
    } catch (err) { alert('Netzwerkfehler beim Löschen.'); }
  }

  // --- HELPER FÜR PREISEINGABEN ---
  function handlePriceInput(itemId, e, isEdit = false) {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!uiState.sales[itemId]) return;
    if (!rawValue) {
      uiState.sales[itemId].priceDisplay = '';
      uiState.sales[itemId].price = 0;
      return;
    }
    const num = parseInt(rawValue, 10);
    uiState.sales[itemId].price = num;
    uiState.sales[itemId].priceDisplay = new Intl.NumberFormat('de-DE').format(num);
  }

  async function toggleExpand(id) {
    if (expandedRunIds.has(id)) {
      expandedRunIds.delete(id);
    } else {
      expandedRunIds.add(id);
      const targetRun = runs.find(r => r.id === id);
      if (targetRun && !targetRun.detailsLoaded) await loadRunDetails(id);
    }
    expandedRunIds = new Set(expandedRunIds);
  }

  async function loadRunDetails(runId) {
    loadingDetailsIds.add(runId);
    loadingDetailsIds = new Set(loadingDetailsIds);
    try {
      const headers = getAuthHeaders();
      const [partsRes, itemsRes, salesRes, summaryRes] = await Promise.all([
        fetch(`${backendUrl}/runs/${runId}/participants`, { headers }),
        fetch(`${backendUrl}/runs/${runId}/items`, { headers }),
        fetch(`${backendUrl}/runs/${runId}/sales`, { headers }),
        fetch(`${backendUrl}/runs/${runId}/summary`, { headers })
      ]);

      const loadedParticipants = partsRes.ok ? await partsRes.json() : [];
      const loadedItems = itemsRes.ok ? await itemsRes.json() : [];
      const loadedSales = salesRes.ok ? await salesRes.json() : [];
      const loadedSummary = summaryRes.ok ? await summaryRes.json() : null;

      let expandedItems = [];
      loadedItems.forEach((item, itemIdx) => {
        const rawRoId = item.ro_item_id ?? item.item_id ?? item.master_item_id;
        const master = getMasterItem(rawRoId);
        const finalRoId = master ? (master.item_id ?? master.ro_item_id) : rawRoId;
        const numericRoId = finalRoId && !isNaN(Number(finalRoId)) ? Number(finalRoId) : null;
        const realDbId = item.run_drop_id ?? item.drop_id ?? item.id;
        const qty = Number(item.amount || item.quantity || 1);

        for (let i = 0; i < qty; i++) {
          const existingSale = loadedSales.find(s =>
            (Number(s.item_id) === Number(numericRoId) || Number(s.ro_item_id) === Number(numericRoId) || Number(s.id) === Number(item.sale_id)) &&
            !expandedItems.some(exp => Number(exp.sale_id) === Number(s.id))
          );

          const uniqueKey = realDbId
            ? `db-${realDbId}-${i}`
            : `run-${runId}-item-${itemIdx}-${i}-${Math.random().toString(36).substring(2, 7)}`;

          expandedItems.push({
            ...item, amount: 1, quantity: 1, id: uniqueKey,
            real_db_id: realDbId ? Number(realDbId) : null,
            ro_item_id: numericRoId,
            image_url: master?.image_url || master?.icon_url || item.image_url || null,
            name: master?.name || item.name || item.item_name || (numericRoId ? `Item #${numericRoId}` : 'Unbekanntes Item'),
            sale_id: existingSale ? existingSale.id : item.sale_id,
            sale_price: existingSale ? (existingSale.actual_price ?? existingSale.price) : (item.sale_price ?? item.price ?? 0),
            sale_type: existingSale ? (existingSale.is_shop ? 'Shop' : 'Direkt') : (item.sale_type ?? (item.is_shop ? 'Shop' : 'Direkt')),
            is_shop: existingSale ? existingSale.is_shop : item.is_shop,
            sale_date: existingSale ? (existingSale.created_at || existingSale.sale_date || existingSale.date) : (item.sale_date || item.created_at)
          });
        }
      });

      runs = runs.map(r => r.id === runId ? {
        ...r, participants: loadedParticipants, items: expandedItems, sales: loadedSales, summary: loadedSummary, detailsLoaded: true
      } : r);
    } catch (err) { console.error(err); }
    finally { loadingDetailsIds.delete(runId); loadingDetailsIds = new Set(loadingDetailsIds); }
  }

  async function fetchData() {
    isLoading = true; errorMessage = '';
    try {
      const headers = getAuthHeaders();
      const [partsRes, itemsRes] = await Promise.all([
        fetch(`${backendUrl}/participants/`, { headers }),
        fetch(`${backendUrl}/items/`, { headers })
      ]);
      if (itemsRes.ok) masterItems = await itemsRes.json();
      if (partsRes.ok) availableParticipants = await partsRes.json();

      const runsRes = await fetch(`${backendUrl}/runs/`, { headers });
      if (runsRes.ok) {
        const loadedRuns = await runsRes.json();
        runs = (Array.isArray(loadedRuns) ? loadedRuns : []).map(r => ({
          ...r, detailsLoaded: false, participants: r.participants || [], items: r.items || [], sales: r.sales || [], summary: r.summary || null
        }));

        const openIdParam = $page.url.searchParams.get('open');
        if (openIdParam && runs.some(r => r.id === Number(openIdParam))) {
          const runToOpen = Number(openIdParam);
          // Falls ein geschlossener Run via Link aufgerufen wird, klappe auch die Sektion auf
          const targetRun = runs.find(r => r.id === runToOpen);
          if (targetRun && getRunStatusInfo(targetRun)?.label === 'close') {
            showClosedRuns = true;
          }
          await toggleExpand(runToOpen);
        }
      } else if (runsRes.status === 401) errorMessage = 'Nicht autorisiert!';
      else errorMessage = `Fehler beim Laden der Runs (${runsRes.status})`;
    } catch (err) { errorMessage = 'Verbindungsfehler zum Backend!'; }
    finally { isLoading = false; }
  }

  // --- TEILNEHMER ---
  function enableParticipantEditing(run) {
    if (!canEdit) return;
    uiState.participants[run.id] = {
      isEditing: true,
      list: run.participants ? JSON.parse(JSON.stringify(run.participants)) : [],
      newParticipantId: '', newClass: ''
    };
  }

  function addParticipantToBuffer(runId) {
    const input = uiState.participants[runId];
    if (!input || !input.newParticipantId) return;
    const selectedId = Number(input.newParticipantId);
    if (input.list.some(p => Number(p.participant_id) === selectedId)) return alert('Teilnehmer bereits in der Liste!');

    const pObj = availableParticipants.find(p => Number(p.id) === selectedId);
    input.list = [...input.list, { participant_id: selectedId, name: pObj ? pObj.name : 'Unbekannt', class_name: input.newClass || 'Unbekannt', is_paid: false }];
    input.newParticipantId = ''; input.newClass = '';
  }

  function removeParticipantFromBuffer(runId, index) {
    if (uiState.participants[runId]?.list) uiState.participants[runId].list.splice(index, 1);
  }

  async function saveParticipants(runId) {
    if (!canEdit) return;
    const updatedList = (uiState.participants[runId]?.list || []).map(p => ({
      participant_id: Number(p.participant_id), class_name: p.class_name || 'Unbekannt'
    }));
    try {
      const res = await fetch(`${backendUrl}/runs/${runId}/participants`, {
        method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(updatedList)
      });
      if (res.ok) {
        uiState.participants[runId].isEditing = false;
        await loadRunDetails(runId);
      }
    } catch (err) { console.error(err); }
  }

  async function togglePayoutStatus(runId, participantId, currentStatus) {
    if (!canEdit) return;
    try {
      const res = await fetch(`${backendUrl}/runs/${runId}/participants/${participantId}/payout`, {
        method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ is_paid: !currentStatus })
      });
      if (res.ok) await loadRunDetails(runId);
    } catch (err) { console.error(err); }
  }

  // --- ITEMS ---
  function enableItemEditing(run) {
    if (!canEdit) return;
    uiState.items[run.id] = {
      isEditing: true,
      list: run.items ? run.items.map(i => ({ id: i.id, item_id: getROItemId(i), ro_item_id: getROItemId(i), name: getItemName(i, i.name), amount: 1 })) : [],
      newNameOrId: '', newAmount: 1
    };
  }

  function addItemToBuffer(runId) {
    const input = uiState.items[runId];
    if (!input || !input.newNameOrId.trim()) return;
    const rawInput = input.newNameOrId.trim().toLowerCase();
    const matchedMasterItem = masterItems.find(i => String(i.item_id || i.ro_item_id || i.id) === rawInput || i.name.toLowerCase() === rawInput);

    let finalItemId = matchedMasterItem ? Number(matchedMasterItem.item_id ?? matchedMasterItem.ro_item_id ?? matchedMasterItem.id) : (!isNaN(rawInput) ? Number(rawInput) : null);
    let finalName = matchedMasterItem ? matchedMasterItem.name : getItemName({ item_id: finalItemId }, input.newNameOrId.trim());

    const newItems = Array.from({ length: Number(input.newAmount) || 1 }, () => ({
      item_id: finalItemId, ro_item_id: finalItemId, name: finalName, amount: 1
    }));

    input.list = [...input.list, ...newItems];
    input.newNameOrId = ''; input.newAmount = 1;
  }

  function removeItemFromBuffer(runId, index) {
    if (uiState.items[runId]?.list) uiState.items[runId].list.splice(index, 1);
  }

  async function saveItems(runId) {
    if (!canEdit) return;
    const updatedList = (uiState.items[runId]?.list || []).map(item => ({
      item_id: getROItemId(item), ro_item_id: getROItemId(item), name: getItemName(item, item.name), amount: 1, quantity: 1
    }));
    try {
      const res = await fetch(`${backendUrl}/runs/${runId}/items`, {
        method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(updatedList)
      });
      if (res.ok) {
        uiState.items[runId].isEditing = false;
        await loadRunDetails(runId);
      }
    } catch (err) { console.error(err); }
  }

  // --- KONSOLIDIERTER VERKAUFS-REQUEST ---
  function openSaleForm(runItemId) {
    if (!canEdit) return;
    uiState.sales[runItemId] = { mode: 'add', price: 0, priceDisplay: '', isShop: false, saleDate: toLocalDatetimeInput() };
  }

  function startEditSale(item) {
    if (!canEdit) return;
    const currentPrice = Number(item.sale_price || item.actual_price || item.price || 0);
    const rawPrice = item.is_shop ? Math.round(currentPrice / 0.98) : currentPrice;
    uiState.sales[item.id] = {
      mode: 'edit', price: rawPrice, priceDisplay: new Intl.NumberFormat('de-DE').format(rawPrice),
      isShop: Boolean(item.is_shop || item.sale_type === 'Shop'), saleDate: toLocalDatetimeInput(item.sale_date)
    };
  }

  function closeSaleForm(runItemId) {
    if (uiState.sales[runItemId]) delete uiState.sales[runItemId];
    uiState = { ...uiState };
  }

  async function persistSale(runId, runItem, isUpdate = false) {
    if (!canEdit) return;
    const input = uiState.sales[runItem.id];
    if (!input || !input.price || Number(input.price) <= 0) return alert('Bitte gib einen gültigen Verkaufspreis ein.');

    const endpoint = isUpdate ? `${backendUrl}/runs/sales/${runItem.sale_id}` : `${backendUrl}/runs/${runId}/sales`;
    const itemId = getROItemId(runItem) || runItem.item_id || runItem.id;

    const payload = {
      ...(isUpdate ? {} : { item_id: Number(itemId) }),
      quantity: 1, actual_price: Number(input.price), is_shop: Boolean(input.isShop),
      created_at: input.saleDate ? new Date(input.saleDate).toISOString() : new Date().toISOString()
    };

    try {
      const res = await fetch(endpoint, {
        method: isUpdate ? 'PUT' : 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload)
      });
      if (res.ok) {
        closeSaleForm(runItem.id);
        await loadRunDetails(runId);
      } else alert(`Fehler beim Speichern (Status ${res.status})`);
    } catch (err) { alert('Netzwerkfehler beim Speichern des Verkaufs.'); }
  }

  async function deleteSaleForItem(runId, runItem) {
    if (!canEdit || !runItem.sale_id || !confirm(`Verkauf von "${getItemName(runItem)}" zurücksetzen?`)) return;
    try {
      const res = await fetch(`${backendUrl}/runs/sales/${runItem.sale_id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) await loadRunDetails(runId);
    } catch (err) { console.error(err); }
  }

  function formatZeny(amount) {
    return new Intl.NumberFormat('de-DE').format(amount || 0) + ' z';
  }

  onMount(() => {
    checkAdminStatus();
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
  {#if canEdit}
    <a href="/runs/new" class="btn btn-primary">+ Neuen Run anlegen</a>
  {/if}
</div>

{#if isLoading}
  <section class="card"><p class="status-text">Lade Runs...</p></section>
{:else if errorMessage}
  <section class="card"><p class="error">{errorMessage}</p></section>
{:else if runs.length === 0}
  <section class="card"><p class="status-text">{canEdit ? 'Noch keine Runs vorhanden. Klicke oben auf "+ Neuen Run anlegen"!' : 'Noch keine Runs vorhanden.'}</p></section>
{:else}
  <section class="card section-margin">
    <h2>Aktive Runs ({activeRuns.length})</h2>
    {#if activeRuns.length === 0}
      <p class="empty-text">Keine aktiven Runs vorhanden.</p>
    {:else}
      <ul class="runs-list">
        {#each activeRuns as run (run.id)}
          <RunCard
            {run}
            isExpanded={expandedRunIds.has(run.id)}
            statusInfo={getRunStatusInfo(run)}
            {canEdit}
            {isAdmin}
            {roClasses}
            {availableParticipants}
            bind:uiState
            {getItemIconUrl}
            {getROItemId}
            {getItemName}
            {handleImgError}
            {formatDate}
            {formatZeny}
            onToggleExpand={toggleExpand}
            onStartEditHeader={startEditRunHeader}
            onSaveHeader={saveRunHeader}
            onCancelEditHeader={cancelEditRunHeader}
            onDeleteRun={deleteRun}
            {togglePayoutStatus}
            {enableParticipantEditing}
            {removeParticipantFromBuffer}
            {addParticipantToBuffer}
            {saveParticipants}
            {startEditSale}
            {handlePriceInput}
            {persistSale}
            {deleteSaleForItem}
            {closeSaleForm}
            {openSaleForm}
            {enableItemEditing}
            {removeItemFromBuffer}
            {addItemToBuffer}
            {saveItems}
          />
        {/each}
      </ul>
    {/if}
  </section>

  <section class="card closed-card">
    <div
      class="list-header"
      style="cursor: pointer; user-select: none;"
      on:click={() => showClosedRuns = !showClosedRuns}
      role="button"
      tabindex="0"
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showClosedRuns = !showClosedRuns)}
    >
      <h2>Abgeschlossene Runs ({closedRuns.length})</h2>
      <button class="btn btn-secondary" type="button">
        {showClosedRuns ? '▲ Verbergen' : '▼ Anzeigen'}
      </button>
    </div>

    {#if showClosedRuns}
      {#if closedRuns.length === 0}
        <p class="empty-text">Noch keine abgeschlossenen Runs vorhanden.</p>
      {:else}
        <ul class="runs-list">
          {#each closedRuns as run (run.id)}
            <RunCard
              {run}
              isExpanded={expandedRunIds.has(run.id)}
              statusInfo={getRunStatusInfo(run)}
              {canEdit}
              {isAdmin}
              {roClasses}
              {availableParticipants}
              bind:uiState
              {getItemIconUrl}
              {getROItemId}
              {getItemName}
              {handleImgError}
              {formatDate}
              {formatZeny}
              onToggleExpand={toggleExpand}
              onStartEditHeader={startEditRunHeader}
              onSaveHeader={saveRunHeader}
              onCancelEditHeader={cancelEditRunHeader}
              onDeleteRun={deleteRun}
              {togglePayoutStatus}
              {enableParticipantEditing}
              {removeParticipantFromBuffer}
              {addParticipantToBuffer}
              {saveParticipants}
              {startEditSale}
              {handlePriceInput}
              {persistSale}
              {deleteSaleForItem}
              {closeSaleForm}
              {openSaleForm}
              {enableItemEditing}
              {removeItemFromBuffer}
              {addItemToBuffer}
              {saveItems}
            />
          {/each}
        </ul>
      {/if}
    {/if}
  </section>
{/if}