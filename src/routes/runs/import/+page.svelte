<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let rawInput = '';
  let parsedRun = null;
  let isEditing = false;
  let isSubmitting = false;

  // Bekannte Stammdaten aus der DB für das Matching
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

  // Stammdaten für Autovervollständigung laden
  async function loadMasterData() {
    try {
      const [itemsRes, playersRes] = await Promise.all([
        fetch(`${backendUrl}/items`, { headers: getAuthHeaders() }),
        fetch(`${backendUrl}/players`, { headers: getAuthHeaders() })
      ]);
      if (itemsRes.ok) availableItems = await itemsRes.json();
      if (playersRes.ok) availablePlayers = await playersRes.json();
    } catch (err) {
      console.error('Konnte Stammdaten für Matching nicht laden:', err);
    }
  }

  // --- PARSER FÜR CSV BLOCK ---
  function parseRunBlock() {
    if (!rawInput.trim()) {
      alert('Bitte füge die CSV-Daten ein.');
      return;
    }

    const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
    
    let runDate = new Date().toISOString().split('T')[0];
    let items = [];
    let participants = [];
    let mode = 'header';

    for (let line of lines) {
      const cols = line.split(',').map(c => c.trim());

      // 1. Datum aus Kopfzeile holen
      if (mode === 'header' && cols[0]) {
        if (cols[1] && cols[1].includes('.')) {
          const parts = cols[1].split('.');
          if (parts.length === 3) {
            runDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
        mode = 'items';
        continue;
      }

      if (line.toLowerCase().includes('summe') || line.toLowerCase().includes('split')) {
        continue;
      }
      if (line.replace(/,/g, '') === '' || line.startsWith(',,,,,,') || (/^\d+$/.test(cols[0]) && !cols[1])) {
        mode = 'players';
        continue;
      }

      // 2. Items & Preise (Verkaufspreis und Shoppreis trennen)
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

      // 3. Teilnehmer
      if (mode === 'players' || /^\d{1,2}$/.test(cols[0])) {
        let playerName = cols[1];
        let payoutDate = cols[2] || '';

        if (playerName && playerName.toLowerCase() !== 'summe' && playerName.toLowerCase() !== 'split') {
          // Versuche direkt einen Treffer in den bekannten Spielern zu finden (Fuzzy/Exact Match)
          let matchedPlayer = availablePlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase())?.name || playerName;

          participants.push({
            original_name: playerName,
            name: matchedPlayer,
            payout_date: payoutDate ? `${payoutDate} ${cols[3] || ''}`.trim() : '',
            is_paid: Boolean(payoutDate && payoutDate.length > 0)
          });
        }
      }
    }

    parsedRun = {
      name: `Run vom ${runDate.split('-').reverse().join('.')}`,
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
      // 1. Run anlegen (ohne Run-Typ, rein über Name und Datum)
      const runRes = await fetch(`${backendUrl}/runs/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: parsedRun.name,
          run_date: parsedRun.run_date
        })
      });

      if (!runRes.ok) throw new Error('Fehler beim Erstellen des Runs');
      const createdRun = await runRes.json();
      const runId = createdRun.id;

      // 2. Teilnehmer zuweisen
      if (parsedRun.participants.length > 0) {
        await fetch(`${backendUrl}/runs/${runId}/participants`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(parsedRun.participants.map(p => ({
            name: p.name,
            class_name: 'Sonstiges',
            is_paid: p.is_paid
          })))
        });
      }

      // 3. Items und Preise übergeben
      for (const item of parsedRun.items) {
        if (!item.name) continue;
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
  <h1>Run CSV-Import mit Smart-Matching</h1>
  <p class="subtitle">Füge den kopierten Tabellenblock ein. Das System gleicht Items und Teilnehmer automatisch mit eurer Datenbank ab.</p>

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
          <label>Datum:</label>
          <input type="date" bind:value={parsedRun.run_date} />
        </div>
      </div>

      <h3>📦 Items & Preise (inkl. Shop-Preis)</h3>
      <table class="edit-table">
        <thead>
          <tr>
            <th>Item Name (Autovervollständigung)</th>
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
                <input 
                  type="text" 
                  list="known-items" 
                  bind:value={item.name} 
                  placeholder="Item Name eingeben..." 
                />
              </td>
              <td><input type="number" min="1" bind:value={item.amount} style="width: 60px;" /></td>
              <td><input type="number" min="0" bind:value={item.price} /></td>
              <td><input type="number" min="0" bind:value={item.shop_price} /></td>
              <td><button class="del-mini" on:click={() => removeItemRow(i)}>✕</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
      <datalist id="known-items">
        {#each availableItems as ai}
          <option value={ai.name}></option>
        {/each}
      </datalist>
      <button class="secondary-btn" on:click={addItemRow}>+ Item hinzufügen</button>

      <h3>👥 Teilnehmer-Matching ({parsedRun.participants.length})</h3>
      <div class="participant-match-grid">
        {#each parsedRun.participants as p, i}
          <div class="match-row">
            <span class="original-label">Sheet: <strong>{p.original_name}</strong></span>
            <span class="arrow">➔</span>
            <select bind:value={p.name} class="player-select">
              <option value="">-- Spieler wählen --</option>
              {#each availablePlayers as ap}
                <option value={ap.name}>{ap.name}</option>
              {/each}
            </select>
            <span class="payout-info">{p.payout_date ? `(${p.payout_date})` : '(Offen)'}</span>
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
  .import-container { max-width: 950px; margin: 2rem auto; padding: 0 1rem; color: #f8fafc; }
  h1 { color: #fbbf24; margin-bottom: 0.5rem; }
  .subtitle { color: #94a3b8; margin-bottom: 1.5rem; font-size: 0.95rem; }
  .card { background: #1e293b; border: 1px solid #334155; padding: 1.5rem; border-radius: 8px; }
  textarea { width: 100%; background: #0f172a; border: 1px solid #475569; color: #34d399; padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 0.85rem; margin-top: 0.5rem; margin-bottom: 1rem; }
  
  .form-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; color: #cbd5e1; }
  .field input { background: #0f172a; border: 1px solid #475569; color: white; padding: 0.5rem; border-radius: 4px; }

  .edit-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
  .edit-table th, .edit-table td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #334155; font-size: 0.9rem; }
  .edit-table input { width: 100%; background: #0f172a; border: 1px solid #475569; color: white; padding: 0.4rem; border-radius: 4px; }

  .participant-match-grid { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; max-height: 250px; overflow-y: auto; padding-right: 0.5rem; }
  .match-row { display: flex; align-items: center; gap: 1rem; background: #0f172a; border: 1px solid #334155; padding: 0.5rem 0.8rem; border-radius: 6px; font-size: 0.85rem; }
  .original-label { min-width: 120px; color: #94a3b8; }
  .arrow { color: #fbbf24; }
  .player-select { background: #1e293b; border: 1px solid #475569; color: white; padding: 0.3rem; border-radius: 4px; flex-grow: 1; }
  .payout-info { font-size: 0.75rem; color: #34d399; min-width: 110px; }
  
  .primary-btn { background: #d97706; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .primary-btn:hover { background: #b45309; }
  .secondary-btn { background: #334155; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem; cursor: pointer; margin-bottom: 1.5rem; }
  .cancel-btn { background: #475569; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; }
  .del-mini { background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; font-size: 1rem; }

  .action-buttons { display: flex; gap: 1rem; margin-top: 1.5rem; border-top: 1px solid #334155; padding-top: 1rem; }
</style>