<script>
  import { goto } from '$app/navigation';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let rawInput = '';
  let parsedRun = null;
  let isEditing = false;
  let isSubmitting = false;

  function getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  // --- CSV PARSER FÜR ECHTE TABELLEN-DATEN ---
  function parseRunBlock() {
    if (!rawInput.trim()) {
      alert('Bitte füge die CSV-Daten ein.');
      return;
    }

    // Zeilenweise aufteilen
    const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
    
    let runType = 'EC';
    let runDate = new Date().toISOString().split('T')[0];
    let items = [];
    let participants = [];

    let mode = 'header'; // 'header', 'items', 'players'

    for (let line of lines) {
      const cols = line.split(',').map(c => c.trim());

      // 1. Kopfzeile erkennen (z.B. "EC+ET,24.07.2026")
      if (mode === 'header' && cols[0]) {
        runType = cols[0];
        if (cols[1] && cols[1].includes('.')) {
          const parts = cols[1].split('.');
          if (parts.length === 3) {
            runDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
          }
        }
        mode = 'items';
        continue;
      }

      // Prüfen ob wir bei Summe / Trenner / Spielern sind
      if (line.toLowerCase().includes('summe') || line.toLowerCase().includes('split')) {
        continue;
      }
      if (line.replace(/,/g, '') === '' || line.startsWith(',,,,,,') || /^\d+$/.test(cols[0]) && !cols[1]) {
        // Trennzeile erreicht -> ab jetzt kommen Spieler
        mode = 'players';
        continue;
      }

      // 2. Items einlesen (wenn wir im Item-Modus sind und keine Spieler-Nummer am Anfang steht)
      if (mode === 'items') {
        // Schauen ob Spalte 1 oder 2 einen Itemnamen enthält
        let itemName = cols[1] || cols[0];
        let priceStr = cols[2] || cols[3] || '0';
        
        // Preis bereinigen (Punkte entfernen, Kommas zu Punkten)
        let cleanPrice = parseInt(priceStr.replace(/\./g, '').replace(',', '.'), 10) || 0;

        if (itemName && itemName !== runType && !itemName.toLowerCase().includes('summe')) {
          items.push({
            name: itemName,
            amount: 1,
            price: cleanPrice
          });
        }
      }

      // 3. Spieler einlesen (Modus 'players' oder Spalte 1 ist eine Zahl von 1 bis 12)
      if (mode === 'players' || /^\d{1,2}$/.test(cols[0])) {
        let playerNum = cols[0];
        let playerName = cols[1];
        let payoutDate = cols[2] || '';

        if (playerName && playerName.toLowerCase() !== 'summe' && playerName.toLowerCase() !== 'split') {
          participants.push({
            name: playerName,
            payout_date: payoutDate,
            is_paid: Boolean(payoutDate && payoutDate.length > 0)
          });
        }
      }
    }

    parsedRun = {
      name: `${runType} vom ${runDate.split('-').reverse().join('.')}`,
      run_type: runType,
      run_date: runDate,
      items: items.length > 0 ? items : [{ name: 'Unbekanntes Item', amount: 1, price: 0 }],
      participants: participants
    };

    isEditing = true;
  }

  function addItemRow() {
    parsedRun.items = [...parsedRun.items, { name: '', amount: 1, price: 0 }];
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
      const runRes = await fetch(`${backendUrl}/runs/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: parsedRun.name,
          run_type: parsedRun.run_type,
          run_date: parsedRun.run_date
        })
      });

      if (!runRes.ok) throw new Error('Fehler beim Erstellen des Runs');
      const createdRun = await runRes.json();
      const runId = createdRun.id;

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

      for (const item of parsedRun.items) {
        if (!item.name) continue;
        await fetch(`${backendUrl}/runs/${runId}/items`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify([{
            name: item.name,
            amount: Number(item.amount) || 1,
            quantity: Number(item.amount) || 1
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
  <p class="subtitle">Kopiere den Run direkt aus Google Sheets/Excel und füge ihn hier ein.</p>

  {#if !isEditing}
    <div class="card">
      <label for="raw-input"><strong>Tabellen-Block (CSV) einfügen:</strong></label>
      <textarea 
        id="raw-input" 
        rows="12" 
        bind:value={rawInput} 
        placeholder="EC+ET,24.07.2026&#10;,Nyd,16.490.000&#10;..."
      ></textarea>
      <button class="primary-btn" on:click={parseRunBlock}>Einlesen & Vorschau anzeigen</button>
    </div>
  {:else}
    <div class="card preview-card">
      <h2>Vorschau & Korrektur</h2>

      <div class="form-grid">
        <div class="field">
          <label>Run Name:</label>
          <input type="text" bind:value={parsedRun.name} />
        </div>
        <div class="field">
          <label>Run Typ:</label>
          <input type="text" bind:value={parsedRun.run_type} />
        </div>
        <div class="field">
          <label>Datum:</label>
          <input type="date" bind:value={parsedRun.run_date} />
        </div>
      </div>

      <h3>📦 Items & Preise</h3>
      <table class="edit-table">
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Menge</th>
            <th>Preis (Zeny)</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {#each parsedRun.items as item, i}
            <tr>
              <td><input type="text" bind:value={item.name} /></td>
              <td><input type="number" min="1" bind:value={item.amount} style="width: 70px;" /></td>
              <td><input type="number" min="0" bind:value={item.price} /></td>
              <td><button class="del-mini" on:click={() => removeItemRow(i)}>✕</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
      <button class="secondary-btn" on:click={addItemRow}>+ Item hinzufügen</button>

      <h3>👥 Teilnehmer ({parsedRun.participants.length})</h3>
      <div class="participant-chips">
        {#each parsedRun.participants as p, i}
          <div class="chip">
            <span>{i+1}. <strong>{p.name}</strong> {p.payout_date ? `(${p.payout_date})` : '(Offen)'}</span>
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
  .import-container { max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #f8fafc; }
  h1 { color: #fbbf24; margin-bottom: 0.5rem; }
  .subtitle { color: #94a3b8; margin-bottom: 1.5rem; font-size: 0.95rem; }
  .card { background: #1e293b; border: 1px solid #334155; padding: 1.5rem; border-radius: 8px; }
  textarea { width: 100%; background: #0f172a; border: 1px solid #475569; color: #34d399; padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 0.85rem; margin-top: 0.5rem; margin-bottom: 1rem; }
  
  .form-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; color: #cbd5e1; }
  .field input { background: #0f172a; border: 1px solid #475569; color: white; padding: 0.5rem; border-radius: 4px; }

  .edit-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
  .edit-table th, .edit-table td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #334155; font-size: 0.9rem; }
  .edit-table input { width: 100%; background: #0f172a; border: 1px solid #475569; color: white; padding: 0.4rem; border-radius: 4px; }

  .participant-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; }
  .chip { background: #0f172a; border: 1px solid #334155; padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; }
  
  .primary-btn { background: #d97706; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .primary-btn:hover { background: #b45309; }
  .secondary-btn { background: #334155; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem; cursor: pointer; margin-bottom: 1.5rem; }
  .cancel-btn { background: #475569; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; }
  .del-mini { background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; font-size: 1rem; }

  .action-buttons { display: flex; gap: 1rem; margin-top: 1.5rem; border-top: 1px solid #334155; padding-top: 1rem; }
</style>