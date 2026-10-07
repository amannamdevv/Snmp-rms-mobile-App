Add-Type -AssemblyName System.Drawing

$sourcePath = 'C:\Users\lenovo\.gemini\antigravity-ide\brain\ee6d3760-84ab-4c56-a3fa-83dc99235f2c\.user_uploaded\media_1791196119056.png'
$destPath = 'C:\Aman\SNMP-RMSApp\play_store_login_screenshot.png'

$img = [System.Drawing.Image]::FromFile($sourcePath)
$bitmap = new-object System.Drawing.Bitmap(1080, 1920)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Draw the original image resized to 1080x1920
$graphics.DrawImage($img, 0, 0, 1080, 1920)

# The status bar height is roughly 100 pixels when scaled to 1920 height
$statusBarHeight = 100

# Get the background color right below the status bar (e.g., at y = 120, x = 50)
$bgColor = $bitmap.GetPixel(50, 120)

# Create a solid brush with that color
$brush = new-object System.Drawing.SolidBrush($bgColor)

# Draw a rectangle over the status bar to cover it
$graphics.FillRectangle($brush, 0, 0, 1080, $statusBarHeight)

# Save the new image
$bitmap.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Clean up
$graphics.Dispose()
$brush.Dispose()
$bitmap.Dispose()
$img.Dispose()

Write-Host 'Image processed and saved successfully.'
