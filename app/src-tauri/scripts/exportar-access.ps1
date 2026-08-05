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

# Ordem das colunas na tabela: 0=CodigoDoServico 1=DescricaoDoCarro 2=Km 3=Placa 4=DescricaoDoProduto 5=Data
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT * FROM Produtos"
$reader = $cmd.ExecuteReader()

$writer = New-Object System.IO.StreamWriter($CsvPath, $false, (New-Object System.Text.UTF8Encoding($true)))
$writer.WriteLine("codigo,carro,km,placa,produto,data")

$count = 0
while ($reader.Read()) {
    $codigo  = $reader.GetValue(0)
    $carro   = if ($reader.IsDBNull(1)) { "" } else { $reader.GetString(1) }
    $km      = if ($reader.IsDBNull(2)) { "" } else { $reader.GetString(2) }
    $placa   = if ($reader.IsDBNull(3)) { "" } else { $reader.GetString(3) }
    $produto = if ($reader.IsDBNull(4)) { "" } else { $reader.GetString(4) }
    $data    = if ($reader.IsDBNull(5)) { "" } else { $reader.GetDateTime(5).ToString("yyyy-MM-dd") }

    $line = @($codigo, $carro, $km, $placa, $produto, $data | ForEach-Object { Escape-Csv "$_" }) -join ','
    $writer.WriteLine($line)
    $count++
}

$reader.Close()
$conn.Close()
$writer.Close()

Write-Output "OK $count"
exit 0
