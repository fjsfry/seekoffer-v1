from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "functions" / "wechat-daily-digest" / "assets"
OUTPUT = ASSETS / "cover-template.png"


def main() -> None:
    image = Image.new("RGB", (900, 383), "#f4f1e8")
    draw = ImageDraw.Draw(image)
    teal = "#2f6f68"
    dark = "#1f2b2a"
    muted = "#687571"

    han = str(ASSETS / "SeekOfferEditorialHan.ttf")
    lato = str(ASSETS / "Lato-Regular.ttf")

    draw.rectangle((0, 0, 17, 382), fill=teal)
    draw.text((66, 52), "\u5bfb\u9e7f", font=ImageFont.truetype(han, 24), fill=teal)
    draw.text((124, 56), "SEEK OFFER", font=ImageFont.truetype(lato, 15), fill=teal)
    draw.rectangle((66, 218, 576, 219), fill=teal)
    draw.text(
        (64, 247),
        "\u4fdd\u7814\u4fe1\u606f\u66f4\u65b0",
        font=ImageFont.truetype(han, 40),
        fill=dark,
    )
    draw.text(
        (66, 323),
        "SEEKOFFER.COM.CN",
        font=ImageFont.truetype(lato, 14),
        fill="#7c8783",
    )
    draw.rectangle((632, 60, 632, 318), fill="#c8ceca")
    draw.text((702, 97), "\u5171", font=ImageFont.truetype(han, 20), fill=muted)
    draw.text((702, 257), "\u6761", font=ImageFont.truetype(han, 20), fill=muted)

    # Avoid Pillow's optimize mode: some PNG consumers misread its compact output.
    image.save(OUTPUT, compress_level=6)
    print(OUTPUT)


if __name__ == "__main__":
    main()
