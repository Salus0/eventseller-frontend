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
              <button type="button" class="btn btn-primary btn-small" on:click={() => { showQuickCreate = true; showDropdown = false; }}>
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

    <button type="submit" class="btn btn-primary">+ Hinzufügen</button>
  </form>

  <!-- Schnell-Anlege Modal / Inline-Dialog -->
  {#if showQuickCreate}
    <div class="quick-create-box">
      <h4>Item in Datenbank neu anlegen</h4>
      <div class="row">
        <input type="number" placeholder="Item ID" bind:value={newItemId} class="input-field sm-input" />
        <input type="text" placeholder="Item Name" bind:value={newItemName} class="input-field" />
        <button type="button" class="btn btn-primary" on:click={quickCreateItem}>Speichern</button>
        <button type="button" class="btn btn-secondary" on:click={() => showQuickCreate = false}>Abbrechen</button>
      </div>
    </div>
  {/if}
</div>
