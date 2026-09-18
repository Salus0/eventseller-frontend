<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let items = [];
  let isLoading = true;
  let errorMessage = '';

  // Auth & Admin Status
  let isAuthenticated = false;
  let isAdmin = false;
  let jwtToken = '';

  // Formular-Zustand
  let newItemId = '';
  let newItemName = '';

  // Edit-Zustand
  let editingId = null;
  let editItemId = '';
  let editName = '';

  // Filter & Detail-Zustand
  let searchQuery = '';
  let selectedItemHistory = null;
  let historyLoading = false;
  let activeHistoryItemId = null;

  // Speicher für Historien-Daten (itemId -> Array von Verkäufen)
  let historyCache = {};

  // Helper zum Erzeugen der Standard-Auth-Header
  function getAuthHeaders() {
    const token = localStorage.getItem('jwt_token') || jwtToken;
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  function checkAuthAndAdminStatus() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      jwtToken = token;
      isAuthenticated = true;
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
      isAuthenticated = false;
      isAdmin = false;
      jwtToken = '';
    }
  }

  async function loadItems() {
    isLoading = true;
    errorMessage = '';

    if (!isAuthenticated) {
      isLoading = false;
      errorMessage = 'Bitte logge dich ein, um die Item-Datenbank zu sehen.';
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/items/`, {
        headers: getAuthHeaders()
      });

      if (res.status === 401 || res.status === 403) {
        isAuthenticated = false;
        errorMessage = 'Keine Berechtigung! Bitte logge dich ein.';
        return;
      }

      if (res.ok) {
        const data = await res.json();
        items = Array.isArray(data) ? data : [];
        
        // Lädt die Historien für die Fallback-Berechnung
        loadAllHistories(items);
      } else {
        errorMessage = `Fehler beim Laden der Items (Status: ${res.status})`;
      }
    } catch (err) {
      console.error('Fetch Fehler:', err);
      errorMessage = 'Verbindungsfehler zum Backend!';
    } finally {
      isLoading = false;
    }
  }

  async function loadAllHistories(itemList) {
    const promises = itemList.map(async (item) => {
      const targetId = item.item_id || item.id;
      if (!targetId) return;

      try {
        const res = await fetch(`${backendUrl}/items/${targetId}/history`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const hist = await res.json();
          if (Array.isArray(hist) && hist.length > 0) {
            historyCache[item.item_id] = hist;
            historyCache[item.id] = hist;
          }
        }
      } catch (e) {
        // Stillschweigend ignorieren
      }
    });
    await Promise.all(promises);
    historyCache = { ...historyCache };
  }

  async function addItem() {
    if (!isAdmin) {
      alert('Keine Berechtigung! Nur Admins dürfen Items anlegen.');
      return;
    }

    if (!newItemId || !newItemName.trim()) {
      alert('Bitte Item-ID und Name eingeben.');
      return;
    }

    const payload = {
      item_id: Number(newItemId),
      name: newItemName.trim(),
      image_url: `/items/${newItemId}.gif`
    };

    try {
      const res = await fetch(`${backendUrl}/items/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        newItemId = '';
        newItemName = '';
        await loadItems();
      } else {
        alert('Item konnte nicht gespeichert werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Verbinden mit dem Server.');
    }
  }

  function startEditing(item) {
    if (!isAdmin) return;
    editingId = item.id;
    editItemId = item.item_id;
    editName = item.name;
  }

  function cancelEditing() {
    editingId = null;
    editItemId = '';
    editName = '';
  }

  async function saveItem(id) {
    if (!isAdmin) {
      alert('Keine Berechtigung!');
      return;
    }

    if (!editItemId || !editName.trim()) {
      alert('Item-ID und Name dürfen nicht leer sein.');
      return;
    }

    const payload = {
      item_id: Number(editItemId),
      name: editName.trim(),
      image_url: `/items/${editItemId}.gif`
    };

    try {
      const res = await fetch(`${backendUrl}/items/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        cancelEditing();
        await loadItems();
      } else {
        alert('Änderung konnte nicht gespeichert werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Aktualisieren des Items.');
    }
  }

  async function toggleHistory(item) {
    const targetId = item.item_id || item.id;
    if (activeHistoryItemId === targetId) {
      activeHistoryItemId = null;
      selectedItemHistory = null;
      return;
    }

    activeHistoryItemId = targetId;
    historyLoading = true;

    try {
      const res = await fetch(`${backendUrl}/items/${targetId}/history`, {
        headers: getAuthHeaders()
      });

      if (res.ok) {
        selectedItemHistory = await res.json();
        if (Array.isArray(selectedItemHistory)) {
          historyCache[item.item_id] = selectedItemHistory;
          historyCache[item.id] = selectedItemHistory;
          historyCache = { ...historyCache };
        }
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

  // Ermittelt die Bild-URL: Wenn "card" im Namen ist -> card.gif, sonst zuerst .gif
  function getItemImageUrl(item, overrideId = null) {
    if (!item && !overrideId) return '/items/card.gif';

    const itemName = item?.name || editName || '';
    if (itemName.toLowerCase().includes('card')) {
      return '/items/card.gif';
    }

    const targetId = overrideId || item?.item_id || item?.id || 501;
    return `/items/${targetId}.gif`;
  }

  // Ermittelt exakt das sold_at Verkaufsdatum
  function getBestSoldDate(item, cache) {
    if (item.sold_at || item.last_sold_at) {
      return item.sold_at || item.last_sold_at;
    }

    const hist = cache[item.item_id] || cache[item.id];
    if (Array.isArray(hist) && hist.length > 0) {
      const first = hist[0];
      return first.sold_at || first.created_at || first.run_date || null;
    }

    return null;
  }

  function getBestPrice(item, cache) {
    if (item.last_price !== undefined && item.last_price !== null) return item.last_price;

    const hist = cache[item.item_id] || cache[item.id];
    if (Array.isArray(hist) && hist.length > 0) {
      const first = hist[0];
      return first.price ?? first.actual_price ?? first.sale_price ?? null;
    }

    return null;
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Nie';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Nie';

    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function formatZeny(amount) {
    if (amount === null || amount === undefined) return 'Keine Verkäufe';
    return new Intl.NumberFormat('de-DE').format(amount) + ' z';
  }

  $: filteredItems = items.filter(i => {
    const name = i.name ? String(i.name).toLowerCase() : '';
    const id = i.item_id ? String(i.item_id) : '';
    const q = searchQuery.toLowerCase();
    return name.includes(q) || id.includes(q);
  });

  onMount(() => {
    checkAuthAndAdminStatus();
    loadItems();
  });
</script>

<div class="header-action">
  <h1>Item Datenbank</h1>
</div>

{#if !isAuthenticated}
  <section class="card">
    <p class="error">{errorMessage || 'Bitte logge dich ein, um diese Seite zu sehen.'}</p>
  </section>
{:else}
  {#if isAdmin}
    <section class="card">
      <h2>Neues Item anlegen</h2>
      <form on:submit|preventDefault={addItem} class="add-form">
        <input 
          type="number" 
          placeholder="Item-ID (z.B. 2554)" 
          bind:value={newItemId} 
          class="input-field"
          required
        />
        <input 
          type="text" 
          placeholder="Item Name (z.B. Nydhorgg's Shadow Garb)" 
          bind:value={newItemName} 
          class="input-field" 
          required
        />
        <button type="submit" class="btn btn-primary">+ Speichern</button>
      </form>
    </section>
  {/if}

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
    {:else if filteredItems.length === 0}
      <p class="status-text">Keine Items vorhanden.</p>
    {:else}
      <div class="table-container">
        <table class="item-table">
          <thead>
            <tr>
              <th>Icon</th>
              <th>ID</th>
              <th>Name</th>
              <th>Letzter Preis</th>
              <th>Letzter Verkauf</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredItems as item (item.id || item.item_id)}
              {@const displayDate = getBestSoldDate(item, historyCache)}
              {@const displayPrice = getBestPrice(item, historyCache)}
              {@const targetId = item.item_id || item.id}
              
              {#if editingId === item.id && isAdmin}
                <tr>
                  <td class="icon-cell">
                    <img 
                      src={getItemImageUrl(item, editItemId)} 
                      alt="Preview" 
                      on:error={(e) => {
                        const img = e.target;
                        if (img.src.endsWith('.gif')) {
                          // Erster Fallback: .png versuchen
                          img.src = `/items/${editItemId || 501}.png`;
                        } else if (img.src.endsWith('.png')) {
                          // Zweiter Fallback: card.gif nutzen
                          img.onerror = null;
                          img.src = '/items/card.gif';
                        }
                      }} 
                    />
                  </td>
                  <td>
                    <input type="number" bind:value={editItemId} class="input-field" />
                  </td>
                  <td>
                    <input type="text" bind:value={editName} class="input-field edit-input-lg" />
                  </td>
                  <td class="price-cell">{formatZeny(displayPrice)}</td>
                  <td class="date-cell">{formatDate(displayDate)}</td>
                  <td>
                    <div class="btn-group">
                      <button type="button" class="btn btn-primary btn-small" on:click={() => saveItem(item.id)}>Speichern</button>
                      <button type="button" class="btn btn-secondary btn-small" on:click={cancelEditing}>Abbrechen</button>
                    </div>
                  </td>
                </tr>
              {:else}
                <tr>
                  <td class="icon-cell">
                    <img 
                      src={getItemImageUrl(item)} 
                      alt={item.name} 
                      on:error={(e) => {
                        const img = e.target;
                        if (img.src.endsWith('.gif')) {
                          // Erster Fallback: .png versuchen
                          img.src = `/items/${item.item_id}.png`;
                        } else if (img.src.endsWith('.png')) {
                          // Zweiter Fallback: card.gif nutzen
                          img.onerror = null;
                          img.src = '/items/card.gif';
                        }
                      }} 
                    />
                  </td>
                  <td class="id-cell">#{item.item_id}</td>
                  <td class="name-cell">{item.name}</td>
                  <td class="price-cell">{formatZeny(displayPrice)}</td>
                  <td class="date-cell">{formatDate(displayDate)}</td>
                  <td>
                    <div class="btn-group">
                      {#if isAdmin}
                        <button type="button" class="btn btn-secondary btn-small" on:click={() => startEditing(item)}>✏️ Edit</button>
                      {/if}
                      <button 
                        type="button" 
                        class="btn btn-secondary"
                        on:click={() => toggleHistory(item)}
                      >
                        {activeHistoryItemId === targetId ? '▲ Verbergen' : '📊 Preishistorie'}
                      </button>
                    </div>
                  </td>
                </tr>
              {/if}

              {#if activeHistoryItemId === targetId}
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
                              <span class="run-name">{h.run_name || 'Event Run'}</span>
                              <span class="run-date">📅 {formatDate(h.sold_at || h.created_at || h.run_date)}</span>
                              <span class="item-qty">Menge: x{h.quantity || 1}</span>
                              <span class="hist-price">{formatZeny(h.price ?? h.actual_price ?? h.sale_price)}</span>
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
{/if}
