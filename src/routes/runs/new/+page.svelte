<script>
  import { api } from "$lib/api";

  let type = "ET";
  let date = "";
  let note = "";
  let message = "";

  async function createRun() {
    const res = await api("/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, date, note })
    });

    message = "Run erstellt: " + res.id;
  }
</script>

<h1>Neuen Run erstellen</h1>

<label>Run-Typ</label>
<select bind:value={type}>
  <option value="ET">Endless Tower</option>
  <option value="EC">Eternal Challenge</option>
</select>

<label>Datum</label>
<input type="date" bind:value={date} />

<label>Notiz</label>
<input type="text" bind:value={note} />

<button on:click={createRun}>Run erstellen</button>

{#if message}
  <p>{message}</p>
{/if}
