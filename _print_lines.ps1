param([string]$Path, [int]$Start = 1, [int]$End = 2147483647)
$c = Get-Content -LiteralPath $Path
for ($i = $Start; $i -le $End -and $i -le $c.Length; $i++) {
    '{0,5}: {1}' -f $i, $c[$i-1]
}