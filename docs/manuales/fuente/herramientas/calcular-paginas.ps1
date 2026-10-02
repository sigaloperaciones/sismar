# Calcula, con Microsoft Word en modo SOLO LECTURA, la página de cada título de los
# manuales (marcadores h_NNN que escribe generar-docx.cjs) y la guarda en JSON para
# que el generador escriba el índice con números de página reales.
# Lo mantiene el agente strata-documentador (AISerNet Company).
#
# Flujo completo:
#   1. node generar-docx.cjs          (primera pasada: índice con página 0)
#   2. powershell -File calcular-paginas.ps1 -OutDir <carpeta>
#   3. node generar-docx.cjs          (segunda pasada, con TOC_PAGES_DIR=<carpeta>)
#
# No modifica los .docx: Word los abre en solo lectura y los cierra sin guardar.
param(
    [string]$OutDir = (Join-Path $env:TEMP "sismar-manuales-toc")
)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$files = @("manual-usuario.docx", "manual-tecnico.docx", "manual-implementacion-cliente.docx")
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    foreach ($f in $files) {
        $path = Join-Path $root $f
        if (-not (Test-Path $path)) { Write-Warning "No existe $path"; continue }
        # Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles)
        $doc = $word.Documents.Open($path, $false, $true, $false)
        $doc.Repaginate()
        $map = [ordered]@{}
        foreach ($bm in $doc.Bookmarks) {
            if ($bm.Name -like "h_*") {
                $map[$bm.Name] = [int]$bm.Range.Information(3)   # 3 = wdActiveEndPageNumber
            }
        }
        $pages = $doc.ComputeStatistics(2)                      # 2 = wdStatisticPages
        $doc.Close($false)
        $json = Join-Path $OutDir ([IO.Path]::ChangeExtension($f, ".json"))
        ($map | ConvertTo-Json) | Out-File -FilePath $json -Encoding utf8
        Write-Output ("{0}: {1} títulos, {2} páginas" -f $f, $map.Count, $pages)
    }
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
