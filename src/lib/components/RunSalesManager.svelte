<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  export let runId;
  export let allItems = []; // Liste aller geladenen Items aus dem Backend
  export let onSaleAdded = () => {};

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  // Formulardaten
  let searchInput = '';
  let selectedItem = null;
  let priceInput = '';
  let quantityInput = 1;
  let isShop = false;
  let showDropdown = false;

  // Schnell-Anlegen Dialog
  let showQuickCreate = false;
  let newItemName = '';
  let newItemId = '';

  // Filterung für Autocomplete (Such-Treffer nach Name oder ID)
  $: suggestions = searchInput.trim() === '' 
    ? [] 
    : allItems.filter(i => 
        i.name.toLowerCase().includes(searchInput.toLowerCase()) || 
        String(i.item_id).includes(searchInput)
      );

  // Berechneter Preis (mit 2% Abzug falls Shop aktiviert)
  $: rawPrice = Number(priceInput) || 0;
  $: effectivePrice = isShop ? Math.round(rawPrice * 0.98) : rawPrice;

  function selectItem(item) {
    selectedItem = item;
    searchInput = `${item.name} (#${item.item_id})`;
    showDropdown = false;
    // Standardpreis laden, falls hinterlegt
    if (item.default_price) {
      priceInput = item.default_price;
    }
  }

  function handleInput() {
    selectedItem = null;
    showDropdown = true;
  }

  async function quickCreateItem() {
    if (!newItemId || !newItemName.trim()) return;

    const payload = {
      item_id: Number(newItemId),
      name: newItemName.trim(),
      image_url: `/items/${newItemId}.png`
    };

    try {
      const res = await fetch(`${backendUrl}/items/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const createdItem = await res.json();
        allItems = [...allItems, createdItem];
        selectItem(createdItem);
        showQuickCreate = false;
        newItemId = '';
        newItemName = '';
      }
    } catch (err) {
      console.error('Fehler beim Schnell-Anlegen:', err);
    }
  }

  async function submitSale() {
    if (!selectedItem) {
      alert('Bitte wähle ein gültiges Item aus der Liste aus!');
      return;
    }
    if (!priceInput || rawPrice <= 0) {
      alert('Bitte gib einen gültigen Verkaufspreis ein.');
      return;
    }

    const payload = {
      item_id: selectedItem.item_id,
      quantity: Number(quantityInput),
      actual_price: rawPrice,
      is_shop: isShop
    };

    try {
      const res = await fetch(`${backendUrl}/runs/${runId}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Formular zurücksetzen
        searchInput = '';
        selectedItem = null;
        priceInput = '';
        quantityInput = 1;
        isShop = false;
        onSaleAdded(); // Callback zum Aktualisieren der Run-Verkaufsliste
      } else {
        alert('Fehler beim Speichern des Verkaufs.');
      }
    } catch (err) {
      console.error(err);
    }
  }
</script>

<div class="sales-manager-card">
  <h3>📦 Item zu Run hinzufügen</h3>

  <form on:submit|preventDefault={submitSale} class="sales-form">
    <!-- Auto-Complete Suchfeld -->
    <div class="autocomplete-wrapper">
      <input 
        type="text" 
        placeholder="Item suchen (ID oder Name)..." 
        bind:value={searchInput}
        on:input={handleInput}
        on:focus={() => showDropdown = true}
        class="input-field"
        required
      />

      {#if showDropdown && searchInput.trim() !== ''}
        <ul class="dropdown-list">
          {#each suggestions as item}
            <li on:click={() => selectItem(item)}>
              <img 
                src={`/items/${item.item_id}.png`} 
                alt={item.name}
                on:error={(e) => { e.target.onerror = null; e.target.src = '/items/default.png'; }}
              />
              <span>{item.name} <small>(#{item.item_id})</small></span>
            </li>
          {/each}
          {#if suggestions.length === 0}
            <li class="no-match">
              Kein Item gefunden. 
              <button type="button" class="link-btn" on:click={() => { showQuickCreate = true; showDropdown = false; }}>
                ➕ "{searchInput}" neu anlegen
              </button>
            </li>
          {/if}
        </ul>
      {/if}
    </div>

    <!-- Menge & Preis -->
    <input 
      type="number" 
      placeholder="Menge" 
      bind:value={quantityInput} 
      min="1" 
      class="input-field sm-input" 
    />

    <input 
      type="number" 
      placeholder="Verkaufspreis (Zeny)" 
      bind:value={priceInput} 
      class="input-field"
      required 
    />

    <!-- Shop-Option mit 2% Abzug -->
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={isShop} />
      <span>Vending Shop (-2%)</span>
    </label>

    <!-- Ausgabe des finalen Einnahmen-Betrags -->
    <div class="price-preview">
      Einnahme: <strong>{new Intl.NumberFormat('de-DE').format(effectivePrice)} z</strong>
      {#if isShop && rawPrice > 0}
        <span class="tax-hint">(bereits 2% Steuer abgezogen)</span>
      {/if}
    </div>

    <button type="submit" class="add-btn">+ Hinzufügen</button>
  </form>

  <!-- Schnell-Anlege Modal / Inline-Dialog -->
  {#if showQuickCreate}
    <div class="quick-create-box">
      <h4>Item in Datenbank neu anlegen</h4>
      <div class="row">
        <input type="number" placeholder="Item ID" bind:value={newItemId} class="input-field sm-input" />
        <input type="text" placeholder="Item Name" bind:value={newItemName} class="input-field" />
        <button type="button" class="save-btn" on:click={quickCreateItem}>Speichern</button>
        <button type="button" class="cancel-btn" on:click={() => showQuickCreate = false}>Abbrechen</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .sales-manager-card { background: #1e293b; padding: 1.2rem; border-radius: 8px; border: 1px solid #334155; }
  .sales-form { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
  .autocomplete-wrapper { position: relative; flex: 1; min-width: 220px; }
  .input-field { background: #0f172a; border: 1px solid #475569; color: white; padding: 0.5rem 0.8rem; border-radius: 6px; }
  .sm-input { width: 80px; }

  .dropdown-list { position: absolute; top: 100%; left: 0; right: 0; background: #0f172a; border: 1px solid #475569; border-radius: 6px; z-index: 20; list-style: none; padding: 0; margin: 0.2rem 0 0 0; max-height: 200px; overflow-y: auto; }
  .dropdown-list li { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; cursor: pointer; }
  .dropdown-list li:hover { background: #334155; }
  .dropdown-list img { width: 20px; height: 20px; object-fit: contain; }
  .no-match { color: #94a3b8; font-size: 0.85rem; justify-content: space-between; }
  .link-btn { background: none; border: none; color: #fbbf24; cursor: pointer; text-decoration: underline; font-size: 0.85rem; }

  .checkbox-label { display: flex; align-items: center; gap: 0.4rem; color: #cbd5e1; font-size: 0.85rem; cursor: pointer; }
  .price-preview { color: #34d399; font-size: 0.9rem; margin-left: auto; }
  .tax-hint { color: #94a3b8; font-size: 0.75rem; font-style: italic; }

  .add-btn { background: #d97706; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
  
  .quick-create-box { margin-top: 1rem; background: #0f172a; padding: 0.8rem; border-radius: 6px; border: 1px dashed #fbbf24; }
  .quick-create-box h4 { margin: 0 0 0.5rem 0; color: #fbbf24; font-size: 0.9rem; }
  .quick-create-box .row { display: flex; gap: 0.5rem; }
  .save-btn { background: #059669; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; }
  .cancel-btn { background: #475569; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; }
</style>