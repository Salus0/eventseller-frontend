<svelte:head>
  <title>Wichtige Links - Yggdrasil EventSeller</title>
</svelte:head>

<h1>Links</h1>
<p class="section-margin status-text">Hier findest du eine Übersicht aller wichtigen externen Webseiten, Tools und Taktik-Tabellen.</p>

<!-- Kategorie 1: uaRO-Webseiten -->
<section class="card section-margin">
  <h2>🌐 uaRO-Webseiten</h2>
  <p class="status-text">Offizielle Plattformen und Community-Seiten des uaRO-Servers.</p>
  
  <div class="links-grid">
    <a href="https://wiki.uaro.net/" target="_blank" rel="noopener noreferrer" class="link-card">
      <img src="/links/uaro.png" alt="uaRO Wiki Logo" class="link-logo" on:error={(e) => e.target.style.display = 'none'} />
      <div class="link-info">
        <span class="link-title">uaRO Wiki</span>
        <span class="link-url">wiki.uaro.net</span>
      </div>
    </a>

    <a href="https://uaro.net/cp/" target="_blank" rel="noopener noreferrer" class="link-card">
      <img src="/links/uaro.png" alt="uaRO Login Logo" class="link-logo" on:error={(e) => e.target.style.display = 'none'} />
      <div class="link-info">
        <span class="link-title">uaRO Login</span>
        <span class="link-url">uaro.net/cp</span>
      </div>
    </a>

    <a href="https://discord.com/invite/5wusMPf9XA" target="_blank" rel="noopener noreferrer" class="link-card">
      <img src="/links/uaro.png" alt="uaRO Discord Logo" class="link-logo" on:error={(e) => e.target.style.display = 'none'} />
      <div class="link-info">
        <span class="link-title">uaRO Discord</span>
        <span class="link-url">discord.com</span>
      </div>
    </a>
  </div>
</section>

<!-- Kategorie 2: RO-Datenbank und Calcs -->
<section class="card section-margin">
  <h2>🧮 RO-Datenbank und Calcs</h2>
  <p class="status-text">Nützliche Rechner und Datenbanken für Charakter-Builds und Drops.</p>
  
  <div class="links-grid">
    <a href="https://ratemyserver.net/" target="_blank" rel="noopener noreferrer" class="link-card">
      <img src="/links/rms.png" alt="RateMyServer Logo" class="link-logo" on:error={(e) => e.target.style.display = 'none'} />
      <div class="link-info">
        <span class="link-title">RateMyServer</span>
        <span class="link-url">ratemyserver.net</span>
      </div>
    </a>

    <a href="https://uaro-calc.xdthrice.workers.dev/" target="_blank" rel="noopener noreferrer" class="link-card">
      <img src="/links/calc.png" alt="Calculator Logo" class="link-logo" on:error={(e) => e.target.style.display = 'none'} />
      <div class="link-info">
        <span class="link-title">Calculator (UARO-Edition by Thrice)</span>
        <span class="link-url">uaro-calc.xdthrice.workers.dev</span>
      </div>
    </a>
  </div>
</section>

<!-- Kategorie 3: Sheets -->
<section class="card section-margin">
  <h2>📊 Sheets</h2>
  <p class="status-text">Gilden-Tabellen, Quest-Übersichten und Event-Taktiken.</p>
  
  <div class="links-grid">
    <a href="https://docs.google.com/spreadsheets/d/1FTSlqChpaBHjklWcpEg4k3jHA2hpm9rNq1P3S5acckk/edit?gid=1292359833#gid=1292359833" target="_blank" rel="noopener noreferrer" class="link-card">
      <img src="/links/sheet.png" alt="Google Sheets Logo" class="link-logo" on:error={(e) => e.target.style.display = 'none'} />
      <div class="link-info">
        <span class="link-title">EC-Taktik Sheet</span>
        <span class="link-url">docs.google.com (Endless Cellar)</span>
      </div>
    </a>

    <a href="https://docs.google.com/spreadsheets/d/1TtRYbg-aeCZR7pQaa9y3Wdtj7WVMGXbDi9ORGO788zE/edit?gid=651762935#gid=651762935" target="_blank" rel="noopener noreferrer" class="link-card">
      <img src="/links/sheet.png" alt="Google Sheets Logo" class="link-logo" on:error={(e) => e.target.style.display = 'none'} />
      <div class="link-info">
        <span class="link-title">ET-Taktik Sheet</span>
        <span class="link-url">docs.google.com (Endless Tower)</span>
      </div>
    </a>

        <a href="https://docs.google.com/spreadsheets/d/1wKT_kSpeINIyxz04QvRh0W6JiXMEXK1ZLFaxrZp0SVk/edit?gid=1157292169#gid=1157292169" target="_blank" rel="noopener noreferrer" class="link-card">
      <img src="/links/sheet.png" alt="Google Sheets Logo" class="link-logo" on:error={(e) => e.target.style.display = 'none'} />
      <div class="link-info">
        <span class="link-title">uaRO Repetable Quest Sheet</span>
        <span class="link-url">docs.google.com</span>
      </div>
    </a>
  </div>
</section>

<!-- Kategorie 4: Yggdrasil Raid-Helper -->
<section class="card section-margin">
  <h2>📅 Yggdrasil Raid-Helper</h2>
  <p class="status-text">Übersicht und Verwaltung über den Event-Planer.</p>
  
  <div class="links-grid">
    <a href="https://raid-helper.dev/dashboard/" target="_blank" rel="noopener noreferrer" class="link-card">
      <img src="/links/raidhelper.png" alt="Raid-Helper Logo" class="link-logo" on:error={(e) => e.target.style.display = 'none'} />
      <div class="link-info">
        <span class="link-title">Raid-Helper Dashboard</span>
        <span class="link-url">raid-helper.dev</span>
      </div>
    </a>
  </div>
</section>