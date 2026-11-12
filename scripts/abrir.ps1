# Abre o app Financas com um clique.
# 1. Instala as dependencias, se faltarem.
# 2. Gera a versao rapida do site, se o codigo mudou desde a ultima vez.
# 3. Liga o servidor em segundo plano, se ainda nao estiver ligado.
# 4. Abre o app em uma janela propria do Chrome (ou no navegador padrao).
#
# Este arquivo usa so caracteres ASCII de proposito: o PowerShell do Windows
# le scripts sem BOM como ANSI e estragaria os acentos.

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$porta = 3000
$url = "http://localhost:$porta"
$pasta = Join-Path $raiz ".financas"
$arquivoPid = Join-Path $pasta "servidor.pid"
$log = Join-Path $pasta "servidor.log"
$nome = "Finan" + [char]0x00E7 + "as"

New-Item -ItemType Directory -Force -Path $pasta | Out-Null
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$balao = $null
function Avisar([string]$texto) {
  if (-not $script:balao) {
    $script:balao = New-Object System.Windows.Forms.NotifyIcon
    $icone = Join-Path $raiz "scripts\financas.ico"
    $script:balao.Icon = if (Test-Path $icone) { New-Object System.Drawing.Icon $icone } else { [System.Drawing.SystemIcons]::Information }
    $script:balao.Visible = $true
  }
  $script:balao.ShowBalloonTip(8000, $nome, $texto, [System.Windows.Forms.ToolTipIcon]::None)
}

function Erro([string]$texto) {
  if ($script:balao) { $script:balao.Dispose() }
  [System.Windows.Forms.MessageBox]::Show($texto, $nome, "OK", "Error") | Out-Null
  exit 1
}

function EhONossoApp {
  try {
    $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3
    return $r.Content -match "Contas da casa"
  } catch {
    return $false
  }
}

function PortaOcupada {
  return [bool](Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue)
}

function Rodar([string[]]$argumentos, [string]$etapa) {
  $p = Start-Process -FilePath "node" -ArgumentList $argumentos -WorkingDirectory $raiz `
    -WindowStyle Hidden -PassThru -Wait `
    -RedirectStandardOutput $log -RedirectStandardError "$log.erro"
  if ($p.ExitCode -ne 0) {
    Erro "Falhou ao $etapa. Detalhes em:`n$log.erro"
  }
}

function AbrirJanela {
  $chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList "--app=$url"
  } else {
    Start-Process $url
  }
}

# A versao rapida do site precisa ser refeita quando algum arquivo do codigo mudou.
function CodigoMudou {
  $marca = Join-Path $raiz ".next\BUILD_ID"
  if (-not (Test-Path $marca)) { return $true }
  # Se a ultima geracao foi a versao online (GitHub Pages), refaz a do computador.
  $config = Join-Path $raiz ".next/required-server-files.json"
  if ((Test-Path $config) -and ((Get-Content $config -Raw) -match '"output"\s*:\s*"export"')) { return $true }
  $gerado = (Get-Item $marca).LastWriteTime
  $fontes = @(Get-ChildItem (Join-Path $raiz "src") -Recurse -File) +
    @(Get-Item (Join-Path $raiz "package.json"), (Join-Path $raiz "next.config.ts"))
  return [bool]($fontes | Where-Object { $_.LastWriteTime -gt $gerado } | Select-Object -First 1)
}

$precisaGerar = CodigoMudou

# Ja esta ligado: so abre a janela. Se o codigo mudou, desliga para atualizar.
if (EhONossoApp) {
  if (-not $precisaGerar) {
    AbrirJanela
    exit 0
  }
  if (Test-Path $arquivoPid) {
    $antigo = Get-Process -Id ([int](Get-Content $arquivoPid)) -ErrorAction SilentlyContinue
    if ($antigo -and $antigo.ProcessName -eq "node") { Stop-Process -Id $antigo.Id -Force }
  }
  $espera = (Get-Date).AddSeconds(10)
  while ((PortaOcupada) -and ((Get-Date) -lt $espera)) { Start-Sleep -Milliseconds 300 }
}

if (PortaOcupada) {
  Erro "A porta $porta ja esta em uso por outro programa. Feche o outro programa (por exemplo, um 'npm run dev' aberto) e tente de novo."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Erro "O Node.js nao foi encontrado. Instale em https://nodejs.org e tente de novo."
}

# Dependencias
if (-not (Test-Path (Join-Path $raiz "node_modules\next"))) {
  Avisar "Instalando o que o app precisa. Isso acontece so na primeira vez."
  $p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm install" -WorkingDirectory $raiz `
    -WindowStyle Hidden -PassThru -Wait `
    -RedirectStandardOutput $log -RedirectStandardError "$log.erro"
  if ($p.ExitCode -ne 0) { Erro "Falhou ao instalar as dependencias. Detalhes em:`n$log.erro" }
}

if ($precisaGerar) {
  Avisar "Atualizando o app. Leva uns 30 segundos e so acontece quando o codigo muda."
  Rodar @("node_modules\next\dist\bin\next", "build") "preparar o app"
}

# Liga o servidor em segundo plano, sem janela.
$servidor = Start-Process -FilePath "node" `
  -ArgumentList "node_modules\next\dist\bin\next", "start", "-p", "$porta" `
  -WorkingDirectory $raiz -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $log -RedirectStandardError "$log.erro"
Set-Content -Path $arquivoPid -Value $servidor.Id

$limite = (Get-Date).AddSeconds(40)
while (-not (EhONossoApp)) {
  if ($servidor.HasExited) { Erro "O servidor parou ao iniciar. Detalhes em:`n$log.erro" }
  if ((Get-Date) -gt $limite) { Erro "O servidor demorou demais para responder. Detalhes em:`n$log" }
  Start-Sleep -Milliseconds 400
}

if ($balao) { $balao.Dispose() }
AbrirJanela
