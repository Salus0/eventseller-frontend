<script>
  export let data;
</script>

<h1>Profil</h1>

{#if data.user}
  <pre>{JSON.stringify(data.user, null, 2)}</pre>
{:else}
  <p>Du bist nicht eingeloggt.</p>
{/if}
