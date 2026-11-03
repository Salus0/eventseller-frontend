<script>
  import { onMount } from 'svelte';
  import { PUBLIC_BACKEND_URL } from '$env/static/public';

  const backendUrl = PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';

  let participants = [];
  let isLoading = true;
  let errorMessage = '';

  let jwtToken = '';
  let isAdmin = false;

  // Zustand zum Aufklappen des Anlegen-Formulars
  let showCreateForm = false;
  let newName = '';
  let newDiscordId = '';
  let newRole = 'user';
  let isCreating = false;

  const availableRoles = [
    { value: 'user', label: 'User' },
    { value: 'seller', label: 'Seller' },
    { value: 'admin', label: 'Admin' }
  ];

  function checkAuth() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      jwtToken = token;
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
    }
  }

  async function loadParticipants() {
    isLoading = true;
    errorMessage = '';

    try {
      const headers = {};
      if (jwtToken) {
        headers['Authorization'] = `Bearer ${jwtToken}`;
    }

      const res = await fetch(`${backendUrl}/participants/`, { headers });

      if (res.ok) {
        const data = await res.json();
        
        // Sortierung: 1. Rolle (admin -> seller -> user), 2. Alphabetisch nach Name
        const roleOrder = { admin: 1, seller: 2, user: 3 };

        participants = data.sort((a, b) => {
          const roleA = roleOrder[a.role] || 4;
          const roleB = roleOrder[b.role] || 4;

          if (roleA !== roleB) {
            return roleA - roleB;
          }

          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB, 'de', { sensitivity: 'base' });
        });

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
    if (!isAdmin) {
      alert('Keine Berechtigung!');
      return;
    }
    if (!newName.trim()) {
      alert('Bitte gib einen Namen ein.');
      return;
    }

    isCreating = true;
    try {
      const res = await fetch(`${backendUrl}/participants/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ 
          name: newName.trim(),
          discord_id: newDiscordId.trim() || null,
          role: newRole || 'user'
        })
      });

      if (res.ok) {
        newName = '';
        newDiscordId = '';
        newRole = 'user';
        showCreateForm = false;
        await loadParticipants();
      } else {
        alert('Teilnehmer konnte nicht angelegt werden.');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Anlegen des Teilnehmers.');
    } finally {
      isCreating = false;
    }
  }

  onMount(() => {
    checkAuth();
    loadParticipants();
  });
</script>

<div class="header-action">
  <h1>Teilnehmer Übersicht</h1>
  
  {#if isAdmin}
    <div class="header-admin-actions">
      <button class="btn btn-primary" on:click={() => showCreateForm = !showCreateForm}>
        {showCreateForm ? '✖ Schließen' : '+ Neuen Teilnehmer anlegen'}
      </button>
    </div>
  {/if}
</div>

{#if isAdmin && showCreateForm}
  <section class="card margin-top">
    <h2>Neuen Teilnehmer anlegen</h2>
    <form on:submit|preventDefault={addParticipant} class="add-form">
      <input 
        type="text" 
        placeholder="Name des Teilnehmers *" 
        bind:value={newName} 
        class="input-field" 
        required 
      />
      <select bind:value={newRole} class="input-field">
        {#each availableRoles as r}
          <option value={r.value}>{r.label}</option>
        {/each}
      </select>
      <input 
        type="text" 
        placeholder="Discord ID (optional)" 
        bind:value={newDiscordId} 
        class="input-field" 
      />
      <button type="submit" class="btn btn-primary" disabled={isCreating}>
        {isCreating ? 'Wird gespeichert...' : 'Hinzufügen'}
      </button>
    </form>
  </section>
{/if}

<section class="card margin-top">
  <h2>Alle Teilnehmer ({participants.length})</h2>

  {#if isLoading}
    <p class="status-text">Lade Teilnehmer...</p>
  {:else if errorMessage}
    <p class="error">{errorMessage}</p>
  {:else if participants.length === 0}
    <p class="status-text">Noch keine Teilnehmer eingetragen.</p>
  {:else}
    <div class="participants-grid">
      {#each participants as p}
        {@const discordId = p.discord_id || p.discordId}
        {@const discordAvatar = p.avatar || p.discord_avatar}
        {@const role = p.role || 'user'}
        
        <a href="/participants/{p.id}" class="participant-card">
          <div class="card-top-row">
            <span class="name">{p.name}</span>

            <div class="user-avatar-wrapper">
              {#if discordId && discordAvatar}
                <img 
                  src="https://cdn.discordapp.com/avatars/{discordId}/{discordAvatar}.png" 
                  alt={p.name} 
                  class="avatar-img" 
                />
              {:else}
                <div class="avatar-fallback">
                  {p.name ? p.name.charAt(0).toUpperCase() : '?'}
                </div>
              {/if}
            </div>
            </div>

          <div class="card-bottom-row">
            <span class="badge {role === 'admin' ? 'admin' : role === 'seller' ? 'status-payout' : 'status-onsale'}">
              {role}
                </span>
              </div>
            </a>
      {/each}
    </div>
  {/if}
</section>