# Exporta a tabela Produtos de um .mdb do Access para CSV (UTF-8 com BOM).
# Embutido no app e executado via powershell.exe (64 e, se preciso, 32 bits).
# 100% ASCII: PowerShell 5.1 le .ps1 sem BOM como ANSI.
param(
    [Parameter(Mandatory)][string]$MdbPath,
    [Parameter(Mandatory)][string]$CsvPath
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $MdbPath)) { Write-Error "Arquivo nao encontrado: $MdbPath"; exit 2 }

# Escada de providers: ACE 16/12 (Office moderno) -> Jet 4.0 (todo Windows 32 bits,
# le .mdb Access 2000 mesmo sem Office instalado).
$providers = @('Microsoft.ACE.OLEDB.16.0', 'Microsoft.ACE.OLEDB.12.0', 'Microsoft.Jet.OLEDB.4.0')
$conn = $null
foreach ($provider in $providers) {
    try {
        $tentativa = New-Object System.Data.OleDb.OleDbConnection("Provider=$provider;Data Source=$MdbPath;")
        $tentativa.Open()
        $conn = $tentativa
        break
    } catch { $conn = $null }
}
if ($null -eq $conn) { Write-Error "Nenhum provider OLEDB disponivel"; exit 3 }

function Escape-Csv([string]$value) {
    '"' + $value.Replace('"', '""') + '"'
}

# "Codigo do Servico" vira "codigodoservico": sem acento, sem espaco, minusculo.
# Assim este arquivo continua 100% ASCII e ainda casa com os nomes acentuados
# reais do Access (CodigoDoServico, DescricaodoCarro, DescricaoDoProduto).
function Get-ChaveDoNome([string]$texto) {
    $semAcento = ($texto.Normalize([Text.NormalizationForm]::FormD).ToCharArray() | Where-Object {
        [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [Globalization.UnicodeCategory]::NonSpacingMark
    }) -join ''
    ($semAcento -replace '[^A-Za-z0-9]', '').ToLowerInvariant()
}

$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT * FROM Produtos"
$reader = $cmd.ExecuteReader()

# Resolver as colunas por NOME. Le-las por posicao fixa era o risco silencioso da
# virada: se alguem tivesse acrescentado ou reordenado um campo no Access desde
# 2006, a migracao gravaria dados trocados por cima do banco ja apagado.
$ordinalPorChave = @{}
for ($i = 0; $i -lt $reader.FieldCount; $i++) {
    $ordinalPorChave[(Get-ChaveDoNome $reader.GetName($i))] = $i
}
$colunas = [ordered]@{
    codigo  = 'codigodoservico'
    carro   = 'descricaodocarro'
    km      = 'km'
    placa   = 'placa'
    produto = 'descricaodoproduto'
    data    = 'data'
}
$indice = @{}
$faltando = @()
foreach ($campo in $colunas.Keys) {
    $chave = $colunas[$campo]
    if ($ordinalPorChave.Contains($chave)) { $indice[$campo] = $ordinalPorChave[$chave] }
    else { $faltando += $chave }
}
if ($faltando.Count -gt 0) {
    $reader.Close(); $conn.Close()
    Write-Error ("Tabela Produtos sem as colunas esperadas: " + ($faltando -join ', ') +
        ". Colunas encontradas: " + (($ordinalPorChave.Keys | Sort-Object) -join ', '))
    exit 4
}

# Le como valor bruto: em alguma copia do .mdb o Km pode nao estar como texto,
# e GetString explodiria no meio da migracao.
function Read-Texto($reader, [int]$ordinal) {
    if ($reader.IsDBNull($ordinal)) { return "" }
    return [string]$reader.GetValue($ordinal)
}

$writer = New-Object System.IO.StreamWriter($CsvPath, $false, (New-Object System.Text.UTF8Encoding($true)))
$writer.WriteLine("codigo,carro,km,placa,produto,data")

$count = 0
while ($reader.Read()) {
    $codigo  = Read-Texto $reader $indice['codigo']
    $carro   = Read-Texto $reader $indice['carro']
    $km      = Read-Texto $reader $indice['km']
    $placa   = Read-Texto $reader $indice['placa']
    $produto = Read-Texto $reader $indice['produto']
    $data    = if ($reader.IsDBNull($indice['data'])) { "" }
               else { ([datetime]$reader.GetValue($indice['data'])).ToString("yyyy-MM-dd") }

    $line = @($codigo, $carro, $km, $placa, $produto, $data | ForEach-Object { Escape-Csv "$_" }) -join ','
    $writer.WriteLine($line)
    $count++
}

$reader.Close()
$conn.Close()
$writer.Close()

Write-Output "OK $count"
exit 0
