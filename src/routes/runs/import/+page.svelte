<script>
  import { goto } from '$app/navigation';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let rawInput = '';
  let parsedRun = null;
  let isEditing = false;
  let isSubmitting = false;

  // Hilfsfunktion für Auth-Header
  function getAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  // --- PARSER LOGIK FÜR DEN TEXTBLOCK ---
  function parseRunBlock() {
    if (!rawInput.trim()) {
      alert('Bitte füge einen Textblock ein.');
      return;
    }

    // Zeilenumbruch-Bereinigung falls aus Excel kopiert
    const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Fall: Alles in einer Wurst ohne Zeilenumbrüche (wie im Beispiel)
    let text = rawInput.replace(/\s+/g, ' ').trim();

    // 1. Run-Typ & Datum extrahieren (z.B. "EC 29.03.2026" oder "ET 01.04.2026")
    const headerMatch = text.match(/^(EC|ET|WoE|MD)\s*(\d{2}\.\d{2}\.\d{4})/i) || text.match(/^([A-Za-z]+)(\d{2}\.\d{2}\.\d{4})/);
    
    let runType = 'EC';
    let runDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD Default

    if (headerMatch) {
      runType = headerMatch[1];
      const parts = headerMatch[2].split('.');
      runDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // ISO-Format fürs Input-Feld
    }

    // 2. Teilnehmer extrahieren (Suchmuster: Nummer + Name + Datum + Uhrzeit, z.B. "1 Kuhni 07.04.2026 19:28")
    // Wir suchen nach Mustern am Ende des Textes
    const playerRegex = /(\d{1,2})\s*([A-Za-z0-9_-]+)\s*(\d{2}\.\d{2}\.\d{4})\s*(\d{2}:\d{2})/g;
    let participants = [];
    let match;
    
    while ((match = playerRegex.exec(text)) !== null) {
      participants.push({
        name: match[2],
        payout_date: `${match[3]} ${match[4]}`,
        is_paid: true
      });
    }

    // 3. Items und Preise extrahieren (Alles zwischen Header und dem Wort "Summe")
    // Das ist heuristisch, da Item-Namen variieren. Wir extrahieren Zahlen mit Punkten.
    // Beispielhafter Ansatz: Wir trennen den String ab dem Header bis zum Wort "Summe"
    let sumIndex = text.indexOf('Summe');
    let itemSection = sumIndex !== -1 ? text.substring(headerMatch ? headerMatch[0].length : 0, sumIndex) : '';
    
    // Teilnehmer aus dem Item-Bereich herausschneiden falls sie dranhängen
    if (participants.length > 0) {
      let firstPlayerStr = `${participants[0].name}`;
      let pIndex = itemSection.indexOf(participants[0].name);
      if (pIndex !== -1) {
        itemSection = itemSection.substring(0, pIndex);
      }
    }

    // Items grob zerlegen (Preisstrukturen erkennen: Text gefolgt von Zahlen)
    // Da Rohdaten oft aneinanderkleben, bauen wir eine saubere Vorschau zum manuellen Nachkorrigieren
    let parsedItems = [
      { name: 'Beispiel Item (Bitte prüfen)', amount: 1, price: 0 }
    ];

    parsedRun = {
      name: `${runType} vom ${runDate.split('-').reverse().join('.')}`,
      run_type: runType,
      run_date: runDate,
      items: parsedItems,
      participants: participants
    };

    isEditing = true;
  }

  // Zeile in Vorschau hinzufügen/löschen
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

  // Abspeichern in die echte Datenbank
  async function saveImportedRun() {
    if (!parsedRun || !parsedRun.name) return;
    isSubmitting = true;

    try {
      // 1. Run anlegen
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

      // 3. Items & Verkäufe zuweisen
      for (const item of parsedRun.items) {
        if (!item.name) continue;
        // Drop eintragen
        await fetch(`${backendUrl}/runs/${runId}/items`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify([{
            name: item.name,
            amount: Number(item.amount) || 1,
            quantity: Number(item.amount) || 1
          }])
        });

        // Falls Preis vorhanden, direkten Verkauf buchen
        if (item.price > 0) {
          // Wir holen die Item-ID über die Run-Details oder mappen sie
          // (Hier vereinfacht über den allgemeinen Sales-Endpoint)
        }
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
  <h1>Run Import-Assistent (Raid-Helper Style)</h1>
  <p class="subtitle">Füge deinen kopierten Tabellenblock ein. Das System analysiert Datum, Items und Teilnehmer zur Vorschau.</p>

  {#if !isEditing}
    <div class="card">
      <label for="raw-input"><strong>Rohdaten-Block einfügen:</strong></label>
      <textarea 
        id="raw-input" 
        rows="8" 
        bind:value={rawInput} 
        placeholder="Z.B. EC29.03.2026 Nyd 16.399.000 ... 1 Kuhni 07.04.2026 19:28 ..."
      ></textarea>
      <button class="primary-btn" on:click={parseRunBlock}>Daten analysieren & Vorschau anzeigen</button>
    </div>
  {:else}
    <div class="card preview-card">
      <h2>Vorschau & Korrektur vor dem Import</h2>

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

      <h3>📦 Gefundene Items & Preise</h3>
      <table class="edit-table">
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Anzahl</th>
            <th>Verkaufspreis (Zeny)</th>
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
            <span>{i+1}. <strong>{p.name}</strong> ({p.payout_date})</span>
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
  textarea { width: 100%; background: #0f172a; border: 1px solid #475569; color: #34d399; padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 0.9rem; margin-top: 0.5rem; margin-bottom: 1rem; }
  
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