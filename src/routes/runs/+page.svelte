<script>
  import { api } from "$lib/api";

  console.log("BACKEND:", import.meta.env.PUBLIC_BACKEND_URL);

  let runs = [];

  api("/runs/test").then((r) => runs = r);
</script>

<h1>Runs</h1>

<pre>{JSON.stringify(runs, null, 2)}</pre>
