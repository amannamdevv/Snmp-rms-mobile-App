Add-Type -AssemblyName System.Drawing

$sourcePath = 'C:\Users\lenovo\.gemini\antigravity-ide\brain\ee6d3760-84ab-4c56-a3fa-83dc99235f2c\.user_uploaded\media_1791196119056.png'
$destPath = 'C:\Users\lenovo\OneDrive\aman - Personal\Desktop\RMS\login page_720x1600.png'

$img = [System.Drawing.Image]::FromFile($sourcePath)
$bitmap = new-object System.Drawing.Bitmap(720, 1600)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# High quality resizing
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Draw the original image resized to 720x1600
$graphics.DrawImage($img, 0, 0, 720, 1600)

# The status bar height for 720x1600 is roughly 80 pixels
$statusBarHeight = 85

# Get the background color right below the status bar (e.g., at y = 100, x = 30)
$bgColor = $bitmap.GetPixel(30, 100)

# Create a solid brush with that color
$brush = new-object System.Drawing.SolidBrush($bgColor)

# Draw a rectangle over the status bar to cover it
$graphics.FillRectangle($brush, 0, 0, 720, $statusBarHeight)

# Save the new image
$bitmap.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Clean up
$graphics.Dispose()
$brush.Dispose()
$bitmap.Dispose()
$img.Dispose()

Write-Host 'Image processed and saved successfully.'
