<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let participants = [];
  let newName = '';
  let isLoading = true;
  let errorMessage = '';

  // Zustand für das Editieren
  let editingId = null;
  let editName = '';

  async function loadParticipants() {
    isLoading = true;
    errorMessage = '';
    try {
      const res = await fetch(`${backendUrl}/participants/`);
      if (res.ok) {
        participants = await res.json();
      } else {
        errorMessage = 'Fehler beim Laden der Teilnehmer.';
      }
    } catch (err) {
      console.error(err);
      errorMessage = 'Verbindungsfehler zum Backend!';
    } finally {
      isLoading = false;
    }
  }

  async function addParticipant() {
    if (!newName.trim()) return;

    try {
      const res = await fetch(`${backendUrl}/participants/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });

      if (res.ok) {
        newName = '';
        await loadParticipants();
      } else {
        alert('Teilnehmer konnte nicht angelegt werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Anlegen des Teilnehmers.');
    }
  }

  function startEditing(participant) {
    editingId = participant.id;
    editName = participant.name;
  }

  function cancelEditing() {
    editingId = null;
    editName = '';
  }

  async function saveParticipant(id) {
    if (!editName.trim()) {
      alert('Der Name darf nicht leer sein.');
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/participants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() })
      });

      if (res.ok) {
        editingId = null;
        editName = '';
        await loadParticipants();
      } else {
        alert('Änderung konnte nicht gespeichert werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Aktualisieren des Teilnehmers.');
    }
  }

  onMount(() => {
    loadParticipants();
  });
</script>

<div class="header-action">
  <h1>Teilnehmer Verwaltung</h1>
</div>

<section class="card">
  <h2>Neuen Teilnehmer anlegen</h2>
  <form on:submit|preventDefault={addParticipant} class="add-form">
    <input 
      type="text" 
      placeholder="Name des Teilnehmers" 
      bind:value={newName} 
      class="input-field" 
    />
    <button type="submit" class="create-btn">+ Hinzufügen</button>
  </form>
</section>

<section class="card margin-top">
  <h2>Alle Teilnehmer ({participants.length})</h2>

  {#if isLoading}
    <p class="status-text">Lade Teilnehmer...</p>
  {:else if errorMessage}
    <p class="error">{errorMessage}</p>
  {:else if participants.length === 0}
    <p class="status-text">Noch keine Teilnehmer eingetragen.</p>
  {:else}
    <ul class="participant-list">
      {#each participants as p, i}
        <li class="participant-item">
          <span class="num">{i + 1}.</span>

          {#if editingId === p.id}
            <!-- Bearbeitungs-Modus -->
            <input 
              type="text" 
              bind:value={editName} 
              class="input-field edit-input"
              on:keydown={(e) => e.key === 'Enter' && saveParticipant(p.id)}
            />
            <div class="btn-group">
              <button type="button" class="save-btn" on:click={() => saveParticipant(p.id)}>Speichern</button>
              <button type="button" class="cancel-btn" on:click={cancelEditing}>Abbrechen</button>
            </div>
          {:else}
            <!-- Normaler Anzeige-Modus -->
            <span class="name">{p.name}</span>
            <button type="button" class="action-btn" on:click={() => startEditing(p)}>✏️ Edit</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .header-action { margin-bottom: 1.5rem; }
  h1 { color: #fbbf24; margin: 0; }
  .card { background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; }
  .margin-top { margin-top: 1.5rem; }
  h2 { color: #f8fafc; font-size: 1.1rem; margin-top: 0; margin-bottom: 1rem; }

  .add-form { display: flex; gap: 0.5rem; max-width: 500px; }
  .input-field { flex: 1; padding: 0.5rem 0.8rem; background-color: #0f172a; border: 1px solid #475569; border-radius: 6px; color: white; font-size: 0.9rem; }
  .edit-input { max-width: 300px; }

  .create-btn { background-color: #d97706; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .create-btn:hover { background-color: #b45309; }

  .participant-list { list-style: none; padding: 0; margin: 0; max-width: 600px; }
  .participant-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem; border-bottom: 1px solid #334155; background-color: #0f172a; margin-bottom: 0.4rem; border-radius: 6px; }
  .num { color: #fbbf24; font-weight: 600; min-width: 25px; }
  .name { flex: 1; color: #f8fafc; font-weight: 500; }

  .action-btn { background-color: #334155; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
  .action-btn:hover { background-color: #475569; }

  .btn-group { display: flex; gap: 0.4rem; }
  .save-btn { background-color: #059669; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
  .cancel-btn { background-color: #475569; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }

  .status-text { color: #94a3b8; }
  .error { color: #ef4444; }
</style>
