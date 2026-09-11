$csharpCode = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;

public class IconBuilder {
    public static void Generate(int size, string path) {
        using (Bitmap bmp = new Bitmap(size, size)) {
            using (Graphics g = Graphics.FromImage(bmp)) {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;

                // --- Background: deep navy rounded rectangle ---
                int radius = (int)(size * 0.22);
                Rectangle rect = new Rectangle(0, 0, size, size);

                using (SolidBrush bgBrush = new SolidBrush(Color.FromArgb(255, 13, 17, 23))) {
                    using (GraphicsPath bgPath = RoundedRect(rect, radius)) {
                        g.FillPath(bgBrush, bgPath);
                    }
                }

                // --- Sparkline behind symbols (only 48px+) ---
                if (size >= 48) {
                    int lineY = (int)(size * 0.72);
                    int lineX1 = (int)(size * 0.08);
                    int lineX2 = (int)(size * 0.92);
                    int amplitude = (int)(size * 0.14);
                    int segments = 8;
                    float[] sparkX = new float[segments + 1];
                    float[] sparkY = new float[segments + 1];
                    float[] pattern = { 0f, 0.2f, -0.05f, 0.5f, 0.15f, 0.7f, 0.35f, 0.9f, 0.6f };
                    for (int i = 0; i <= segments; i++) {
                        sparkX[i] = lineX1 + ((lineX2 - lineX1) * i / segments);
                        sparkY[i] = lineY - (amplitude * pattern[i]);
                    }
                    using (Pen sparkPen = new Pen(Color.FromArgb(60, 16, 185, 129), Math.Max(1f, size * 0.025f))) {
                        sparkPen.LineJoin = LineJoin.Round;
                        PointF[] sparkPoints = new PointF[segments + 1];
                        for (int i = 0; i <= segments; i++) sparkPoints[i] = new PointF(sparkX[i], sparkY[i]);
                        g.DrawLines(sparkPen, sparkPoints);
                    }
                }

                // --- Rupee symbol (left, emerald green) ---
                float rupeeFontSize = size < 32 ? size * 0.55f : size * 0.52f;
                using (Font rupeeFont = new Font("Arial", rupeeFontSize, FontStyle.Bold, GraphicsUnit.Pixel)) {
                    using (SolidBrush rupeeBrush = new SolidBrush(Color.FromArgb(255, 16, 185, 129))) {
                        StringFormat sf = new StringFormat();
                        sf.Alignment = StringAlignment.Near;
                        sf.LineAlignment = StringAlignment.Center;
                        RectangleF rupeeRect = new RectangleF(size * 0.03f, size * 0.04f, size * 0.62f, size * 0.92f);
                        if (size <= 16) {
                            sf.Alignment = StringAlignment.Center;
                            rupeeRect = new RectangleF(0, size * 0.04f, size, size);
                        }
                        g.DrawString("₹", rupeeFont, rupeeBrush, rupeeRect, sf);
                    }
                }

                // --- Dollar symbol (right, near white) — only 32px+ ---
                if (size >= 32) {
                    float dollarFontSize = size * 0.48f;
                    using (Font dollarFont = new Font("Arial", dollarFontSize, FontStyle.Bold, GraphicsUnit.Pixel)) {
                        using (SolidBrush dollarBrush = new SolidBrush(Color.FromArgb(240, 248, 250, 252))) {
                            StringFormat sf2 = new StringFormat();
                            sf2.Alignment = StringAlignment.Far;
                            sf2.LineAlignment = StringAlignment.Center;
                            RectangleF dollarRect = new RectangleF(size * 0.28f, size * 0.04f, size * 0.68f, size * 0.92f);
                            g.DrawString("$", dollarFont, dollarBrush, dollarRect, sf2);
                        }
                    }
                }

                // --- Live pulse dot (top-right corner) — only 32px+ ---
                if (size >= 32) {
                    int dotSize = Math.Max(4, (int)(size * 0.155));
                    int dotX = (int)(size * 0.73);
                    int dotY = (int)(size * 0.08);
                    using (SolidBrush dotBrush = new SolidBrush(Color.FromArgb(255, 16, 185, 129))) {
                        g.FillEllipse(dotBrush, dotX, dotY, dotSize, dotSize);
                    }
                    using (Pen dotBorder = new Pen(Color.FromArgb(200, 255, 255, 255), Math.Max(1f, size * 0.028f))) {
                        g.DrawEllipse(dotBorder, dotX, dotY, dotSize, dotSize);
                    }
                }
            }
            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static GraphicsPath RoundedRect(Rectangle bounds, int radius) {
        int diameter = radius * 2;
        GraphicsPath path = new GraphicsPath();
        path.AddArc(bounds.X, bounds.Y, diameter, diameter, 180, 90);
        path.AddArc(bounds.Right - diameter, bounds.Y, diameter, diameter, 270, 90);
        path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter, diameter, diameter, 0, 90);
        path.AddArc(bounds.X, bounds.Bottom - diameter, diameter, diameter, 90, 90);
        path.CloseFigure();
        return path;
    }
}
"@

Add-Type -TypeDefinition $csharpCode -ReferencedAssemblies @(
    "System.Drawing.dll",
    "C:\Program Files\PowerShell\7\System.Drawing.Common.dll",
    "C:\Program Files\PowerShell\7\System.Drawing.Primitives.dll"
)

$iconsDir = Join-Path $PSScriptRoot "icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
}

[IconBuilder]::Generate(16,  (Join-Path $iconsDir "icon-16.png"))
[IconBuilder]::Generate(32,  (Join-Path $iconsDir "icon-32.png"))
[IconBuilder]::Generate(48,  (Join-Path $iconsDir "icon-48.png"))
[IconBuilder]::Generate(128, (Join-Path $iconsDir "icon-128.png"))

Write-Output "RupeePulse icons generated successfully in: $iconsDir"
