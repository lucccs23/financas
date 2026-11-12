# Desliga o servidor do app Financas que roda em segundo plano.
# Fechar a janela do app nao desliga o servidor; ele usa pouca memoria e
# deixa a proxima abertura instantanea. Use este script se quiser desligar.

$raiz = Split-Path -Parent $PSScriptRoot
$arquivoPid = Join-Path $raiz ".financas\servidor.pid"
$nome = "Finan" + [char]0x00E7 + "as"
Add-Type -AssemblyName System.Windows.Forms

$parou = $false
if (Test-Path $arquivoPid) {
  $id = [int](Get-Content $arquivoPid)
  $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -eq "node") {
    Stop-Process -Id $id -Force
    $parou = $true
  }
  Remove-Item $arquivoPid -ErrorAction SilentlyContinue
}

$texto = if ($parou) { "O app foi desligado." } else { "O app ja estava desligado." }
[System.Windows.Forms.MessageBox]::Show($texto, $nome, "OK", "Information") | Out-Null
