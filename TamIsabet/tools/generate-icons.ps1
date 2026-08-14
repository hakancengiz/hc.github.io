param([string]$OutputDirectory = (Join-Path $PSScriptRoot "..\assets\icons"))

Add-Type -AssemblyName System.Drawing
[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

foreach ($size in 192, 512) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#04111f"))

    $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Rectangle(0, 0, $size, $size)),
        [System.Drawing.ColorTranslator]::FromHtml("#04111f"),
        [System.Drawing.ColorTranslator]::FromHtml("#0a3b35"),
        45
    )
    $graphics.FillRectangle($background, 0, 0, $size, $size)

    $scale = $size / 512
    $cyan = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#8055dec1"), (18 * $scale))
    $coral = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#48e39b"), (22 * $scale))
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $graphics.DrawEllipse($cyan, 112*$scale, 112*$scale, 288*$scale, 288*$scale)
    $graphics.DrawEllipse($coral, 168*$scale, 168*$scale, 176*$scale, 176*$scale)
    $graphics.FillEllipse($white, 234*$scale, 234*$scale, 44*$scale, 44*$scale)

    $path = Join-Path $OutputDirectory "icon-$size.png"
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $white.Dispose(); $cyan.Dispose(); $coral.Dispose(); $background.Dispose()
    $graphics.Dispose(); $bitmap.Dispose()
}
