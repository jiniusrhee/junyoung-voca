# Windows 내장 OCR: ocr.ps1 <png> [lang]  → 줄마다 "x y w h | 텍스트" (좌표는 이미지 픽셀)
param([string]$Path, [string]$Lang = 'ko')
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
function Await($WinRtTask, $ResultType) {
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
  $t = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($WinRtTask)); $t.Wait(-1) | Out-Null; $t.Result
}
$full = (Resolve-Path $Path).Path
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($full)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new($Lang))
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
$res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
foreach ($line in $res.Lines) {
  $x0 = [int]($line.Words | % { $_.BoundingRect.X } | Measure -Min).Minimum
  $y0 = [int]($line.Words | % { $_.BoundingRect.Y } | Measure -Min).Minimum
  $x1 = [int]($line.Words | % { $_.BoundingRect.X + $_.BoundingRect.Width } | Measure -Max).Maximum
  $y1 = [int]($line.Words | % { $_.BoundingRect.Y + $_.BoundingRect.Height } | Measure -Max).Maximum
  "{0} {1} {2} {3} | {4}" -f $x0, $y0, ($x1 - $x0), ($y1 - $y0), $line.Text
}
