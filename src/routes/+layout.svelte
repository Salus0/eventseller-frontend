<script>
  import { onMount } from 'svelte';

  export let data;

  let user = null;

  // Hilfsfunktion zum Dekodieren des JWT-Tokens ohne externe Library
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  function checkLogin() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      const decoded = parseJwt(token);
      // Prüfen, ob das Token noch nicht abgelaufen ist
      if (decoded && decoded.exp * 1000 > Date.now()) {
        user = decoded;
      } else {
        localStorage.removeItem('jwt_token');
        user = null;
      }
    }
  }

  function logout() {
    localStorage.removeItem('jwt_token');
    user = null;
    window.location.reload();
  }

  onMount(() => {
    checkLogin();
  });
</script>

<header class="navbar">
  <div class="nav-container">
    <a href="/" class="brand">
      <span>Yggdrasil Event Sales</span>
    </a>

    <nav class="nav-links">
      <a href="/">Dashboard</a>
      <a href="/runs">Runs</a>
      <a href="/items">Items</a>
      <a href="/participants">Teilnehmer</a>
    </nav>

    <div class="nav-actions">
      {#if user}
        <div class="user-profile">
          {#if user.avatar}
            <img 
              src="https://cdn.discordapp.com/avatars/{user.sub}/{user.avatar}.png" 
              alt={user.username} 
              class="avatar" 
            />
          {/if}
          <span class="username">{user.username}</span>
          {#if user.role === 'admin'}
            <span class="badge admin">Admin</span>
          {/if}
          <button on:click={logout} class="logout-btn">Logout</button>
        </div>
      {:else}
        <a href="https://yggdrasil-eventseller-backend.up.railway.app/auth/login" class="login-btn">
          Login
        </a>
      {/if}
    </div>
  </div>
</header>

<main class="page-content">
  <slot />
</main>

<style>
  /* CSS-Variablen angepasst an das Yggdrasil Custom Styling */
  :root {
    --bg-main: #071A14;        /* Dunkles Basis-Grün */
    --navbar-bg: #14221F;      /* Passender dunkler Karten-Hintergrund für die Leiste */
    --primary-green: #4DB982;   /* Smaragd-Akzentgrün */
    --primary-hover: #61CC95;   /* Hellere Hover-Abtönung */
    --text-dark: #E8F1EC;       /* Helles Grün/Weiß für gute Lesbarkeit */
    --text-muted: #9DB5AA;      /* Gedämpftes Hellgrün für Nebentexte & Links */
    --border-color: #294039;    /* Exakter Rahmenfarbton */
  }

  /* Globales Styling für den Seiten-Hintergrund */
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: var(--bg-main) !important;
    color: var(--text-dark) !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    min-height: 100vh;
  }

  /* Navigation Bar styling */
  .navbar {
    background-color: var(--navbar-bg);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 50;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .nav-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0.75rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 1.125rem;
    color: #D98A00 !important; /* warmes Gold/Gelb */
    text-decoration: none;
  }

  .nav-links {
    display: flex;
    gap: 1.5rem;
  }

  .nav-links a {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 500;
    transition: color 0.2s;
  }

  .nav-links a:hover {
    color: #E8F1EC;
  }

  .nav-actions {
    display: flex;
    align-items: center;
  }

  /* User Profile Styling */
  .user-profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #E8F1EC;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid #4DB982;
  }

  .username {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-dark);
  }

  .badge.admin {
    background-color: #E64A5B;
    color: #E8F1EC;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .logout-btn {
    background-color: #182824;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background-color: #1D352C;
    color: #E8F1EC;
  }

  .login-btn {
    background-color: var(--primary-green);
    color: #071A14;
    padding: 0.4rem 1rem;
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 700;
    transition: background-color 0.2s;
  }

  .login-btn:hover {
    background-color: var(--primary-hover);
  }

  /* Container für alle Seiten-Inhalte */
  .page-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem;
  }
</style>