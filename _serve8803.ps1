$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8803/")
$listener.Start()
Write-Output "Serving $root on http://localhost:8803/"
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($path)) { $path = '_book.pdf' }
    $path = [Uri]::UnescapeDataString($path)
    $file = Join-Path $root $path
    if (Test-Path $file -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
      $mime = switch ($ext) {
        '.pdf'  { 'application/pdf' }
        '.html' { 'text/html; charset=utf-8' }
        default { 'application/octet-stream' }
      }
      $bytes = [IO.File]::ReadAllBytes($file)
      $ctx.Response.ContentType = $mime
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch {
    try { $ctx.Response.StatusCode = 500; $ctx.Response.Close() } catch { }
  }
}
