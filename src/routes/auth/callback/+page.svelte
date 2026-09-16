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
