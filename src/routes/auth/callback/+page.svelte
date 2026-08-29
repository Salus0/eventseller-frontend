<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let statusMessage = 'Anmeldung wird verarbeitet...';

  onMount(() => {
    // 1. Token aus der URL auslesen (?token=xyz)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      // 2. Token im Browser-Speicher (LocalStorage) ablegen
      localStorage.setItem('jwt_token', token);
      statusMessage = 'Erfolgreich angemeldet! Leite weiter...';
      
      // 3. Zur Hauptseite weiterleiten
      setTimeout(() => {
        goto('/');
      }, 1000);
    } else {
      statusMessage = 'Fehler beim Login: Kein Token empfangen.';
    }
  });
</script>

<div class="callback-container">
  <div class="card">
    <h2>🔑 Discord Login</h2>
    <p>{statusMessage}</p>
  </div>
</div>

<style>
  .callback-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60vh;
  }
  .card {
    background-color: #1e293b;
    border: 1px solid #334155;
    padding: 2rem;
    border-radius: 8px;
    text-align: center;
    color: white;
  }
  h2 {
    color: #fbbf24;
    margin-bottom: 1rem;
  }
</style>