# Pick the PC Wi-Fi/LAN IPv4 for phone -> docker API (not Docker/WSL virtual NICs).
$addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and
    $_.IPAddress -notlike '169.254.*' -and
    ($_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*')
  } |
  Sort-Object InterfaceMetric, PrefixOrigin

if ($addrs) {
  return $addrs[0].IPAddress
}

$addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Sort-Object InterfaceMetric

if ($addrs) {
  return $addrs[0].IPAddress
}

return $null
