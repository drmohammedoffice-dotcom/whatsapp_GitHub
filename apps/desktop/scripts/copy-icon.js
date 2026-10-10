/**
 * Build multi-size ChatLoora icon.ico from chatloora-icon.png (required for Windows EXE + shortcuts).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const pngSrc = path.resolve(__dirname, '../../web/public/chatloora-icon.png');
const buildDir = path.resolve(__dirname, '../build');
const pngDest = path.join(buildDir, 'icon.png');
const icoDest = path.join(buildDir, 'icon.ico');

async function main() {
  if (!fs.existsSync(pngSrc)) {
    console.error('Missing logo:', pngSrc);
    process.exit(1);
  }
  fs.mkdirSync(buildDir, { recursive: true });
  fs.copyFileSync(pngSrc, pngDest);

  // Prefer png-to-ico if installed; otherwise fall back to PowerShell .NET conversion.
  let pngToIco;
  try {
    pngToIco = require('png-to-ico');
  } catch {
    pngToIco = null;
  }

  if (pngToIco) {
    const buf = await pngToIco(pngSrc);
    fs.writeFileSync(icoDest, buf);
    console.log('Generated icon.ico via png-to-ico');
    return;
  }

  // Fallback: create ICO with System.Drawing (Windows)
  const ps = `
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('${pngSrc.replace(/'/g, "''")}')
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$images = @()
foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($src, 0, 0, $s, $s)
  $g.Dispose()
  $imgMs = New-Object System.IO.MemoryStream
  $bmp.Save($imgMs, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $images += ,$imgMs.ToArray()
  $imgMs.Dispose()
}
$offset = 6 + (16 * $sizes.Count)
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]
  $data = $images[$i]
  $byteSize = if ($s -eq 256) { [byte]0 } else { [byte]$s }
  $bw.Write($byteSize)
  $bw.Write($byteSize)
  $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$data.Length); $bw.Write([UInt32]$offset)
  $offset += $data.Length
}
foreach ($data in $images) { $bw.Write($data) }
$bw.Flush()
[System.IO.File]::WriteAllBytes('${icoDest.replace(/'/g, "''")}', $ms.ToArray())
$src.Dispose(); $bw.Dispose(); $ms.Dispose()
Write-Output 'OK'
`;
  const out = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
  if (!fs.existsSync(icoDest)) {
    console.error('Failed to generate icon.ico', out);
    process.exit(1);
  }
  console.log('Generated icon.ico via PowerShell');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
