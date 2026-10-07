Add-Type -AssemblyName System.Drawing

$sourcePath = 'C:\Users\lenovo\.gemini\antigravity-ide\brain\ee6d3760-84ab-4c56-a3fa-83dc99235f2c\.user_uploaded\media_1791196119056.png'
$destPath = 'C:\Aman\SNMP-RMSApp\play_store_login_screenshot_720x1600.png'

$img = [System.Drawing.Image]::FromFile($sourcePath)
$bitmap = new-object System.Drawing.Bitmap(720, 1600)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.DrawImage($img, 0, 0, 720, 1600)

$statusBarHeight = 85
$bgColor = $bitmap.GetPixel(30, 100)
$brush = new-object System.Drawing.SolidBrush($bgColor)
$graphics.FillRectangle($brush, 0, 0, 720, $statusBarHeight)

$bitmap.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$brush.Dispose()
$bitmap.Dispose()
$img.Dispose()
