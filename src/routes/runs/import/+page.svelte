<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let rawInput = '';
  let parsedRun = null;
  let isEditing = false;
  let isSubmitting = false;

  let availableItems = [];
  let availablePlayers = [];

  onMount(async () => {
    await loadMasterData();
  });

  function getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async function loadMasterData() {
    try {
      const [itemsRes, playersRes] = await Promise.all([
        fetch(`${backendUrl}/items/`, { headers: getAuthHeaders() }),
        fetch(`${backendUrl}/participants/`, { headers: getAuthHeaders() })
      ]);
      if (itemsRes.ok) availableItems = await itemsRes.json();
      if (playersRes.ok) availablePlayers = await playersRes.json();
    } catch (err) {
      console.error('Konnte Stammdaten nicht laden:', err);
    }
  }

  function parseRunBlock() {
    if (!rawInput.trim()) {
      alert('Bitte füge die CSV-Daten ein.');
      return;
    }

    const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
    
    let runNameCustom = '';
    let runDate = new Date().toISOString().split('T')[0];
    let items = [];
    let participants = [];
    let mode = 'header';

    for (let line of lines) {
      const cols = line.split(',').map(c => c.trim());

      if (mode === 'header' && cols[0]) {
        let prefix = cols[0];
        let datePart = cols[1] || '';

        if (datePart.includes('.')) {
          const parts = datePart.split('.');
          if (parts.length === 3) {
            runDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }

        runNameCustom = datePart ? `${prefix} ${datePart}` : prefix;
        mode = 'items';
        continue;
      }

      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('summe') || lowerLine.includes('split')) {
        continue;
      }

      if (line.replace(/,/g, '') === '' || line.startsWith(',,,,,,') || (/^\d+$/.test(cols[0]) && !cols[1])) {
        mode = 'players';
        continue;
      }

      if (mode === 'items') {
        let itemName = cols[1] || cols[0];
        let priceStr = cols[2] || '0';
        let shopPriceStr = cols[3] || '0';
        
        let cleanPrice = parseInt(priceStr.replace(/\./g, '').replace(',', '.'), 10) || 0;
        let cleanShopPrice = parseInt(shopPriceStr.replace(/\./g, '').replace(',', '.'), 10) || 0;

        if (itemName && itemName !== cols[0] && !itemName.toLowerCase().includes('summe')) {
          items.push({
            name: itemName,
            amount: 1,
            price: cleanPrice,
            shop_price: cleanShopPrice
          });
        }
      }

      if (mode === 'players' || /^\d{1,2}$/.test(cols[0])) {
        let playerName = cols[1];
        let payoutDateStr = cols[2] || '';
        let payoutTimeStr = cols[3] || '';

        if (playerName && playerName.toLowerCase() !== 'summe' && playerName.toLowerCase() !== 'split') {
          let matched = availablePlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
          // Wenn kein Match in der DB, nehmen wir direkt den Namen aus dem Sheet als Standard
          let finalName = matched ? matched.name : playerName;

          let payoutDateTime = '';
          let isPaid = false;

          if (payoutDateStr && payoutDateStr.includes('.')) {
            const pParts = payoutDateStr.split('.');
            if (pParts.length === 3) {
              const formattedDate = `${pParts[2]}-${pParts[1]}-${pParts[0]}`;
              payoutDateTime = payoutTimeStr ? `${formattedDate}T${payoutTimeStr}` : `${formattedDate}T00:00`;
              isPaid = true;
            }
          }

          participants.push({
            original_name: playerName,
            name: finalName,
            payout_date: payoutDateTime,
            is_paid: isPaid
          });
        }
      }
    }

    parsedRun = {
      name: runNameCustom || `Run vom ${runDate.split('-').reverse().join('.')}`,
      run_date: runDate,
      items: items,
      participants: participants
    };

    isEditing = true;
  }

  function addItemRow() {
    parsedRun.items = [...parsedRun.items, { name: '', amount: 1, price: 0, shop_price: 0 }];
  }

  function removeItemRow(index) {
    parsedRun.items.splice(index, 1);
    parsedRun.items = [...parsedRun.items];
  }

  function removeParticipantRow(index) {
    parsedRun.participants.splice(index, 1);
    parsedRun.participants = [...parsedRun.participants];
  }

    async function saveImportedRun() {
        if (!parsedRun || !parsedRun.name) return;
        isSubmitting = true;

        try {
        // Datum im Format YYYY-MM-DD mit der festen Uhrzeit kombinieren
        const createdAtFixed = `${parsedRun.run_date} 20:15:00`;

        const runRes = await fetch(`${backendUrl}/runs/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
            name: parsedRun.name,
            created_at: createdAtFixed
            })
        });

        if (!runRes.ok) {
            const errorText = await runRes.text();
            throw new Error(`Server-Fehler (${runRes.status}): ${errorText}`);
        }

        const createdRun = await runRes.json();
        const runId = createdRun.id;

        if (parsedRun.participants.length > 0) {
            const payloadParticipants = parsedRun.participants.map(p => ({
            name: p.name && p.name.trim() !== '' ? p.name : p.original_name,
            class_name: 'Sonstiges',
            is_paid: p.is_paid,
            payout_at: p.payout_date || null
            }));

            await fetch(`${backendUrl}/runs/${runId}/participants`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payloadParticipants)
            });
        }

        for (const item of parsedRun.items) {
            if (!item.name || item.name.trim() === '') continue;
            await fetch(`${backendUrl}/runs/${runId}/items`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify([{
                name: item.name,
                amount: Number(item.amount) || 1,
                quantity: Number(item.amount) || 1,
                price: Number(item.price) || 0,
                shop_price: Number(item.shop_price) || 0
            }])
            });
        }

        alert('Run erfolgreich importiert!');
        goto('/runs');
        } catch (err) {
        console.error(err);
        alert('Fehler beim Importieren: ' + err.message);
        } finally {
        isSubmitting = false;
        }
    }
</script>

<div class="import-container">
  <h1>Run CSV-Import</h1>
  <p class="subtitle">Füge deinen kopierten Tabellenblock ein. Ungematchte Items oder Spieler werden automatisch mit ihrem Originalnamen übernommen.</p>

  {#if !isEditing}
    <div class="card">
      <label for="raw-input"><strong>Tabellen-Block einfügen:</strong></label>
      <textarea 
        id="raw-input" 
        rows="12" 
        bind:value={rawInput} 
        placeholder="EC+ET,24.07.2026&#10;,Nyd,16.490.000,16.160.200&#10;..."
      ></textarea>
      <button class="primary-btn" on:click={parseRunBlock}>Einlesen & Vorschau anzeigen</button>
    </div>
  {:else}
    <div class="card preview-card">
      <h2>Vorschau & Zuordnung anpassen</h2>

      <div class="form-grid">
        <div class="field" style="grid-column: span 2;">
          <label>Run Name:</label>
          <input type="text" bind:value={parsedRun.name} />
        </div>
        <div class="field">
          <label>Datum des Runs:</label>
          <input type="date" bind:value={parsedRun.run_date} />
        </div>
      </div>

      <h3>📦 Items, Verkaufspreis & Shoppreis</h3>
      <table class="edit-table">
        <thead>
          <tr>
            <th>Item Name (Auswahl oder Freitext)</th>
            <th>Menge</th>
            <th>Verkaufspreis</th>
            <th>Shoppreis</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {#each parsedRun.items as item, i}
            <tr>
              <td>
                <select bind:value={item.name} class="item-select">
                  <option value="">-- Item aus DB wählen (oder unten tippen) --</option>
                  {#each availableItems as ai}
                    <option value={ai.name}>{ai.name}</option>
                  {/each}
                </select>
                <input type="text" bind:value={item.name} placeholder="Oder frei tippen..." class="fallback-input" />
              </td>
              <td><input type="number" min="1" bind:value={item.amount} style="width: 60px;" /></td>
              <td><input type="number" min="0" bind:value={item.price} /></td>
              <td><input type="number" min="0" bind:value={item.shop_price} /></td>
              <td><button class="del-mini" on:click={() => removeItemRow(i)}>✕</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
      <button class="secondary-btn" on:click={addItemRow}>+ Item hinzufügen</button>

      <h3>👥 Teilnehmer & Auszahlungs-Daten ({parsedRun.participants.length})</h3>
      <div class="participant-match-grid">
        {#each parsedRun.participants as p, i}
          <div class="match-row">
            <span class="original-label" title="Aus Sheet: {p.original_name}">Sheet: <strong>{p.original_name}</strong></span>
            <span class="arrow">➔</span>
            <select bind:value={p.name} class="player-select">
              <option value="">-- Behalten ({p.original_name}) --</option>
              {#each availablePlayers as ap}
                <option value={ap.name}>{ap.name}</option>
              {/each}
            </select>
            <div class="payout-box">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={p.is_paid} /> Ausgezahlt am:
              </label>
              <input type="datetime-local" bind:value={p.payout_date} disabled={!p.is_paid} class="date-input" />
            </div>
            <button class="del-mini" on:click={() => removeParticipantRow(i)}>✕</button>
          </div>
        {/each}
      </div>

      <div class="action-buttons">
        <button class="primary-btn" on:click={saveImportedRun} disabled={isSubmitting}>
          {isSubmitting ? 'Wird gespeichert...' : '🚀 Verbindlich in DB importieren'}
        </button>
        <button class="cancel-btn" on:click={() => isEditing = false}>Abbrechen / Neu einfügen</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .import-container { max-width: 1000px; margin: 2rem auto; padding: 0 1rem; color: #f8fafc; }
  h1 { color: #fbbf24; margin-bottom: 0.5rem; }
  .subtitle { color: #94a3b8; margin-bottom: 1.5rem; font-size: 0.95rem; }
  .card { background: #1e293b; border: 1px solid #334155; padding: 1.5rem; border-radius: 8px; }
  textarea { width: 100%; background: #0f172a; border: 1px solid #475569; color: #34d399; padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 0.85rem; margin-top: 0.5rem; margin-bottom: 1rem; }
  
  .form-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; color: #cbd5e1; }
  .field input { background: #0f172a; border: 1px solid #475569; color: white; padding: 0.5rem; border-radius: 4px; }

  .edit-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
  .edit-table th, .edit-table td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #334155; font-size: 0.9rem; vertical-align: middle; }
  .edit-table input, .edit-table select { width: 100%; background: #0f172a; border: 1px solid #475569; color: white; padding: 0.4rem; border-radius: 4px; }
  .fallback-input { margin-top: 0.3rem; font-size: 0.8rem; }

  .participant-match-grid { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; max-height: 300px; overflow-y: auto; padding-right: 0.5rem; }
  .match-row { display: flex; align-items: center; gap: 0.8rem; background: #0f172a; border: 1px solid #334155; padding: 0.5rem 0.8rem; border-radius: 6px; font-size: 0.85rem; }
  .original-label { min-width: 100px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .arrow { color: #fbbf24; }
  .player-select { background: #1e293b; border: 1px solid #475569; color: white; padding: 0.4rem; border-radius: 4px; min-width: 150px; }
  
  .payout-box { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; }
  .checkbox-label { display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: #94a3b8; cursor: pointer; white-space: nowrap; }
  .date-input { background: #1e293b; border: 1px solid #475569; color: white; padding: 0.3rem; border-radius: 4px; font-size: 0.8rem; }

  .primary-btn { background: #d97706; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .primary-btn:hover { background: #b45309; }
  .secondary-btn { background: #334155; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem; cursor: pointer; margin-bottom: 1.5rem; }
  .cancel-btn { background: #475569; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; }
  .del-mini { background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; font-size: 1rem; }

  .action-buttons { display: flex; gap: 1rem; margin-top: 1.5rem; border-top: 1px solid #334155; padding-top: 1rem; }
</style>