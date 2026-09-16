<script>
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import { goto } from '$app/navigation';

  const backendUrl = env.PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';
  let runs = [];
  let isLoading = true;
  let authToken = '';
  let currentDiscordId = '';

  function checkUserSession() {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      authToken = token;
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
        currentDiscordId = String(decoded.discord_id || decoded.discordId || decoded.sub || '').trim();
      } catch (e) {
        console.error('Fehler beim Lesen des Tokens:', e);
      }
    }
  }

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    };
  }

  async function loadRunDetails(runId) {
    try {
      const headers = getAuthHeaders();
      const [partsRes, itemsRes, salesRes, summaryRes] = await Promise.all([
        fetch(`${backendUrl}/runs/${runId}/participants`, { headers }),
        fetch(`${backendUrl}/runs/${runId}/items`, { headers }),
        fetch(`${backendUrl}/runs/${runId}/sales`, { headers }),
        fetch(`${backendUrl}/runs/${runId}/summary`, { headers })
      ]);

      let loadedParticipants = [];
      let loadedItems = [];
      let loadedSales = [];
      let loadedSummary = null;

      if (partsRes.ok) loadedParticipants = await partsRes.json();
      if (itemsRes.ok) loadedItems = await itemsRes.json();
      if (salesRes.ok) loadedSales = await salesRes.json();
      if (summaryRes.ok) loadedSummary = await summaryRes.json();

      runs = runs.map(r => {
        if (r.id === runId) {
          return {
            ...r,
            participants: Array.isArray(loadedParticipants) ? loadedParticipants : [],
            items: Array.isArray(loadedItems) ? loadedItems : [],
            sales: Array.isArray(loadedSales) ? loadedSales : [],
            summary: loadedSummary
          };
        }
        return r;
      });
    } catch (err) {
      console.error(`Fehler beim Laden der Details für Run ${runId}:`, err);
    }
  }

  async function loadRuns() {
    isLoading = true;
    try {
      const res = await fetch(`${backendUrl}/runs/`, {
        headers: getAuthHeaders()
      });

      if (res.ok) {
        const loadedRuns = await res.json();
        runs = Array.isArray(loadedRuns) ? loadedRuns : [];
        await Promise.all(runs.map(r => loadRunDetails(r.id)));
      }
    } catch (err) {
      console.error('Fehler beim Laden der Runs:', err);
    } finally {
      isLoading = false;
    }
  }

  function isUserUnpaidInRun(run) {
    if (!currentDiscordId || !run?.participants || !Array.isArray(run.participants)) {
      return false;
    }

    const participant = run.participants.find(p => {
      const pDiscordId = String(p.discord_id || p.discordId || '').trim();
      return pDiscordId !== '' && pDiscordId === currentDiscordId;
    });

    return participant ? !participant.is_paid : false;
  }

  function getItemSalesInfo(run) {
    const totalDrops = (run.items || []).reduce((sum, item) => sum + (Number(item.quantity || item.amount) || 1), 0);
    const totalSold = (run.sales || []).reduce((sum, sale) => sum + (Number(sale.quantity) || 1), 0);
    
    return { 
      sold: totalSold, 
      total: totalDrops
    };
  }

  function getRunStatusInfo(run) {
    const items = run.items || [];
    const participants = run.participants || [];

    const totalItems = items.length;
    const soldItems = (run.sales || []).length;
    const allItemsSold = totalItems > 0 && soldItems >= totalItems;

    const totalParticipants = participants.length;
    const paidParticipants = participants.filter(p => p.is_paid).length;
    const allPaidOut = totalParticipants > 0 && paidParticipants === totalParticipants;

    // 1. Alle Items verkauft & alle bezahlt -> close
    if (allItemsSold && allPaidOut) {
      return { label: 'close', cssClass: 'status-close' };
    }
    // 2. Alle Items verkauft (aber noch nicht alle ausbezahlt) -> Payout
    if (allItemsSold) {
      return { label: 'Payout', cssClass: 'status-payout' };
    }
    // 3. Sobald mindestens ein Item eingetragen wurde -> On Sale
    if (totalItems > 0) {
      return { label: 'On Sale', cssClass: 'status-onsale' };
    }

    // Fallback (falls noch keine Items eingetragen sind)
    return null;
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function formatZeny(amount) {
    return new Intl.NumberFormat('de-DE').format(amount || 0) + ' z';
  }

  function openRunDetails(runId) {
    goto(`/runs?open=${runId}`);
  }

  $: userRuns = runs
    .filter(run => isUserUnpaidInRun(run))
    .sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0));

  onMount(() => {
    checkUserSession();
    loadRuns();
  });
</script>

<div class="header-action">
  <h1>Mein Dashboard</h1>
</div>


  {#if isLoading}
    <section class="card">
      <p class="status">Lade deine Runs...</p>
    </section>
  {:else}
    <section class="card">
      <h2>Meine aktiven Runs</h2>
      {#if userRuns.length > 0}
        <ul class="run-list is--dashboard">
          {#each userRuns as run}
            {@const sales = getItemSalesInfo(run)}
            {@const status = getRunStatusInfo(run)}
            <li class="run-item" on:click={() => openRunDetails(run.id)} role="button" tabindex="0">
              <div class="run-header-dashboard">
                <div class="run-title-line">
                  <strong class="run-name">{run.name}</strong>
                  {#if status}
                    <span class="badge {status.cssClass}">
                      {status.label}
                    </span>
                  {/if}
                </div>
                {#if run.created_at || run.date}
                  <span class="run-date">📅 {formatDate(run.created_at || run.date)}</span>
                {/if}
              </div>

              <div class="run-details-dashboard">
                {#if sales.total > 0}
                  <span class="sales-progress">🛒 {sales.sold} / {sales.total} Items verkauft</span>
                {:else if sales.sold > 0}
                  <span class="sales-progress">🛒 {sales.sold} Items verkauft</span>
                {:else}
                  <span class="no-sales">Keine Verkäufe</span>
                {/if}

                {#if run.summary}
                  <span class="split-amount">Split: {formatZeny(run.summary.payout_per_player)}</span>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty-text">Du hast aktuell keine offenen Payouts oder bist in keinen aktiven Runs eingetragen.</p>
      {/if}
    </section>
  {/if}
