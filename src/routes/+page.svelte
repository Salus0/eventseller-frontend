<script>
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';

	const backendUrl = env.PUBLIC_BACKEND_URL || 'https://yggdrasil-eventseller-backend.up.railway.app';
	let runs = [];
	let isLoading = true;
	let currentUserName = '';
	let currentUserId = null;
	let currentDiscordId = '';

	// Token decodieren, um den eingeloggten User zu identifizieren
	function checkUserSession() {
		const token = localStorage.getItem('jwt_token');
		if (token) {
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
				
				// Sowohl Name, User-ID als auch Discord-ID aus dem Token extrahieren
				currentUserName = decoded.sub || decoded.name || decoded.username || '';
				currentUserId = decoded.id || decoded.userId || decoded.user_id || null;
				currentDiscordId = String(decoded.discord_id || decoded.discordId || '').trim();
			} catch (e) {
				console.error('Fehler beim Lesen des Tokens:', e);
			}
		}
	}

	// Details für einen einzelnen Run laden (Teilnehmer, Items & Summary)
	async function loadRunDetails(runId) {
		try {
			const [partsRes, itemsRes, summaryRes] = await Promise.all([
				fetch(`${backendUrl}/runs/${runId}/participants`),
				fetch(`${backendUrl}/runs/${runId}/items`),
				fetch(`${backendUrl}/runs/${runId}/summary`)
			]);

			let loadedParticipants = [];
			let loadedItems = [];
			let loadedSummary = null;

			if (partsRes.ok) loadedParticipants = await partsRes.json();
			if (itemsRes.ok) loadedItems = await itemsRes.json();
			if (summaryRes.ok) loadedSummary = await summaryRes.json();

			runs = runs.map(r => {
				if (r.id === runId) {
					return {
						...r,
						participants: Array.isArray(loadedParticipants) ? loadedParticipants : [],
						items: Array.isArray(loadedItems) ? loadedItems : [],
						summary: loadedSummary
					};
				}
				return r;
			});
		} catch (err) {
			console.error(`Fehler beim Laden der Details für Run ${runId}:`, err);
		}
	}

	// Alle Runs vom Backend laden und danach die Details nachziehen
	async function loadRuns() {
		isLoading = true;
		try {
			const res = await fetch(`${backendUrl}/runs/`);
			if (res.ok) {
				const loadedRuns = await res.json();
				runs = Array.isArray(loadedRuns) ? loadedRuns : [];
				// Für jeden Run die Teilnehmer & Items nachladen
				await Promise.all(runs.map(r => loadRunDetails(r.id)));
			}
		} catch (err) {
			console.error('Fehler beim Laden der Runs:', err);
		} finally {
			isLoading = false;
		}
	}

	// Prüfen, ob der eingeloggte User Teilnehmer in diesem Run ist
	function isUserInRun(run) {
		if (!run.participants || !Array.isArray(run.participants)) return false;

		return run.participants.some(p => {
			const pId = p.participant_id || p.id;
			const pDiscordId = String(p.discord_id || p.discordId || '').trim();
			const pName = (p.name || '').trim().toLowerCase();

			// 1. Match über Datenbank ID
			if (currentUserId && String(pId) === String(currentUserId)) return true;

			// 2. Match über Discord ID
			if (currentDiscordId && pDiscordId && currentDiscordId === pDiscordId) return true;

			// 3. Match über den Namen
			if (currentUserName && pName && currentUserName.toLowerCase() === pName) return true;

			return false;
		});
	}

	// Hilfsfunktion zur Ermittlung des Auszahlungs-Status des aktuellen Users im Run
	function getUserPayoutStatus(run) {
		if (!run.participants) return false;
		const myParticipant = run.participants.find(p => {
			const pId = p.participant_id || p.id;
			const pDiscordId = String(p.discord_id || p.discordId || '').trim();
			const pName = (p.name || '').trim().toLowerCase();

			return (currentUserId && String(pId) === String(currentUserId)) ||
				   (currentDiscordId && pDiscordId && currentDiscordId === pDiscordId) ||
				   (currentUserName && pName && currentUserName.toLowerCase() === pName);
		});
		return myParticipant ? Boolean(myParticipant.is_paid) : false;
	}

	// Dynamischer Run-Status (identisch zur Runs-Seite)
	function getRunStatusInfo(run) {
		const items = run.items || [];
		const participants = run.participants || [];

		const totalItems = items.length;
		const soldItems = items.filter(i => Boolean(i.sale_price || i.price || i.actual_price)).length;
		const allItemsSold = totalItems > 0 && soldItems === totalItems;

		const totalParticipants = participants.length;
		const paidParticipants = participants.filter(p => p.is_paid).length;
		const allPaidOut = totalParticipants > 0 && paidParticipants === totalParticipants;

		if (allItemsSold && allPaidOut) {
			return { label: 'Abgeschlossen', cssClass: 'status-close', isClosed: true };
		}
		if (allItemsSold) {
			return { label: 'Auszahlung bereit', cssClass: 'status-payout', isClosed: false };
		}
		if (soldItems > 0) {
			return { label: 'Im Verkauf', cssClass: 'status-onsale', isClosed: false };
		}
		return { label: 'Offen', cssClass: 'status-open', isClosed: false };
	}

	// Filter: Nur Runs des aktuellen Users
	$: userRuns = runs.filter(run => isUserInRun(run));

	// Offen = Run ist noch nicht vollzählig abgeschlossen ODER die eigene Auszahlung ist noch offen
	$: openRuns = userRuns.filter(run => {
		const status = getRunStatusInfo(run);
		const isPaid = getUserPayoutStatus(run);
		return !status.isClosed || !isPaid;
	});

	// Abgeschlossen = Run ist geschlossen UND die eigene Auszahlung ist erfolgt
	$: finishedRuns = userRuns.filter(run => {
		const status = getRunStatusInfo(run);
		const isPaid = getUserPayoutStatus(run);
		return status.isClosed && isPaid;
	});

	function formatZeny(amount) {
		return new Intl.NumberFormat('de-DE').format(amount || 0) + ' z';
	}

	onMount(() => {
		checkUserSession();
		loadRuns();
	});
</script>

<main class="container">
	<h1>Mein Dashboard</h1>

	{#if isLoading}
		<p class="status">Lade deine Runs...</p>
	{:else}
		<!-- SEKTION 1: OFFENE RUNS -->
		<section class="card">
			<h2>⏳ Offene Runs (Verkauf / Auszahlung ausstehend)</h2>
			{#if openRuns.length > 0}
				<ul class="run-list">
					{#each openRuns as run}
						{@const status = getRunStatusInfo(run)}
						{@const isPaid = getUserPayoutStatus(run)}
						<li class="run-item open">
							<div class="run-info">
								<strong>{run.name}</strong>
								<span class="badge {status.cssClass}">{status.label}</span>
							</div>
							<div class="run-right">
								{#if run.summary}
									<span class="zeny-payout">Split: {formatZeny(run.summary.payout_per_player)}</span>
								{/if}
								<span class="payout-status" class:paid={isPaid}>
									{isPaid ? '✓ Ausgezahlt' : '⏳ Auszahlung offen'}
								</span>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty-text">Keine offenen Runs, bei denen du beteiligt bist.</p>
			{/if}
		</section>

		<!-- SEKTION 2: ABGESCHLOSSENE RUNS -->
		<section class="card">
			<h2>✅ Abgeschlossene Runs</h2>
			{#if finishedRuns.length > 0}
				<ul class="run-list">
					{#each finishedRuns as run}
						<li class="run-item finished">
							<div class="run-info">
								<strong>{run.name}</strong>
								<span class="badge status-close">Abgeschlossen</span>
							</div>
							<div class="run-right">
								{#if run.summary}
									<span class="zeny-payout">{formatZeny(run.summary.payout_per_player)} erhalten</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty-text">Noch keine abgeschlossenen Runs vorhanden.</p>
			{/if}
		</section>
	{/if}
</main>

<style>
	.container {
		max-width: 800px;
		margin: 2rem auto;
		font-family: sans-serif;
		padding: 0 1rem;
		color: #f8fafc;
	}
	h1 {
		color: #fbbf24;
		margin-bottom: 1.5rem;
	}
	.card {
		background: #1e293b;
		border: 1px solid #334155;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
	}
	h2 {
		font-size: 1.1rem;
		color: #f8fafc;
		margin-top: 0;
		margin-bottom: 1rem;
	}
	.run-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.run-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #0f172a;
		padding: 0.8rem 1rem;
		border-radius: 6px;
		margin-bottom: 0.5rem;
		border-left: 4px solid #6366f1;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.run-item.open {
		border-left-color: #d97706;
	}
	.run-item.finished {
		border-left-color: #059669;
	}
	.run-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.run-right {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 0.85rem;
	}
	.badge {
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-weight: 600;
		color: white;
	}
	.status-open { background-color: #059669; }
	.status-onsale { background-color: #d97706; }
	.status-payout { background-color: #ca8a04; }
	.status-close { background-color: #dc2626; }

	.zeny-payout {
		color: #fbbf24;
		font-weight: 600;
	}
	.payout-status {
		color: #f59e0b;
		font-weight: 500;
	}
	.payout-status.paid {
		color: #34d399;
	}
	.empty-text, .status {
		color: #94a3b8;
		font-style: italic;
	}
</style>