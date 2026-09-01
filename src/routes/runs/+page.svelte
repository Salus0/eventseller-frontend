<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';
  import { page } from '$app/stores';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let runs = [];
  let availableParticipants = [];
  let masterItems = []; 
  let isLoading = true;
  let errorMessage = '';

  // Auth & Admin Status
  let isAdmin = false;
  let jwtToken = '';
  
  let expandedRunIds = new Set();
  let editingRunHeader = {};  // Inline-Edit Modus für Run-Name/Typ
  let runHeaderInputs = {};   // Eingabepuffer für Run-Name/Typ

  let editingParticipants = {};
  let editingItems = {};
  let addingSaleForItemId = {};
  let editingSaleForItemId = {}; // State für die Inline-Bearbeitung von Verkäufen

  let participantInputs = {};
  let itemInputs = {};
  let saleInputs = {};
  let editSaleInputs = {}; // Eingabepuffer für das Editieren eines Verkaufs

  const roClasses = [
    'Lord Knight', 'High Wizard', 'Sniper', 'High Priest', 'Whitesmith', 'Assassin Cross',
    'Paladin', 'Professor', 'Clown', 'Gypsy', 'Champion', 'Creator', 'Stalker',
    'Gunslinger', 'Ninja', 'Star Gladiator', 'Super Novice', 'Sonstiges'
  ];

  // Helper zum Formatieren von UTC/ISO-Daten in DD.MM.YY, HH:mm
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  // Helper um ISO Date für datetime-local Input Vorzubelegen (YYYY-MM-THH:mm)
  function toLocalDatetimeInput(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Helper zum Erzeugen der Standard-Auth-Header
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

  function getMasterItem(rawId) {
    if (rawId === null || rawId === undefined || rawId === '') return null;
    const num = Number(rawId);
    if (isNaN(num)) return null;

    return masterItems.find(m => 
      Number(m?.item_id) === num || 
      Number(m?.ro_item_id) === num || 
      Number(m?.id) === num
    ) || null;
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
    if (fallbackName && fallbackName !== 'Unbekannt' && !fallbackName.startsWith('Item #')) {
      return fallbackName;
    }
    return roId ? `Item #${roId}` : 'Unbekanntes Item';
  }

  function getItemIconUrl(item) {
    if (!item) return '/items/default.png';
    
    const roId = getROItemId(item);
    const master = getMasterItem(roId);
    
    if (master && (master.image_url || master.icon_url || master.icon)) {
      return master.image_url || master.icon_url || master.icon;
    }
    if (item.image_url || item.icon_url || item.icon) {
      return item.image_url || item.icon_url || item.icon;
    }

    return roId ? `/items/${roId}.png` : '/items/default.png';
  }

  function handleImgError(e, item) {
    const img = e.target;
    if (!img) return;
    const roId = getROItemId(item);

    if (!roId) {
      img.onerror = null;
      img.src = '/items/default.png';
      return;
    }

    if (img.src.endsWith('.png')) {
      img.src = `/items/${roId}.gif`;
    } else if (img.src.endsWith('.gif')) {
      img.onerror = null;
      img.src = '/items/default.png';
    }
  }

  // --- DYNAMISCHE STATUS-BERECHNUNG ---
  function getRunStatusInfo(run) {
    const items = run.items || [];
    const participants = run.participants || [];

    const totalItems = items.length;
    const soldItems = items.filter(i => Boolean(i.sale_price || i.price || i.actual_price)).length;
    const allItemsSold = totalItems > 0 && soldItems === totalItems;

    const totalParticipants = participants.length;
    const paidParticipants = participants.filter(p => p.is_paid).length;
    const allPaidOut = totalParticipants > 0 && paidParticipants === totalParticipants;

    if (allItemsSold && allPaidOut) {
      return { label: 'Close', cssClass: 'status-close' };
    }
    if (allItemsSold) {
      return { label: 'Payout', cssClass: 'status-payout' };
    }
    if (soldItems > 0) {
      return { label: 'On Sale', cssClass: 'status-onsale' };
    }
    return { label: 'Open', cssClass: 'status-open' };
  }

  // Helper zum Ermitteln des Zeitstempels für die Datums-Sortierung
  function getRunTimestamp(run) {
    const dateVal = run.created_at || run.date || run.updated_at;
    if (!dateVal) return 0;
    return new Date(dateVal).getTime() || 0;
  }

  // --- REAKTIVE SORTIERUNG & KATEGORISIERUNG ---
  $: sortedRuns = [...runs].sort((a, b) => getRunTimestamp(b) - getRunTimestamp(a));
  $: activeRuns = sortedRuns.filter(r => getRunStatusInfo(r).label !== 'Close');
  $: closedRuns = sortedRuns.filter(r => getRunStatusInfo(r).label === 'Close');

  // --- RUN HEADER EDITIEREN & LÖSCHEN ---
  function startEditRunHeader(run, e) {
    if (e) e.stopPropagation();
    runHeaderInputs[run.id] = { name: run.name, run_type: run.run_type || '' };
    editingRunHeader[run.id] = true;
    editingRunHeader = { ...editingRunHeader };
  }

  function cancelEditRunHeader(runId, e) {
    if (e) e.stopPropagation();
    editingRunHeader[runId] = false;
    editingRunHeader = { ...editingRunHeader };
  }

  async function saveRunHeader(runId, e) {
    if (e) e.stopPropagation();
    if (!isAdmin) return;

    const input = runHeaderInputs[runId];
    if (!input || !input.name.trim()) {
      alert('Bitte gib einen gültigen Run-Namen ein.');
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/runs/${runId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: input.name.trim(),
          run_type: input.run_type.trim() || null
        })
      });

      if (res.ok) {
        editingRunHeader[runId] = false;
        editingRunHeader = { ...editingRunHeader };
        await fetchData();
      } else {
        alert('Fehler beim Aktualisieren des Runs.');
      }
    } catch (err) {
      console.error(err);
      alert('Netzwerkfehler beim Aktualisieren.');
    }
  }

  async function deleteRun(runId, runName, e) {
    if (e) e.stopPropagation();
    if (!isAdmin) return;

    if (!confirm(`Möchtest du den Run "${runName}" wirklich löschen?`)) return;

    try {
      const res = await fetch(`${backendUrl}/runs/${runId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        runs = runs.filter(r => r.id !== runId);
      } else {
        alert('Fehler beim Löschen des Runs.');
      }
    } catch (err) {
      console.error(err);
      alert('Netzwerkfehler beim Löschen des Runs.');
    }
  }

  // --- 1000er TRENNPUNKTE FORMATIERUNG BEIM EINGEBEN ---
  function handlePriceInput(runItemId, e) {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
      saleInputs[runItemId].priceDisplay = '';
      saleInputs[runItemId].price = 0;
      return;
    }
    const num = parseInt(rawValue, 10);
    saleInputs[runItemId].price = num;
    saleInputs[runItemId].priceDisplay = new Intl.NumberFormat('de-DE').format(num);
  }

  function handleEditPriceInput(runItemId, e) {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
      editSaleInputs[runItemId].priceDisplay = '';
      editSaleInputs[runItemId].price = 0;
      return;
    }
    const num = parseInt(rawValue, 10);
    editSaleInputs[runItemId].price = num;
    editSaleInputs[runItemId].priceDisplay = new Intl.NumberFormat('de-DE').format(num);
  }

  async function toggleExpand(id) {
    if (expandedRunIds.has(id)) {
      expandedRunIds.delete(id);
    } else {
      expandedRunIds.add(id);
      await loadRunDetails(id);
    }
    expandedRunIds = new Set(expandedRunIds);
  }

  async function loadRunDetails(runId) {
    try {
      const headers = getAuthHeaders();
      const [partsRes, itemsRes, salesRes, summaryRes] = await Promise.all([
        fetch(`${backendUrl}/runs/${runId}/participants`, { headers }),
        fetch(`${backendUrl}/runs/${runId}/items`, { headers }),
        fetch(`${backendUrl}/runs/${runId}/sales`, { headers }),
        fetch(`${backendUrl}/runs/${runId}/summary`, { headers })
      ]);

      let loadedParticipants = [];
      let loadedItems = [];
      let loadedSales = [];
      let loadedSummary = null;

      if (partsRes.ok) loadedParticipants = await partsRes.json();
      if (itemsRes.ok) loadedItems = await itemsRes.json();
      if (salesRes.ok) loadedSales = await salesRes.json();
      if (summaryRes.ok) loadedSummary = await summaryRes.json();

      // Mehrfach-Drops beim Laden in Einzel-Items mit Stückzahl 1 aufspalten
      let expandedItems = [];
      (Array.isArray(loadedItems) ? loadedItems : []).forEach((item) => {
        const rawRoId = item.ro_item_id ?? item.item_id ?? item.master_item_id;
        const master = getMasterItem(rawRoId);
        const finalRoId = master ? (master.item_id ?? master.ro_item_id) : rawRoId;
        const numericRoId = finalRoId && !isNaN(Number(finalRoId)) ? Number(finalRoId) : null;
        const realDbId = item.run_drop_id ?? item.drop_id ?? item.id;
        const qty = Number(item.amount || item.quantity || 1);

        for (let i = 0; i < qty; i++) {
          // Zuordnung bestehender Verkäufe ohne Doppelbelegung
          const existingSale = Array.isArray(loadedSales) ? loadedSales.find(s => 
            (Number(s.item_id) === Number(numericRoId) || Number(s.ro_item_id) === Number(numericRoId) || Number(s.id) === Number(item.sale_id)) &&
            !expandedItems.some(exp => Number(exp.sale_id) === Number(s.id))
          ) : null;

          expandedItems.push({
            ...item,
            amount: 1,
            quantity: 1,
            id: realDbId ? `${realDbId}-${i}` : (numericRoId ? `${numericRoId}-${i}` : `${runId}-item-${expandedItems.length}`),
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

      runs = runs.map(r => {
        if (r.id === runId) {
          return {
            ...r,
            participants: Array.isArray(loadedParticipants) ? loadedParticipants : [],
            items: expandedItems,
            sales: loadedSales,
            summary: loadedSummary
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
        runs = Array.isArray(loadedRuns) ? loadedRuns : [];
        await Promise.all(runs.map(r => loadRunDetails(r.id)));

        // AUTO-OPEN & SCROLL LOGIK
        const openIdParam = $page.url.searchParams.get('open');
        if (openIdParam) {
          const runToOpen = Number(openIdParam);
          if (runs.some(r => r.id === runToOpen)) {
            await toggleExpand(runToOpen);
            setTimeout(() => {
              document.getElementById(`run-${runToOpen}`)?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }
        }
      } else if (runsRes.status === 401) {
        errorMessage = 'Nicht autorisiert! Bitte neu einloggen.';
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
    if (!isAdmin) return;
    participantInputs[run.id] = {
      list: run.participants ? JSON.parse(JSON.stringify(run.participants)) : [],
      newParticipantId: '',
      newClass: ''
    };
    editingParticipants[run.id] = true;
  }

  function addParticipantToBuffer(runId) {
    const input = participantInputs[runId];
    if (!input || !input.newParticipantId) return;

    const selectedId = Number(input.newParticipantId);
    if (input.list.some(p => Number(p.participant_id) === selectedId)) {
      alert('Dieser Teilnehmer befindet sich bereits in der Liste!');
      return;
    }

    const pObj = availableParticipants.find(p => Number(p.id) === selectedId);
    input.list = [...input.list, { participant_id: selectedId, name: pObj ? pObj.name : 'Unbekannt', class_name: input.newClass || 'Unbekannt', is_paid: false }];
    input.newParticipantId = '';
    input.newClass = '';
    participantInputs = { ...participantInputs };
  }

  function removeParticipantFromBuffer(runId, index) {
    if (!participantInputs[runId]?.list) return;
    participantInputs[runId].list.splice(index, 1);
    participantInputs[runId].list = [...participantInputs[runId].list];
    participantInputs = { ...participantInputs };
  }

  async function saveParticipants(runId) {
    if (!isAdmin) return;
    const updatedList = (participantInputs[runId]?.list || []).map(p => ({
      participant_id: Number(p.participant_id),
      class_name: p.class_name || 'Unbekannt'
    }));

    try {
      const res = await fetch(`${backendUrl}/runs/${runId}/participants`, {
        method: 'PUT',
        headers: getAuthHeaders(),
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

  async function togglePayoutStatus(runId, participantId, currentStatus) {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${backendUrl}/runs/${runId}/participants/${participantId}/payout`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_paid: !currentStatus })
      });
      if (res.ok) {
        await loadRunDetails(runId);
      } else {
        alert('Auszahlungsstatus konnte nicht geändert werden.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // --- DROPS / ITEMS EDITIEREN ---
  function enableItemEditing(run) {
    if (!isAdmin) return;
    itemInputs[run.id] = {
      list: run.items ? run.items.map(item => {
        const roId = getROItemId(item);
        return {
          id: item.id,
          item_id: roId,
          ro_item_id: roId,
          name: getItemName(item, item.name || item.item_name),
          amount: 1
        };
      }) : [],
      newNameOrId: '',
      newAmount: 1
    };
    editingItems[run.id] = true;
  }

  function addItemToBuffer(runId) {
    const input = itemInputs[runId];
    if (!input || !input.newNameOrId.trim()) return;

    const rawInput = input.newNameOrId.trim();
    const query = rawInput.toLowerCase();

    const matchedMasterItem = masterItems.find(
      i => String(i.item_id || i.ro_item_id || i.id) === query ||
           i.name.toLowerCase() === query ||
           `${i.name} (id: ${i.item_id || i.ro_item_id || i.id})`.toLowerCase() === query
    );

    let finalItemId = null;
    let finalName = rawInput;

    if (matchedMasterItem) {
      finalItemId = Number(matchedMasterItem.item_id ?? matchedMasterItem.ro_item_id ?? matchedMasterItem.id);
      finalName = matchedMasterItem.name;
    } else if (!isNaN(query)) {
      finalItemId = Number(query);
      finalName = getItemName({ item_id: finalItemId }, finalName);
    }

    const amountToTake = Number(input.newAmount) || 1;
    const newItemsArray = [];

    // Jedes Item einzeln mit Stückzahl 1 anlegen
    for (let i = 0; i < amountToTake; i++) {
      newItemsArray.push({
        item_id: finalItemId,
        ro_item_id: finalItemId,
        name: finalName,
        amount: 1
      });
    }

    input.list = [...input.list, ...newItemsArray];

    input.newNameOrId = '';
    input.newAmount = 1;
    itemInputs = { ...itemInputs };
  }

  function removeItemFromBuffer(runId, index) {
    if (!itemInputs[runId]?.list) return;
    itemInputs[runId].list.splice(index, 1);
    itemInputs[runId].list = [...itemInputs[runId].list];
    itemInputs = { ...itemInputs };
  }

  async function saveItems(runId) {
    if (!isAdmin) return;
    const updatedList = (itemInputs[runId]?.list || []).map(item => {
      const resolvedId = getROItemId(item);
      const resolvedName = getItemName(item, item.name);

      return {
        item_id: resolvedId ? Number(resolvedId) : null,
        ro_item_id: resolvedId ? Number(resolvedId) : null,
        name: resolvedName,
        amount: 1,
        quantity: 1
      };
    });

    try {
      const res = await fetch(`${backendUrl}/runs/${runId}/items`, {
        method: 'PUT',
        headers: getAuthHeaders(),
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

  // --- VERKAUF NEU EINGEBEN, SPÄTER EDITIEREN ODER ZURÜCKSETZEN ---
  function openSaleForm(runItemId) {
    if (!isAdmin) return;
    saleInputs = {
      ...saleInputs,
      [runItemId]: { price: 0, priceDisplay: '', isShop: false, saleDate: toLocalDatetimeInput() }
    };
    addingSaleForItemId = {
      ...addingSaleForItemId,
      [runItemId]: true
    };
  }

  function closeSaleForm(runItemId) {
    addingSaleForItemId = {
      ...addingSaleForItemId,
      [runItemId]: false
    };
  }

  function startEditSale(item) {
    if (!isAdmin) return;
    const currentPrice = Number(item.sale_price || item.actual_price || item.price || 0);
    const rawPrice = item.is_shop ? Math.round(currentPrice / 0.98) : currentPrice;

    editSaleInputs = {
      ...editSaleInputs,
      [item.id]: {
        price: rawPrice,
        priceDisplay: new Intl.NumberFormat('de-DE').format(rawPrice),
        isShop: Boolean(item.is_shop || item.sale_type === 'Shop'),
        saleDate: toLocalDatetimeInput(item.sale_date)
      }
    };
    editingSaleForItemId = {
      ...editingSaleForItemId,
      [item.id]: true
    };
  }

  function cancelEditSale(runItemId) {
    editingSaleForItemId = {
      ...editingSaleForItemId,
      [runItemId]: false
    };
  }

  async function saveSaleForItem(runId, runItem) {
    if (!isAdmin) return;
    const input = saleInputs[runItem.id];
    if (!input || !input.price || Number(input.price) <= 0) {
      alert('Bitte gib einen gültigen Verkaufspreis ein.');
      return;
    }

    const itemId = getROItemId(runItem) || runItem.item_id || runItem.id;

    if (!itemId || isNaN(Number(itemId))) {
      alert('Fehler: Für dieses Item konnte keine gültige Item-ID ermittelt werden.');
      return;
    }

    const payload = {
      item_id: Number(itemId),
      quantity: 1, // Immer 1 Einzelstück verkaufen
      actual_price: Number(input.price),
      is_shop: Boolean(input.isShop),
      created_at: input.saleDate ? new Date(input.saleDate).toISOString() : new Date().toISOString()
    };

    try {
      const res = await fetch(`${backendUrl}/runs/${runId}/sales`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        closeSaleForm(runItem.id);
        delete saleInputs[runItem.id];
        saleInputs = { ...saleInputs };
        await loadRunDetails(runId);
      } else {
        const errorData = await res.json().catch(() => null);
        alert(`Verkauf konnte nicht gespeichert werden (Status ${res.status}).\n${JSON.stringify(errorData || res.statusText)}`);
      }
    } catch (err) {
      console.error(err);
      alert('Netzwerkfehler beim Speichern des Verkaufs.');
    }
  }

  async function updateSaleForItem(runId, runItem) {
    if (!isAdmin) return;
    const input = editSaleInputs[runItem.id];
    if (!input || !input.price || Number(input.price) <= 0) {
      alert('Bitte gib einen gültigen Verkaufspreis ein.');
      return;
    }

    if (!runItem.sale_id) {
      alert('Fehler: Es konnte keine Verkaufs-ID für dieses Item gefunden werden.');
      return;
    }

    const payload = {
      quantity: 1, // Immer 1 Einzelstück verkaufen
      actual_price: Number(input.price),
      is_shop: Boolean(input.isShop),
      created_at: input.saleDate ? new Date(input.saleDate).toISOString() : undefined
    };

    try {
      const res = await fetch(`${backendUrl}/runs/sales/${runItem.sale_id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        cancelEditSale(runItem.id);
        delete editSaleInputs[runItem.id];
        editSaleInputs = { ...editSaleInputs };
        await loadRunDetails(runId);
      } else {
        const errorData = await res.json().catch(() => null);
        alert(`Verkauf konnte nicht aktualisiert werden (Status ${res.status}).\n${JSON.stringify(errorData || res.statusText)}`);
      }
    } catch (err) {
      console.error(err);
      alert('Netzwerkfehler beim Aktualisieren des Verkaufs.');
    }
  }

  async function deleteSaleForItem(runId, runItem) {
    if (!isAdmin) return;
    if (!runItem.sale_id) {
      alert('Fehler: Es konnte keine Verkaufs-ID für dieses Item gefunden werden.');
      return;
    }

    if (!confirm(`Möchtest du den Verkauf von "${getItemName(runItem)}" wirklich zurücksetzen?`)) {
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/runs/sales/${runItem.sale_id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        await loadRunDetails(runId);
      } else {
        const errorData = await res.json().catch(() => null);
        alert(`Verkauf konnte nicht zurückgesetzt werden (Status ${res.status}).\n${JSON.stringify(errorData || res.statusText)}`);
      }
    } catch (err) {
      console.error(err);
      alert('Netzwerkfehler beim Zurücksetzen des Verkaufs.');
    }
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
  {#if isAdmin}
    <a href="/runs/new" class="create-btn">+ Neuen Run anlegen</a>
  {/if}
</div>

{#if isLoading}
  <section class="card">
    <p class="status-text">Lade Runs...</p>
  </section>
{:else if errorMessage}
  <section class="card">
    <p class="error">{errorMessage}</p>
  </section>
{:else if runs.length === 0}
  <section class="card">
    <p class="status-text">
      {#if isAdmin}
        Noch keine Runs vorhanden. Klicke oben auf "+ Neuen Run anlegen"!
      {:else}
        Noch keine Runs vorhanden.
      {/if}
    </p>
  </section>
{:else}
  <!-- 1. SEKTION: AKTIVE RUNS -->
  <section class="card section-margin">
    <h2>🔥 Aktive Runs ({activeRuns.length})</h2>
    {#if activeRuns.length === 0}
      <p class="empty-text">Keine aktiven Runs vorhanden.</p>
    {:else}
      <ul class="runs-list">
        {#each activeRuns as run, index (run.id ? `${run.id}-${index}` : index)}
          {@const isExpanded = expandedRunIds.has(run.id)}
          {@const statusInfo = getRunStatusInfo(run)}
          <li class="run-item" id="run-{run.id}">
            <div class="run-header" on:click={() => toggleExpand(run.id)} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && toggleExpand(run.id)}>
              
              {#if editingRunHeader[run.id]}
                <div class="run-edit-inline" on:click|stopPropagation>
                  <input 
                    type="text" 
                    bind:value={runHeaderInputs[run.id].name} 
                    class="small-input header-edit-input" 
                    placeholder="Run Name" 
                  />
                  <input 
                    type="text" 
                    bind:value={runHeaderInputs[run.id].run_type} 
                    class="small-input header-edit-input" 
                    placeholder="Typ (z.B. ET, WoE)" 
                  />
                  <button type="button" class="save-mini-btn" on:click={(e) => saveRunHeader(run.id, e)}>✓</button>
                  <button type="button" class="cancel-mini-btn" on:click={(e) => cancelEditRunHeader(run.id, e)}>✕</button>
                </div>
              {:else}
                <div class="run-info">
                  <span class="run-name">{run.name}</span>
                  {#if run.run_type}
                    <span class="run-meta">📌 {run.run_type}</span>
                  {/if}
                </div>
              {/if}

              <div class="header-right">
                <span class="badge {statusInfo.cssClass}">{statusInfo.label}</span>

                {#if isAdmin && !editingRunHeader[run.id]}
                  <button type="button" class="edit-sale-btn" title="Run bearbeiten" on:click={(e) => startEditRunHeader(run, e)}>✏️</button>
                  <button type="button" class="del-btn" title="Run löschen" on:click={(e) => deleteRun(run.id, run.name, e)}>🗑️</button>
                {/if}

                <button class="expand-btn" type="button">
                  {isExpanded ? '▲ Verbergen' : '▼ Details'}
                </button>
              </div>
            </div>

            {#if isExpanded}
              <div class="run-details">
                {#if run.summary}
                  <div class="summary-banner">
                    <div class="summary-card">
                      <span class="summary-label">Gesamteinnahmen</span>
                      <span class="summary-value total-zeny">{formatZeny(run.summary.total_zeny)}</span>
                    </div>
                    <div class="summary-card">
                      <span class="summary-label">Split pro Spieler ({run.summary.participant_count}x)</span>
                      <span class="summary-value split-zeny">{formatZeny(run.summary.payout_per_player)}</span>
                    </div>
                    <div class="summary-card">
                      <span class="summary-label">Auszahlungs-Status</span>
                      <span class="summary-value status-badge" class:all-paid={run.summary.all_paid_out}>
                        {run.summary.participants_paid} / {run.summary.participant_count} Ausgezahlt
                      </span>
                    </div>
                  </div>
                {/if}

                <div class="details-grid">
                  <!-- TEILNEHMER -->
                  <div class="detail-block participant-block">
                    <h3>👥 Teilnehmer ({run.participants ? run.participants.length : 0})</h3>
                    {#if !editingParticipants[run.id]}
                      {#if run.participants && run.participants.length > 0}
                        <ul>
                          {#each run.participants as p, i}
                            <li class="participant-row" class:paid-row={p.is_paid}>
                              <div class="p-info">
                                <strong class="num-prefix">{i + 1}.</strong> 
                                <span>{p.name}</span>
                                {#if p.class_name}<span class="class-tag">{p.class_name}</span>{/if}
                              </div>
                              {#if isAdmin}
                                <label class="payout-toggle" title="Auszahlungs-Status ändern">
                                  <input 
                                    type="checkbox" 
                                    checked={p.is_paid} 
                                    on:change={() => togglePayoutStatus(run.id, p.participant_id, p.is_paid)} 
                                  />
                                  <span class="payout-label">{p.is_paid ? 'Ausgezahlt' : 'Offen'}</span>
                                </label>
                              {:else}
                                <span class="payout-status-text" class:paid={p.is_paid}>
                                  {p.is_paid ? '✓ Ausgezahlt' : '⏳ Offen'}
                                </span>
                              {/if}
                            </li>
                          {/each}
                        </ul>
                      {:else}
                        <p class="empty-text">Keine Teilnehmer eingetragen</p>
                      {/if}
                      {#if isAdmin}
                        <button type="button" class="action-btn" on:click={() => enableParticipantEditing(run)}>✏️ Edit</button>
                      {/if}
                    {:else}
                      <ul class="edit-list">
                        {#each participantInputs[run.id]?.list || [] as p, idx}
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
                          {#each availableParticipants.filter(ap => !(participantInputs[run.id]?.list || []).some(p => Number(p.participant_id) === Number(ap.id))) as ap}
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

                  <!-- DROPS / ITEMS -->
                  <div class="detail-block item-block">
                    <h3>📦 Drops / Items ({run.items ? run.items.length : 0})</h3>
                    
                    {#if !editingItems[run.id]}
                      {#if run.items && run.items.length > 0}
                        <ul class="items-sales-list">
                          {#each run.items as item (item.id)}
                            {@const iconSrc = getItemIconUrl(item)}
                            {@const roId = getROItemId(item)}
                            <li class="item-sale-row">
                              <div class="item-info">
                                <span class="item-qty">{item.amount || item.quantity || 1}x</span>
                                <img 
                                  src={iconSrc} 
                                  alt={item.name} 
                                  class="item-icon-img"
                                  on:error={(e) => handleImgError(e, item)} 
                                />
                                {#if roId}
                                  <span class="item-id-badge">#{roId}</span>
                                {/if}
                                <span class="item-name">{getItemName(item, item.name || item.item_name)}</span>
                              </div>

                              <div class="sale-action-area">
                                {#if editingSaleForItemId[item.id] && isAdmin}
                                  <div class="inline-sale-form">
                                    {#if editSaleInputs[item.id]}
                                      <input 
                                        type="text" 
                                        placeholder="Preis" 
                                        value={editSaleInputs[item.id].priceDisplay || ''} 
                                        on:input={(e) => handleEditPriceInput(item.id, e)}
                                        class="price-input wide-price-input" 
                                      />
                                      <input 
                                        type="datetime-local" 
                                        bind:value={editSaleInputs[item.id].saleDate} 
                                        class="date-input"
                                      />
                                      <label class="checkbox-label">
                                        <input type="checkbox" bind:checked={editSaleInputs[item.id].isShop} />
                                        Shop
                                      </label>
                                    {/if}
                                    <button type="button" class="save-mini-btn" on:click={() => updateSaleForItem(run.id, item)}>✓</button>
                                    <button type="button" class="cancel-mini-btn" on:click={() => cancelEditSale(item.id)}>✕</button>
                                  </div>
                                {:else if item.sale_price || item.price || item.actual_price}
                                  <div class="sale-details-col">
                                    <span class="price-tag">{formatZeny(item.sale_price || item.actual_price || item.price)}</span>
                                    {#if item.sale_date}
                                      <span class="sale-date-tag">📅 {formatDate(item.sale_date)}</span>
                                    {/if}
                                  </div>

                                  {#if item.is_shop || item.sale_type === 'Shop'}
                                    <span class="shop-badge">Shop (-2%)</span>
                                  {/if}
                                  {#if isAdmin}
                                    <button type="button" class="edit-sale-btn" on:click={() => startEditSale(item)} title="Verkauf bearbeiten">✏️</button>
                                    <button type="button" class="del-btn" on:click={() => deleteSaleForItem(run.id, item)} title="Verkauf zurücksetzen">🗑️</button>
                                  {/if}
                                {:else if addingSaleForItemId[item.id] && isAdmin}
                                  <div class="inline-sale-form">
                                    {#if saleInputs[item.id]}
                                      <input 
                                        type="text" 
                                        placeholder="Preis (z.B. 1.000.000)" 
                                        value={saleInputs[item.id].priceDisplay || ''} 
                                        on:input={(e) => handlePriceInput(item.id, e)}
                                        class="price-input wide-price-input" 
                                      />
                                      <input 
                                        type="datetime-local" 
                                        bind:value={saleInputs[item.id].saleDate} 
                                        class="date-input"
                                      />
                                      <label class="checkbox-label">
                                        <input type="checkbox" bind:checked={saleInputs[item.id].isShop} />
                                        Shop
                                      </label>
                                    {/if}
                                    <button type="button" class="save-mini-btn" on:click={() => saveSaleForItem(run.id, item)}>✓</button>
                                    <button type="button" class="cancel-mini-btn" on:click={() => closeSaleForm(item.id)}>✕</button>
                                  </div>
                                {:else if isAdmin}
                                  <button type="button" class="add-sale-btn" on:click={() => openSaleForm(item.id)}>
                                    + Verkauf hinzufügen
                                  </button>
                                {:else}
                                  <span class="empty-text">Offen</span>
                                {/if}
                              </div>
                            </li>
                          {/each}
                        </ul>
                      {:else}
                        <p class="empty-text">Keine Items eingetragen</p>
                      {/if}

                      {#if isAdmin}
                        <button type="button" class="action-btn" on:click={() => enableItemEditing(run)}>
                          ➕ Add/Edit
                        </button>
                      {/if}

                    {:else}
                      <ul class="edit-list">
                        {#each itemInputs[run.id]?.list || [] as item, idx}
                          {@const iconSrc = getItemIconUrl(item)}
                          {@const roId = getROItemId(item)}
                          <li class="edit-row">
                            <span class="item-info">
                              <span class="item-qty">{item.amount || 1}x</span>
                              <img 
                                src={iconSrc} 
                                alt={item.name} 
                                class="item-icon-img" 
                                on:error={(e) => handleImgError(e, item)} 
                              />
                              {#if roId}
                                <span class="item-id-badge">#{roId}</span>
                              {/if}
                              <span>{getItemName(item, item.name)}</span>
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
                          placeholder="Item Name oder RO-ID" 
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

  <!-- 2. SEKTION: ABGESCHLOSSENE RUNS -->
  <section class="card closed-card">
    <h2>✅ Abgeschlossene Runs ({closedRuns.length})</h2>
    {#if closedRuns.length === 0}
      <p class="empty-text">Noch keine abgeschlossenen Runs vorhanden.</p>
    {:else}
      <ul class="runs-list">
        {#each closedRuns as run, index (run.id ? `${run.id}-${index}` : index)}
          {@const isExpanded = expandedRunIds.has(run.id)}
          {@const statusInfo = getRunStatusInfo(run)}
          <li class="run-item closed-run-item" id="run-{run.id}">
            <div class="run-header" on:click={() => toggleExpand(run.id)} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && toggleExpand(run.id)}>
              
              {#if editingRunHeader[run.id]}
                <div class="run-edit-inline" on:click|stopPropagation>
                  <input 
                    type="text" 
                    bind:value={runHeaderInputs[run.id].name} 
                    class="small-input header-edit-input" 
                    placeholder="Run Name" 
                  />
                  <input 
                    type="text" 
                    bind:value={runHeaderInputs[run.id].run_type} 
                    class="small-input header-edit-input" 
                    placeholder="Typ (z.B. ET, WoE)" 
                  />
                  <button type="button" class="save-mini-btn" on:click={(e) => saveRunHeader(run.id, e)}>✓</button>
                  <button type="button" class="cancel-mini-btn" on:click={(e) => cancelEditRunHeader(run.id, e)}>✕</button>
                </div>
              {:else}
                <div class="run-info">
                  <span class="run-name">{run.name}</span>
                  {#if run.run_type}
                    <span class="run-meta">📌 {run.run_type}</span>
                  {/if}
                </div>
              {/if}

              <div class="header-right">
                <span class="badge {statusInfo.cssClass}">{statusInfo.label}</span>

                {#if isAdmin && !editingRunHeader[run.id]}
                  <button type="button" class="edit-sale-btn" title="Run bearbeiten" on:click={(e) => startEditRunHeader(run, e)}>✏️</button>
                  <button type="button" class="del-btn" title="Run löschen" on:click={(e) => deleteRun(run.id, run.name, e)}>🗑️</button>
                {/if}

                <button class="expand-btn" type="button">
                  {isExpanded ? '▲ Verbergen' : '▼ Details'}
                </button>
              </div>
            </div>

            {#if isExpanded}
              <div class="run-details">
                {#if run.summary}
                  <div class="summary-banner">
                    <div class="summary-card">
                      <span class="summary-label">Gesamteinnahmen</span>
                      <span class="summary-value total-zeny">{formatZeny(run.summary.total_zeny)}</span>
                    </div>
                    <div class="summary-card">
                      <span class="summary-label">Split pro Spieler ({run.summary.participant_count}x)</span>
                      <span class="summary-value split-zeny">{formatZeny(run.summary.payout_per_player)}</span>
                    </div>
                    <div class="summary-card">
                      <span class="summary-label">Auszahlungs-Status</span>
                      <span class="summary-value status-badge" class:all-paid={run.summary.all_paid_out}>
                        {run.summary.participants_paid} / {run.summary.participant_count} Ausgezahlt
                      </span>
                    </div>
                  </div>
                {/if}

                <div class="details-grid">
                  <!-- TEILNEHMER -->
                  <div class="detail-block participant-block">
                    <h3>👥 Teilnehmer ({run.participants ? run.participants.length : 0})</h3>
                    {#if !editingParticipants[run.id]}
                      {#if run.participants && run.participants.length > 0}
                        <ul>
                          {#each run.participants as p, i}
                            <li class="participant-row" class:paid-row={p.is_paid}>
                              <div class="p-info">
                                <strong class="num-prefix">{i + 1}.</strong> 
                                <span>{p.name}</span>
                                {#if p.class_name}<span class="class-tag">{p.class_name}</span>{/if}
                              </div>
                              {#if isAdmin}
                                <label class="payout-toggle" title="Auszahlungs-Status ändern">
                                  <input 
                                    type="checkbox" 
                                    checked={p.is_paid} 
                                    on:change={() => togglePayoutStatus(run.id, p.participant_id, p.is_paid)} 
                                  />
                                  <span class="payout-label">{p.is_paid ? 'Ausgezahlt' : 'Offen'}</span>
                                </label>
                              {:else}
                                <span class="payout-status-text" class:paid={p.is_paid}>
                                  {p.is_paid ? '✓ Ausgezahlt' : '⏳ Offen'}
                                </span>
                              {/if}
                            </li>
                          {/each}
                        </ul>
                      {:else}
                        <p class="empty-text">Keine Teilnehmer eingetragen</p>
                      {/if}
                      {#if isAdmin}
                        <button type="button" class="action-btn" on:click={() => enableParticipantEditing(run)}>✏️ Edit</button>
                      {/if}
                    {:else}
                      <ul class="edit-list">
                        {#each participantInputs[run.id]?.list || [] as p, idx}
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
                          {#each availableParticipants.filter(ap => !(participantInputs[run.id]?.list || []).some(p => Number(p.participant_id) === Number(ap.id))) as ap}
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

                  <!-- DROPS / ITEMS -->
                  <div class="detail-block item-block">
                    <h3>📦 Drops / Items ({run.items ? run.items.length : 0})</h3>
                    
                    {#if !editingItems[run.id]}
                      {#if run.items && run.items.length > 0}
                        <ul class="items-sales-list">
                          {#each run.items as item (item.id)}
                            {@const iconSrc = getItemIconUrl(item)}
                            {@const roId = getROItemId(item)}
                            <li class="item-sale-row">
                              <div class="item-info">
                                <span class="item-qty">{item.amount || item.quantity || 1}x</span>
                                <img 
                                  src={iconSrc} 
                                  alt={item.name} 
                                  class="item-icon-img"
                                  on:error={(e) => handleImgError(e, item)} 
                                />
                                {#if roId}
                                  <span class="item-id-badge">#{roId}</span>
                                {/if}
                                <span class="item-name">{getItemName(item, item.name || item.item_name)}</span>
                              </div>

                              <div class="sale-action-area">
                                {#if editingSaleForItemId[item.id] && isAdmin}
                                  <div class="inline-sale-form">
                                    {#if editSaleInputs[item.id]}
                                      <input 
                                        type="text" 
                                        placeholder="Preis" 
                                        value={editSaleInputs[item.id].priceDisplay || ''} 
                                        on:input={(e) => handleEditPriceInput(item.id, e)}
                                        class="price-input wide-price-input" 
                                      />
                                      <input 
                                        type="datetime-local" 
                                        bind:value={editSaleInputs[item.id].saleDate} 
                                        class="date-input"
                                      />
                                      <label class="checkbox-label">
                                        <input type="checkbox" bind:checked={editSaleInputs[item.id].isShop} />
                                        Shop
                                      </label>
                                    {/if}
                                    <button type="button" class="save-mini-btn" on:click={() => updateSaleForItem(run.id, item)}>✓</button>
                                    <button type="button" class="cancel-mini-btn" on:click={() => cancelEditSale(item.id)}>✕</button>
                                  </div>
                                {:else if item.sale_price || item.price || item.actual_price}
                                  <div class="sale-details-col">
                                    <span class="price-tag">{formatZeny(item.sale_price || item.actual_price || item.price)}</span>
                                    {#if item.sale_date}
                                      <span class="sale-date-tag">📅 {formatDate(item.sale_date)}</span>
                                    {/if}
                                  </div>

                                  {#if item.is_shop || item.sale_type === 'Shop'}
                                    <span class="shop-badge">Shop (-2%)</span>
                                  {/if}
                                  {#if isAdmin}
                                    <button type="button" class="edit-sale-btn" on:click={() => startEditSale(item)} title="Verkauf bearbeiten">✏️</button>
                                    <button type="button" class="del-btn" on:click={() => deleteSaleForItem(run.id, item)} title="Verkauf zurücksetzen">🗑️</button>
                                  {/if}
                                {:else if addingSaleForItemId[item.id] && isAdmin}
                                  <div class="inline-sale-form">
                                    {#if saleInputs[item.id]}
                                      <input 
                                        type="text" 
                                        placeholder="Preis (z.B. 1.000.000)" 
                                        value={saleInputs[item.id].priceDisplay || ''} 
                                        on:input={(e) => handlePriceInput(item.id, e)}
                                        class="price-input wide-price-input" 
                                      />
                                      <input 
                                        type="datetime-local" 
                                        bind:value={saleInputs[item.id].saleDate} 
                                        class="date-input"
                                      />
                                      <label class="checkbox-label">
                                        <input type="checkbox" bind:checked={saleInputs[item.id].isShop} />
                                        Shop
                                      </label>
                                    {/if}
                                    <button type="button" class="save-mini-btn" on:click={() => saveSaleForItem(run.id, item)}>✓</button>
                                    <button type="button" class="cancel-mini-btn" on:click={() => closeSaleForm(item.id)}>✕</button>
                                  </div>
                                {:else if isAdmin}
                                  <button type="button" class="add-sale-btn" on:click={() => openSaleForm(item.id)}>
                                    + Verkauf hinzufügen
                                  </button>
                                {:else}
                                  <span class="empty-text">Offen</span>
                                {/if}
                              </div>
                            </li>
                          {/each}
                        </ul>
                      {:else}
                        <p class="empty-text">Keine Items eingetragen</p>
                      {/if}

                      {#if isAdmin}
                        <button type="button" class="action-btn" on:click={() => enableItemEditing(run)}>
                          ➕ Add/Edit
                        </button>
                      {/if}

                    {:else}
                      <ul class="edit-list">
                        {#each itemInputs[run.id]?.list || [] as item, idx}
                          {@const iconSrc = getItemIconUrl(item)}
                          {@const roId = getROItemId(item)}
                          <li class="edit-row">
                            <span class="item-info">
                              <span class="item-qty">{item.amount || 1}x</span>
                              <img 
                                src={iconSrc} 
                                alt={item.name} 
                                class="item-icon-img" 
                                on:error={(e) => handleImgError(e, item)} 
                              />
                              {#if roId}
                                <span class="item-id-badge">#{roId}</span>
                              {/if}
                              <span>{getItemName(item, item.name)}</span>
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
                          placeholder="Item Name oder RO-ID" 
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
{/if}

<style>
  .header-action { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  h1 { color: #fbbf24; margin: 0; }
  h2 { font-size: 1.1rem; color: #f8fafc; margin-top: 0; margin-bottom: 1rem; }
  
  .create-btn { background-color: #d97706; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
  .create-btn:hover { background-color: #b45309; }
  
  .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; }
  .section-margin { margin-bottom: 1.5rem; }
  
  /* ABGESCHLOSSENE RUNS OPTIONAL LEICHT ABGEDUNKELT */
  .closed-card { border-color: #1e293b; background-color: #111827; }
  .closed-card h2 { color: #94a3b8; }
  .closed-run-item { opacity: 0.85; }
  .closed-run-item:hover { opacity: 1; }

  .runs-list { list-style: none; padding: 0; margin: 0; }
  .run-item { background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; margin-bottom: 0.75rem; overflow: hidden; }
  .run-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; cursor: pointer; user-select: none; }
  .run-header:hover { background-color: #1a2436; }
  
  .run-info { display: flex; flex-direction: column; gap: 0.25rem; }
  .run-name { font-weight: 600; color: #f8fafc; font-size: 1.05rem; }
  .run-meta { font-size: 0.85rem; color: #94a3b8; }
  
  .run-edit-inline { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  .header-edit-input { width: 140px !important; flex: none !important; }

  .header-right { display: flex; align-items: center; gap: 0.75rem; }
  
  /* FARBDISPLAY FÜR DYNAMISCHE RUN-STATUS */
  .badge { color: white; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 4px; text-transform: capitalize; }
  .status-open { background-color: #059669; }     /* Grün */
  .status-onsale { background-color: #d97706; }   /* Gelb/Orange */
  .status-payout { background-color: #ca8a04; }   /* Gelb */
  .status-close { background-color: #dc2626; }    /* Rot */

  .expand-btn { background: none; border: 1px solid #475569; color: #cbd5e1; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }

  .run-details { padding: 1rem; border-top: 1px solid #334155; background-color: #090d16; }

  /* SUMMARY BANNER */
  .summary-banner {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
    background-color: #1e293b;
    border: 1px solid #059669;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
  }
  .summary-card { display: flex; flex-direction: column; gap: 0.2rem; }
  .summary-label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
  .summary-value { font-size: 1.1rem; font-weight: 700; color: #f8fafc; }
  .total-zeny { color: #34d399; }
  .split-zeny { color: #fbbf24; }
  .status-badge { font-size: 0.9rem; color: #f59e0b; }
  .status-badge.all-paid { color: #10b981; }

  .details-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 1rem; align-items: start; }
  
  @media (max-width: 768px) {
    .details-grid { grid-template-columns: 1fr; }
  }

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
  
  .participant-row { transition: background 0.2s; }
  .participant-row.paid-row { opacity: 0.7; }
  .participant-row.paid-row span { text-decoration: line-through; }
  .p-info { display: flex; align-items: center; gap: 0.4rem; }
  
  .payout-toggle { display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; cursor: pointer; color: #94a3b8; }
  .payout-toggle input { cursor: pointer; }
  .payout-label { font-weight: 500; }
  .payout-status-text { font-size: 0.75rem; color: #94a3b8; font-weight: 500; }
  .payout-status-text.paid { color: #34d399; }

  .num-prefix { color: #fbbf24; font-weight: 600; margin-right: 0.3rem; }
  .class-tag { background-color: #334155; color: #38bdf8; font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: 4px; }
  
  .action-btn { background-color: #334155; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; align-self: flex-start; margin-top: 0.5rem; }
  .action-btn:hover { background-color: #475569; }

  .edit-list { margin-bottom: 0.5rem !important; }
  .edit-row { background-color: #0f172a; padding: 0.3rem 0.5rem !important; border-radius: 4px; margin-bottom: 0.2rem; display: flex; justify-content: space-between; align-items: center; }
  .edit-name { font-size: 0.8rem; }
  .inline-select { flex: none; width: auto; }
  .del-btn { background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; }
  
  .add-row { display: flex; gap: 0.4rem; margin-bottom: 0.6rem; align-items: center; flex-wrap: wrap; }
  .small-select, .small-input { flex: 2; min-width: 140px; padding: 0.4rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 4px; color: white; font-size: 0.8rem; }
  .qty-field { width: 65px; padding: 0.4rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 4px; color: white; font-size: 0.8rem; }
  .mini-add-btn { background-color: #d97706; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.8rem; }

  .items-sales-list { margin-bottom: 0.5rem !important; }
  .item-sale-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  
  .item-info { display: flex; align-items: center; gap: 0.5rem; }
  .item-qty { color: #fbbf24; font-weight: 600; font-size: 0.85rem; min-width: 24px; }
  .item-icon-img { width: 24px; height: 24px; object-fit: contain; vertical-align: middle; }
  .item-id-badge { color: #64748b; font-size: 0.75rem; font-family: monospace; font-weight: 600; }
  .item-name { font-weight: 500; }
  
  .sale-action-area { display: flex; align-items: center; gap: 0.5rem; }
  .sale-details-col { display: flex; flex-direction: column; align-items: flex-end; }
  .sale-date-tag { font-size: 0.7rem; color: #94a3b8; }
  .price-tag { color: #34d399; font-weight: 600; font-size: 0.85rem; }
  .add-sale-btn { background-color: #064e3b; color: #6ee7b7; border: 1px solid #047857; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
  .add-sale-btn:hover { background-color: #047857; color: white; }

  .edit-sale-btn { background: none; border: none; cursor: pointer; font-size: 0.85rem; padding: 0 0.2rem; }
  .edit-sale-btn:hover { opacity: 0.8; }

  .inline-sale-form { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
  .date-input { background-color: #0f172a; border: 1px solid #475569; border-radius: 4px; color: #cbd5e1; font-size: 0.75rem; padding: 0.25rem 0.4rem; }
  
  .wide-price-input { width: 130px; padding: 0.3rem 0.5rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 4px; color: #34d399; font-weight: 600; font-size: 0.85rem; text-align: right; }
  
  .checkbox-label { font-size: 0.75rem; color: #cbd5e1; display: flex; align-items: center; gap: 0.2rem; cursor: pointer; }
  .save-mini-btn { background: #059669; color: white; border: none; padding: 0.3rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 0.75rem; font-weight: bold; }
  .cancel-mini-btn { background: #475569; color: white; border: none; padding: 0.3rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 0.75rem; }
  .shop-badge { background: #7c2d12; color: #fdba74; font-size: 0.7rem; padding: 0.1rem 0.3rem; border-radius: 3px; font-weight: 600; }

  .btn-group { display: flex; gap: 0.4rem; margin-top: 0.5rem; }
  .save-btn { background-color: #059669; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
  .cancel-btn { background-color: #475569; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }

  .status-text { color: #94a3b8; }
  .empty-text { font-size: 0.85rem; color: #64748b; font-style: italic; margin-bottom: 0.5rem; }
  .error { color: #ef4444; }
</style>