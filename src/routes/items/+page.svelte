<script>
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let items = [];
  let isLoading = true;
  let errorMessage = '';

  // Formular-Felder
  let newItemId = '';
  let newItemName = '';
  let customImageUrl = '';

  // Filter & Detailansicht
  let searchQuery = '';
  let selectedItemHistory = null;
  let historyLoading = false;
  let activeHistoryItemId = null;

  async function loadItems() {
    isLoading = true;
    errorMessage = '';
    try {
      // Nutzt direkt die oben definierte Variable
      const res = await fetch(`${backendUrl}/items/`);
      if (res.ok) {
        const data = await res.json();
        items = Array.isArray(data) ? data : [];
      } else {
        errorMessage = `Fehler beim Laden (Status: ${res.status})`;
      }
    } catch (err) {
      console.error(err);
      errorMessage = 'Verbindungsfehler zum Backend!';
    } finally {
      isLoading = false;
    }
  }

  async function addItem() {
    if (!newItemId || !newItemName.trim()) {
      alert('Bitte Item-ID und Name eingeben.');
      return;
    }

    const payload = {
      item_id: Number(newItemId),
      name: newItemName.trim(),
      image_url: customImageUrl.trim() || `https://file5s.ratemyserver.net/items/small/${newItemId}.gif`
    };

    try {
      const res = await fetch(`${backendUrl}/items/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        newItemId = '';
        newItemName = '';
        customImageUrl = '';
        await loadItems();
      } else {
        alert('Item konnte nicht gespeichert werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Verbinden mit dem Server.');
    }
  }

  async function toggleHistory(itemId) {
    if (activeHistoryItemId === itemId) {
      activeHistoryItemId = null;
      selectedItemHistory = null;
      return;
    }

    activeHistoryItemId = itemId;
    historyLoading = true;
    try {
      const res = await fetch(`${backendUrl}/items/${itemId}/history`);
      if (res.ok) {
        selectedItemHistory = await res.json();
      } else {
        selectedItemHistory = [];
      }
    } catch (err) {
      console.error(err);
      selectedItemHistory = [];
    } finally {
      historyLoading = false;
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Nie';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function formatZeny(amount) {
    if (amount === null || amount === undefined) return 'Keine Verkäufe';
    return new Intl.NumberFormat('de-DE').format(amount) + ' z';
  }

  $: filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(i.item_id).includes(searchQuery)
  );
</script>

<div class="header-action">
  <h1>Item Datenbank</h1>
</div>

<!-- FORMULAR: NEUES ITEM -->
<section class="card">
  <h2>Neues Item anlegen</h2>
  <form on:submit|preventDefault={addItem} class="add-form">
    <input 
      type="number" 
      placeholder="Item-ID (z.B. 1026)" 
      bind:value={newItemId} 
      class="input-field small-input" 
      required
    />
    <input 
      type="text" 
      placeholder="Item Name (z.B. Elunium)" 
      bind:value={newItemName} 
      class="input-field" 
      required
    />
    <input 
      type="url" 
      placeholder="Bild-URL (Optional)" 
      bind:value={customImageUrl} 
      class="input-field" 
    />
    <button type="submit" class="create-btn">+ Speichern</button>
  </form>
</section>

<!-- LISTE / TABELLE DER ITEMS -->
<section class="card margin-top">
  <div class="list-header">
    <h2>Alle Items ({filteredItems.length})</h2>
    <input 
      type="text" 
      placeholder="🔍 Name oder ID suchen..." 
      bind:value={searchQuery} 
      class="input-field search-input"
    />
  </div>

  {#if isLoading}
    <p class="status-text">Lade Items...</p>
  {:else if errorMessage}
    <p class="error">{errorMessage}</p>
  {:else if filteredItems.length === 0}
    <p class="status-text">Keine Items gefunden.</p>
  {:else}
    <div class="table-container">
      <table class="item-table">
        <thead>
          <tr>
            <th>Icon</th>
            <th>ID</th>
            <th>Name</th>
            <th>Letzter Preis</th>
            <th>Verkauft am</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredItems as item}
            <tr>
              <td class="icon-cell">
                <img 
                  src={item.image_url || `https://file5s.ratemyserver.net/items/small/${item.item_id}.gif`} 
                  alt={item.name}
                  on:error={(e) => e.target.src = 'https://file5s.ratemyserver.net/items/small/501.gif'}
                />
              </td>
              <td class="id-cell">#{item.item_id}</td>
              <td class="name-cell">{item.name}</td>
              <td class="price-cell">{formatZeny(item.last_price)}</td>
              <td class="date-cell">{formatDate(item.last_sold_at)}</td>
              <td>
                <button 
                  type="button" 
                  class="history-btn" 
                  on:click={() => toggleHistory(item.item_id)}
                >
                  {activeHistoryItemId === item.item_id ? '▲ Verbergen' : '📊 Preishistorie'}
                </button>
              </td>
            </tr>

            <!-- HISTORIE / DETAILBEREICH -->
            {#if activeHistoryItemId === item.item_id}
              <tr class="history-row">
                <td colspan="6">
                  <div class="history-box">
                    <h4>📈 Runs & Preisentwicklung für {item.name}</h4>
                    {#if historyLoading}
                      <p class="status-text">Lade Verlauf...</p>
                    {:else if selectedItemHistory && selectedItemHistory.length > 0}
                      <ul class="history-list">
                        {#each selectedItemHistory as h}
                          <li>
                            <span class="run-name">🏰 {h.run_name}</span>
                            <span class="run-date">📅 {formatDate(h.run_date)}</span>
                            <span class="item-qty">Menge: x{h.quantity || 1}</span>
                            <span class="hist-price">{formatZeny(h.price)}</span>
                          </li>
                        {/each}
                      </ul>
                    {:else}
                      <p class="empty-text">Dieses Item wurde bisher in noch keinem Run verkauft.</p>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .header-action { margin-bottom: 1.5rem; }
  h1 { color: #fbbf24; margin: 0; }
  .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; }
  .margin-top { margin-top: 1.5rem; }
  h2 { color: #f8fafc; font-size: 1.1rem; margin: 0 0 1rem 0; }

  .add-form { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .input-field { padding: 0.5rem 0.8rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 6px; color: white; font-size: 0.9rem; }
  .small-input { width: 140px; }
  .search-input { width: 250px; }

  .create-btn { background-color: #d97706; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .create-btn:hover { background-color: #b45309; }

  .list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem; }

  .table-container { overflow-x: auto; }
  .item-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
  .item-table th { background-color: #0f172a; color: #fbbf24; padding: 0.75rem; border-bottom: 2px solid #334155; }
  .item-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #334155; color: #f8fafc; vertical-align: middle; }

  .icon-cell img { width: 24px; height: 24px; object-fit: contain; }
  .id-cell { color: #94a3b8; font-family: monospace; }
  .name-cell { font-weight: 600; }
  .price-cell { color: #34d399; font-weight: 600; }
  .date-cell { color: #94a3b8; font-size: 0.85rem; }

  .history-btn { background-color: #334155; color: white; border: none; padding: 0.35rem 0.7rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
  .history-btn:hover { background-color: #475569; }

  /* DETAIL BEREICH */
  .history-row td { background-color: #090d16; padding: 1rem; }
  .history-box { background-color: #0f172a; border: 1px solid #334155; padding: 1rem; border-radius: 6px; }
  .history-box h4 { margin: 0 0 0.8rem 0; color: #fbbf24; font-size: 0.95rem; }
  .history-list { list-style: none; padding: 0; margin: 0; }
  .history-list li { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px dashed #334155; font-size: 0.85rem; }
  .run-name { font-weight: 600; color: #e2e8f0; }
  .run-date { color: #94a3b8; }
  .item-qty { color: #cbd5e1; }
  .hist-price { color: #34d399; font-weight: 600; }

  .status-text { color: #94a3b8; }
  .empty-text { font-size: 0.85rem; color: #64748b; font-style: italic; }
  .error { color: #ef4444; }
</style>
