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
  /* CSS-Variablen für das Dunkelgrün-Theme (Dark Emerald) */
  :root {
    --bg-main: #0a1f18;        /* Dunkles, tiefes Waldgrün als Hintergrund */
    --navbar-bg: #112d23;      /* Etwas helleres Dunkelgrün für die Navigationsleiste */
    --primary-green: #2d6a4f;   /* Sattes Smaragdgrün für Buttons & Icons */
    --primary-hover: #40916c;   /* Hellers Grün bei Hover */
    --text-dark: #e8f5e9;       /* Helles Mint/Weiß für sehr gute Lesbarkeit auf dunklem Grund */
    --text-muted: #95d5b2;      /* Sanftes Hellgrün für Nebentexte */
    --border-color: #1b4332;    /* Dezent dunkler grüner Rahmen */
  }

  /* Globales Styling für den Seiten-Hintergrund */
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: var(--bg-main);
    color: var(--text-dark);
    font-family: system-ui, -apple-system, sans-serif;
    min-height: 100vh;
  }

  /* Navigation Bar styling */
  .navbar {
    background-color: var(--navbar-bg);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 50;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
    color: #52b788; /* Frisches Grün für das Logo */
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
    color: #ffffff;
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
    color: white;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid #52b788;
  }

  .username {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-dark);
  }

  .badge.admin {
    background-color: #e63946;
    color: white;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .logout-btn {
    background-color: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-muted);
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background-color: var(--border-color);
    color: white;
  }

  .login-btn {
    background-color: var(--primary-green);
    color: white;
    padding: 0.4rem 1rem;
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 600;
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