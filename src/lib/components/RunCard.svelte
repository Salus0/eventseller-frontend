<script>
  export let run;
  export let isExpanded = false;
  export let canEdit = false;
  export let isAdmin = false;
  export let statusInfo = null;

  export let roClasses = [];
  export let availableParticipants = [];

  // Zentrales UI-State-Objekt
  export let uiState = { headers: {}, participants: {}, items: {}, sales: {} };

  // Helper & Formatierer
  export let getItemIconUrl = () => '';
  export let getROItemId = () => null;
  export let getItemName = () => '';
  export let handleImgError = () => {};
  export let formatDate = () => '';
  export let formatZeny = () => '';

  // Callbacks
  export let onToggleExpand = () => {};
  export let onStartEditHeader = () => {};
  export let onSaveHeader = () => {};
  export let onCancelEditHeader = () => {};
  export let onDeleteRun = () => {};
  export let togglePayoutStatus = () => {};
  export let enableParticipantEditing = () => {};
  export let removeParticipantFromBuffer = () => {};
  export let addParticipantToBuffer = () => {};
  export let saveParticipants = () => {};
  export let startEditSale = () => {};
  export let handlePriceInput = () => {};
  export let persistSale = () => {};
  export let deleteSaleForItem = () => {};
  export let closeSaleForm = () => {};
  export let openSaleForm = () => {};
  export let enableItemEditing = () => {};
  export let removeItemFromBuffer = () => {};
  export let addItemToBuffer = () => {};
  export let saveItems = () => {};
  export let onDiscordExport = () => {};
</script>

<li class="run-item" class:closed-run-item={statusInfo?.label === 'close'} id="run-{run.id}">
  <!-- RUN HEADER -->
  <div
    class="run-header"
    on:click={() => onToggleExpand(run.id)}
    role="button"
    tabindex="0"
    on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggleExpand(run.id)}
  >
    {#if uiState.headers[run.id]?.isEditing}
      <div class="run-edit-inline" on:click|stopPropagation role="none">
        <input
          type="text"
          bind:value={uiState.headers[run.id].name}
          class="header-edit-input"
          placeholder="Run Name"
        />
        <select
          bind:value={uiState.headers[run.id].seller}
          class="header-edit-input"
        >
          <option value="">-- Kein Verkäufer --</option>
          {#each availableParticipants.filter(p => p.role === 'seller' || p.role === 'admin') as seller}
            <option value={seller.id}>{seller.name}</option>
          {/each}
        </select>
        <button type="button" class="btn btn-primary btn-small" on:click={(e) => onSaveHeader(run.id, e)}>✓</button>
        <button type="button" class="btn btn-danger btn-small" title="Run löschen" on:click={(e) => onDeleteRun(run.id, run.name, e)}>🗑️</button>
        <button type="button" class="btn btn-secondary btn-small" on:click={(e) => onCancelEditHeader(run.id, e)}>✕</button>
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
      {#if statusInfo}
        <span class="badge {statusInfo.cssClass}">{statusInfo.label}</span>
      {/if}

      {#if isAdmin && !uiState.headers[run.id]?.isEditing}
        <button type="button" class="btn btn-icon" title="Run bearbeiten" on:click={(e) => onStartEditHeader(run, e)}>✏️</button>
      {/if}

      <button class="btn btn-secondary" type="button">
        {isExpanded ? '▲ Verbergen' : '▼ Details'}
      </button>
    </div>
  </div>

  <!-- RUN DETAILS -->
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
          <div class="summary-card">
            <span class="summary-label">Verkäufer</span>
            <span class="summary-value seller-name">{run.seller_name || 'Keiner zugewiesen'}</span>
          </div>
        </div>
      {/if}

      <div class="details-grid">
        <!-- TEILNEHMER-BLOCK -->
        <div class="detail-block participant-block">
          <h3>👥 Teilnehmer ({run.participants ? run.participants.length : 0})</h3>
          {#if !uiState.participants[run.id]?.isEditing}
            {#if run.participants && run.participants.length > 0}
              <ul>
                {#each run.participants as p, i}
                  <li class="participant-row" class:paid-row={p.is_paid}>
                    <div class="p-info">
                      <strong class="num-prefix">{i + 1}.</strong>
                      <span class="p-info-name">{p.name}</span>
                      {#if p.class_name}<span class="class-tag">{p.class_name}</span>{/if}
                    </div>
                    {#if canEdit}
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
            {#if canEdit}
              <button type="button" class="btn btn-secondary" on:click={() => enableParticipantEditing(run)}>➕ Add/Edit</button>
            {/if}
          {:else}
            <ul class="edit-list">
              {#each uiState.participants[run.id]?.list || [] as p, idx}
                <li class="edit-row">
                  <span class="edit-name"><strong class="num-prefix">{idx + 1}.</strong> {p.name}</span>
                  <select bind:value={p.class_name} class="input-sm inline-select">
                    {#each roClasses as roClass}<option value={roClass}>{roClass}</option>{/each}
                  </select>
                  <button type="button" class="btn btn-danger btn-small" on:click={() => removeParticipantFromBuffer(run.id, idx)}>✕</button>
                </li>
              {/each}
            </ul>
            <div class="add-row">
              <select bind:value={uiState.participants[run.id].newParticipantId} class="input-sm">
                <option value="">-- Spieler wählen --</option>
                {#each availableParticipants.filter(ap => !(uiState.participants[run.id]?.list || []).some(p => Number(p.participant_id) === Number(ap.id))) as ap}
                  <option value={ap.id}>{ap.name}</option>
                {/each}
              </select>
              <select bind:value={uiState.participants[run.id].newClass} class="input-sm">
                <option value="">-- Klasse --</option>
                {#each roClasses as roClass}<option value={roClass}>{roClass}</option>{/each}
              </select>
              <button type="button" class="btn btn-secondary btn-small" on:click={() => addParticipantToBuffer(run.id)}>+</button>
            </div>
            <div class="btn-group">
              <button type="button" class="btn btn-primary" on:click={() => saveParticipants(run.id)}>Speichern</button>
              <button type="button" class="btn btn-secondary" on:click={() => uiState.participants[run.id].isEditing = false}>Abbrechen</button>
            </div>
          {/if}
        </div>

        <!-- DROPS / ITEMS BLOCK -->
        <div class="detail-block item-block">
          <h3>📦 Drops / Items ({run.items ? run.items.length : 0})</h3>

          {#if !uiState.items[run.id]?.isEditing}
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
                      {#if uiState.sales[item.id] && canEdit}
                        <div class="inline-sale-form">
                          <input
                            type="text"
                            placeholder="Preis"
                            value={uiState.sales[item.id].priceDisplay || ''}
                            on:input={(e) => handlePriceInput(item.id, e, uiState.sales[item.id].mode === 'edit')}
                            class="price-input input-sm"
                          />
                          <input
                            type="datetime-local"
                            bind:value={uiState.sales[item.id].saleDate}
                            class="date-input input-sm"
                          />
                          <label class="checkbox-label">
                            <input type="checkbox" bind:checked={uiState.sales[item.id].isShop} />
                            Shop
                          </label>
                          <button type="button" class="btn btn-primary btn-small" on:click={() => persistSale(run.id, item, uiState.sales[item.id].mode === 'edit')}>✓</button>
                          {#if uiState.sales[item.id].mode === 'edit'}
                            <button type="button" class="btn btn-danger btn-small" on:click={() => deleteSaleForItem(run.id, item)} title="Verkauf zurücksetzen">🗑️</button>
                          {/if}
                          <button type="button" class="btn btn-secondary btn-small" on:click={() => closeSaleForm(item.id)}>✕</button>
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
                        {#if canEdit}
                          <button type="button" class="btn btn-icon" on:click={() => startEditSale(item)} title="Verkauf bearbeiten">✏️</button>
                        {/if}
                      {:else if canEdit}
                        <button type="button" class="btn btn-secondary btn-small" on:click={() => openSaleForm(item.id)}>
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

            {#if canEdit}
              <button type="button" class="btn btn-secondary" on:click={() => enableItemEditing(run)}>
                ➕ Add/Edit
              </button>
            {/if}

          {:else}
            <ul class="edit-list">
              {#each uiState.items[run.id]?.list || [] as item, idx}
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
                  <button type="button" class="btn btn-danger btn-small" on:click={() => removeItemFromBuffer(run.id, idx)}>✕</button>
                </li>
              {/each}
            </ul>

            <div class="add-row">
              <input
                type="number"
                min="1"
                placeholder="Anzahl"
                bind:value={uiState.items[run.id].newAmount}
                class="qty-field"
              />
              <input
                type="text"
                placeholder="Item Name oder RO-ID"
                list="master-items-list"
                bind:value={uiState.items[run.id].newNameOrId}
                class="flex-grow-1"
              />
              <button type="button" class="btn btn-secondary" on:click={() => addItemToBuffer(run.id)}>+</button>
            </div>

            <div class="btn-group">
              <button type="button" class="btn btn-primary" on:click={() => saveItems(run.id)}>Speichern</button>
              <button type="button" class="btn btn-secondary" on:click={() => uiState.items[run.id].isEditing = false}>Abbrechen</button>
            </div>
          {/if}
        </div>

      </div>

      <!-- DISCORD EXPORT BUTTON (Nur sichtbar wenn canEdit true ist) -->
      {#if canEdit}
        <div class="run-footer-actions">
          <button type="button" class="btn btn-discord" on:click={() => onDiscordExport(run)}>
            <svg class="discord-icon" viewBox="0 0 127.14 96.36" width="16" height="16" fill="currentColor">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a74.57,74.57,0,0,0,64.32,0c.87.69,1.76,1.37,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1,105.25,105.25,0,0,0,32.19-16.14c2.64-27.38-4.51-51.11-18.92-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74c6.51,0,11.66,5.77,11.43,12.74C53.88,60,48.83,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74c6.5,0,11.65,5.77,11.43,12.74C96.12,60,91.08,65.69,84.69,65.69Z"/>
            </svg>
            Post Discord
          </button>
        </div>
      {/if}

    </div>
  {/if}
</li>