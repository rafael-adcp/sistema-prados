# Exporta a tabela Produtos do Sistema Prado.mdb para servicos.csv (UTF-8).
# Uso: .\export-mdb.ps1 [-MdbPath <caminho do .mdb>]
# Nota: script mantido 100% ASCII (PowerShell 5.1 le .ps1 sem BOM como ANSI).
# Por isso o SELECT usa * e acesso por indice em vez dos nomes acentuados das colunas.
param(
    [string]$MdbPath = (Join-Path (Split-Path $PSScriptRoot -Parent) "Sistema Prado.mdb")
)

$ErrorActionPreference = 'Stop'
$csvPath = Join-Path $PSScriptRoot "servicos.csv"

if (-not (Test-Path $MdbPath)) { throw "Arquivo nao encontrado: $MdbPath" }

function Escape-Csv([string]$value) {
    '"' + $value.Replace('"', '""') + '"'
}

$conn = New-Object System.Data.OleDb.OleDbConnection(
    "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$MdbPath;")
$conn.Open()

# Ordem das colunas na tabela: 0=CodigoDoServico 1=DescricaoDoCarro 2=Km 3=Placa 4=DescricaoDoProduto 5=Data
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT * FROM Produtos"
$reader = $cmd.ExecuteReader()

$writer = New-Object System.IO.StreamWriter($csvPath, $false, (New-Object System.Text.UTF8Encoding($true)))
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

Write-Output "Exportados $count registros para $csvPath"
