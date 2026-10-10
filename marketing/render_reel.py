# -*- coding: utf-8 -*-
"""Vertical motion-graphics reel for ChatLoora / جات لورا."""
import math
import os
import subprocess
import sys

import arabic_reshaper
import imageio_ffmpeg
import numpy as np
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

W, H = 1080, 1920
FPS = 30
DURATION = 30.6
ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, "chatloora-tiktok-reel.mp4")
PREVIEW = os.path.join(ROOT, "preview")

FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_MED = r"C:\Windows\Fonts\segoeuisl.ttf"
FONT_LATIN = r"C:\Windows\Fonts\segoeuib.ttf"

PURPLE = (124, 92, 255)
CYAN = (34, 211, 238)
MAGENTA = (217, 70, 239)
WHITE = (248, 250, 252)
MUTED = (186, 198, 220)
AMBER = (251, 191, 36)
GREEN = (52, 211, 153)
RED = (251, 113, 133)

RESHAPER = arabic_reshaper.ArabicReshaper({"delete_harakat": False})


def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def smooth(t):
    t = clamp(t)
    return t * t * (3 - 2 * t)


def rtl(text):
    return get_display(RESHAPER.reshape(text))


def font(size, kind="bold"):
    path = FONT_BOLD if kind == "bold" else FONT_MED if kind == "med" else FONT_LATIN
    return ImageFont.truetype(path, size)


def trim_specks(img):
    alpha = img.getchannel("A")
    px = alpha.load()
    width, height = img.size
    last = 0
    for y in range(height):
        count = 0
        for x in range(0, width, 2):
            if px[x, y] > 24:
                count += 1
                if count > 6:
                    last = y
                    break
    if 0 < last < height - 2:
        img = img.crop((0, 0, width, last + 2))
    return img


def crop_alpha(img, pad=4):
    box = img.getchannel("A").getbbox()
    if not box:
        return img
    l, t, r, b = box
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(img.width, r + pad)
    b = min(img.height, b + pad)
    return img.crop((l, t, r, b))


def fade(img, opacity):
    if opacity >= 0.999:
        return img
    if opacity <= 0.01:
        return None
    r, g, b, a = img.split()
    a = ImageEnhance.Brightness(a).enhance(opacity)
    return Image.merge("RGBA", (r, g, b, a))


def blit(base, img, x, y, opacity=1.0):
    if img is None or opacity <= 0.01:
        return
    layer = fade(img, opacity)
    if layer is None:
        return
    x, y = int(x), int(y)
    if x >= W or y >= H or x + layer.width <= 0 or y + layer.height <= 0:
        return
    if x < 0 or y < 0 or x + layer.width > W or y + layer.height > H:
        src_x = max(0, -x)
        src_y = max(0, -y)
        dst_x = max(0, x)
        dst_y = max(0, y)
        cw = min(layer.width - src_x, W - dst_x)
        ch = min(layer.height - src_y, H - dst_y)
        if cw <= 0 or ch <= 0:
            return
        piece = layer.crop((src_x, src_y, src_x + cw, src_y + ch))
        base.alpha_composite(piece, (dst_x, dst_y))
        return
    base.alpha_composite(layer, (x, y))


def blit_center(base, img, cx, y, opacity=1.0):
    blit(base, img, cx - img.width / 2, y, opacity)


TEXT_CACHE = {}


def text_image(text, size, fill, kind="bold", tracking=0):
    shaped = text if kind == "latin" else rtl(text)
    key = (shaped, size, fill, kind)
    hit = TEXT_CACHE.get(key)
    if hit is not None:
        return hit
    f = font(size, kind)
    box = f.getbbox(shaped)
    w = max(1, box[2] - box[0] + 8)
    h = max(1, box[3] - box[1] + 8)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.text((4 - box[0], 4 - box[1] + 2), shaped, font=f, fill=(0, 0, 0, 90))
    d.text((4 - box[0], 4 - box[1]), shaped, font=f, fill=fill)
    TEXT_CACHE[key] = img
    return img


def fit_text(text, size, fill, max_w, kind="bold"):
    s = size
    img = text_image(text, s, fill, kind)
    while img.width > max_w and s > 28:
        s -= 2
        img = text_image(text, s, fill, kind)
    return img


def round_rect(w, h, radius, fill, outline=None, width=2):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((1, 1, w - 2, h - 2), radius=radius, fill=fill, outline=outline, width=width)
    return img


def hgradient(w, h, c1, c2, radius=28):
    t = np.linspace(0, 1, w, dtype=np.float32)
    row = (np.array(c1, np.float32) * (1 - t)[:, None] + np.array(c2, np.float32) * t[:, None])
    arr = np.repeat(row[None, :, :], h, axis=0).astype(np.uint8)
    img = Image.fromarray(arr, "RGB").convert("RGBA")
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    img.putalpha(mask)
    return img


def orb(diameter, color, blur, alpha=160):
    img = Image.new("RGBA", (diameter, diameter), (0, 0, 0, 0))
    ImageDraw.Draw(img).ellipse((0, 0, diameter - 1, diameter - 1), fill=color + (alpha,))
    return img.filter(ImageFilter.GaussianBlur(blur))


def make_background():
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    xx = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
    top = np.array([7, 8, 20], np.float32)
    mid = np.array([36, 14, 78], np.float32)
    bot = np.array([7, 22, 48], np.float32)
    col = np.where(yy < 0.48, top + (mid - top) * (yy / 0.48), mid + (bot - mid) * ((yy - 0.48) / 0.52))
    glow = np.exp(-((yy - 0.28) ** 2) / 0.06 - ((xx - 0.5) ** 2) / 0.18) * np.array([28, 8, 40], np.float32)
    dist = np.sqrt(((yy - 0.4) * 1.15) ** 2 + ((xx - 0.5) * 0.72) ** 2)
    vig = np.clip(1.08 - dist * 0.72, 0.55, 1.0)
    arr = np.clip((col + glow) * vig, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def check_mark(size, color):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((1, 1, size - 2, size - 2), fill=color)
    p = size / 64
    d.line([(18 * p, 34 * p), (28 * p, 44 * p), (46 * p, 22 * p)], fill=(255, 255, 255, 255), width=max(3, int(5 * p)))
    return img


def empty_box(size, color):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((2, 2, size - 3, size - 3), outline=color, width=3)
    return img


def icon_link():
    s = 220
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((18, 18, s - 18, s - 18), radius=48, fill=(124, 92, 255, 40), outline=CYAN + (220,), width=4)
    d.arc((58, 78, 130, 150), 20, 250, fill=WHITE + (255,), width=10)
    d.arc((90, 70, 162, 142), 200, 70, fill=CYAN + (255,), width=10)
    return img


def icon_chat():
    s = 220
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((28, 36, 192, 150), radius=36, fill=(52, 211, 153, 230))
    d.polygon([(70, 142), (58, 186), (112, 150)], fill=(52, 211, 153, 230))
    d.ellipse((70, 82, 90, 102), fill=WHITE)
    d.ellipse((104, 82, 124, 102), fill=WHITE)
    d.ellipse((138, 82, 158, 102), fill=WHITE)
    return img


def icon_pixel():
    s = 220
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((28, 28, 192, 192), outline=CYAN + (255,), width=8)
    d.ellipse((70, 70, 150, 150), outline=MAGENTA + (255,), width=8)
    d.ellipse((98, 98, 122, 122), fill=WHITE)
    return img


def icon_support():
    s = 160
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.arc((28, 28, 132, 120), 200, 340, fill=WHITE + (255,), width=10)
    d.rounded_rectangle((22, 78, 48, 118), radius=10, fill=CYAN + (255,))
    d.rounded_rectangle((112, 78, 138, 118), radius=10, fill=MAGENTA + (255,))
    d.arc((58, 96, 112, 140), 20, 160, fill=WHITE + (230,), width=6)
    return img


def load_logo_parts():
    icon = crop_alpha(Image.open(os.path.join(ASSETS, "chatloora-icon.png")).convert("RGBA"), 2)
    logo = crop_alpha(Image.open(os.path.join(ASSETS, "chatloora-logo.png")).convert("RGBA"), 2)
    return icon, logo


def logo_plate(logo, width=620):
    ratio = width / logo.width
    mark = logo.resize((width, max(1, int(logo.height * ratio))), Image.Resampling.LANCZOS)
    pad_x, pad_y = 54, 40
    w, h = mark.width + pad_x * 2, mark.height + pad_y * 2
    plate = round_rect(w, h, 40, (255, 255, 255, 255))
    plate.alpha_composite(mark, (pad_x, pad_y))
    shadow = Image.new("RGBA", (w + 80, h + 80), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((40, 46, 40 + w, 46 + h), radius=40, fill=(0, 0, 0, 140))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas = Image.new("RGBA", shadow.size, (0, 0, 0, 0))
    canvas.alpha_composite(shadow, (0, 0))
    canvas.alpha_composite(plate, (40, 28))
    return canvas


def platform_row(label, state):
    w, h = 860, 104
    if state == "on":
        img = hgradient(w, h, (88, 48, 220), (14, 140, 170), radius=28)
    elif state == "bad":
        img = round_rect(w, h, 28, (80, 24, 40, 210), (251, 113, 133, 180), 2)
    else:
        img = round_rect(w, h, 28, (255, 255, 255, 16), (255, 255, 255, 36), 2)
    name = text_image(label, 40, WHITE if state != "off" else MUTED, "bold")
    box = check_mark(48, GREEN if state == "on" else RED) if state in ("on", "bad") else empty_box(48, (160, 170, 190, 220))
    img.alpha_composite(box, (w - 78, (h - 48) // 2))
    img.alpha_composite(name, (w - 100 - name.width, (h - name.height) // 2))
    return img


def account_row(title):
    w, h = 860, 118
    img = round_rect(w, h, 30, (255, 255, 255, 18), (255, 255, 255, 40), 2)
    dot = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    ImageDraw.Draw(dot).ellipse((0, 0, 63, 63), fill=PURPLE + (255,))
    letter = text_image("ج", 32, WHITE, "bold")
    dot.alpha_composite(letter, ((64 - letter.width) // 2, (64 - letter.height) // 2 - 2))
    img.alpha_composite(dot, (w - 92, (h - 64) // 2))
    name = text_image(title, 36, WHITE, "bold")
    img.alpha_composite(name, (w - 116 - name.width, 22))
    tag = text_image("مربوط", 26, GREEN, "med")
    img.alpha_composite(tag, (w - 116 - tag.width, 64))
    return img


def glass(w, h, radius=36):
    return round_rect(w, h, radius, (10, 14, 32, 170), (255, 255, 255, 36), 2)


def window(t, start, end, fade_s=0.38, fade_out=True):
    if t < start or t > end:
        return 0.0, 0.0, 0
    a = 1.0
    if t < start + fade_s:
        a = smooth((t - start) / fade_s)
    elif fade_out and t > end - fade_s:
        a = smooth((end - t) / fade_s)
    local = (t - start) / (end - start)
    dy = int((1 - ease_out(clamp((t - start) / 0.42))) * 42)
    return a, local, dy


class Reel:
    def __init__(self):
        self.bg = make_background()
        self.orb_a = orb(720, (124, 60, 255), 70, 150)
        self.orb_b = orb(640, (20, 170, 200), 64, 130)
        self.orb_c = orb(420, (180, 40, 160), 50, 110)
        icon, logo = load_logo_parts()
        icon = trim_specks(icon)
        self.mark = icon.resize((150, int(150 * icon.height / icon.width)), Image.Resampling.LANCZOS)
        self.hero = logo_plate(logo, 640)
        self.cta_logo = logo_plate(logo, 700)
        self.rows_bad = [
            platform_row("فيسبوك", "bad"),
            platform_row("إنستغرام", "bad"),
            platform_row("تيك توك", "bad"),
            platform_row("يوتيوب", "bad"),
        ]
        self.rows_fix = [
            platform_row("فيسبوك", "off"),
            platform_row("إنستغرام", "off"),
            platform_row("تيك توك", "on"),
            platform_row("يوتيوب", "off"),
        ]
        self.accounts = [
            account_row("الحساب الإعلاني الأول"),
            account_row("الحساب الإعلاني الثاني"),
            account_row("الحساب الإعلاني الثالث"),
        ]
        self.link_icon = icon_link()
        self.chat_icon = icon_chat()
        self.pixel_icon = icon_pixel()
        self.support_icon = icon_support()
        self.kicker = {}

    def backdrop(self, t):
        frame = self.bg.copy()
        blit(frame, self.orb_a, -160 + math.sin(t * 0.45) * 30, 80 + math.cos(t * 0.35) * 24, 0.9)
        blit(frame, self.orb_b, 520 + math.cos(t * 0.4) * 26, 1180 + math.sin(t * 0.3) * 20, 0.85)
        blit(frame, self.orb_c, 300 + math.sin(t * 0.5) * 20, 700, 0.45)
        return frame

    def watermark(self, frame, opacity):
        group_w = self.mark.width + 16 + text_image("جات لورا", 40, WHITE, "bold").width
        x = (W - group_w) // 2
        y = 78
        blit(frame, self.mark, x + group_w - self.mark.width, y, opacity)
        label = text_image("جات لورا", 40, WHITE, "bold")
        blit(frame, label, x, y + (self.mark.height - label.height) // 2, opacity)

    def heading(self, frame, kicker, title, sub, y, alpha, dy):
        if kicker:
            k = fit_text(kicker, 34, CYAN, 900, "med")
            blit_center(frame, k, W / 2, y + dy, alpha)
            y += k.height + 18
        title_img = fit_text(title, 78, WHITE, 960, "bold")
        blit_center(frame, title_img, W / 2, y + dy, alpha)
        y += title_img.height + 14
        if sub:
            s = fit_text(sub, 40, MUTED, 920, "med")
            blit_center(frame, s, W / 2, y + dy, alpha)
            y += s.height + 28
        else:
            y += 20
        return y

    def stack_rows(self, frame, rows, y, alpha, local, dy):
        gap = 18
        for i, row in enumerate(rows):
            appear = ease_out(clamp((local - i * 0.06) / 0.22))
            blit_center(frame, row, W / 2, y + dy + int((1 - appear) * 16), alpha * appear)
            y += row.height + gap
        return y

    def scene_intro(self, frame, t, a, local, dy):
        scale = 0.9 + 0.1 * ease_out(clamp(local / 0.28))
        hero = self.hero
        if scale < 0.995:
            hero = hero.resize((max(1, int(hero.width * scale)), max(1, int(hero.height * scale))), Image.Resampling.LANCZOS)
        y = 430 + dy
        blit_center(frame, hero, W / 2, y, a)
        y += hero.height + 48
        title = fit_text("أدر إعلانات تيك توك", 72, WHITE, 960)
        blit_center(frame, title, W / 2, y, a * ease_out(clamp((local - 0.12) / 0.2)))
        y += title.height + 16
        sub = fit_text("من مكان واحد", 44, CYAN, 900, "med")
        blit_center(frame, sub, W / 2, y, a * ease_out(clamp((local - 0.22) / 0.2)))

    def scene_problem(self, frame, t, a, local, dy):
        y = self.heading(frame, "المشكلة", "تظهر منصات أخرى", "وأنت تريد الإعلان على تيك توك", 300, a, dy)
        self.stack_rows(frame, self.rows_bad, y + 10, a, local, dy)
        note = fit_text("المنصات تختلط عند إنشاء الإعلان", 34, AMBER, 920, "med")
        blit_center(frame, note, W / 2, 1560 + dy, a * ease_out(clamp((local - 0.35) / 0.2)))

    def scene_solution(self, frame, t, a, local, dy):
        y = self.heading(frame, "الحل مع جات لورا", "حدّد تيك توك فقط", "الإعلان يظهر على تيك توك", 300, a, dy)
        self.stack_rows(frame, self.rows_fix, y + 10, a, local, dy)
        note = fit_text("بدون ظهور باقي المنصات", 36, GREEN, 920, "med")
        blit_center(frame, note, W / 2, 1560 + dy, a * ease_out(clamp((local - 0.4) / 0.2)))

    def scene_accounts(self, frame, t, a, local, dy):
        pop = ease_out(clamp(local / 0.2))
        blit_center(frame, self.link_icon, W / 2, 280 + dy + int((1 - pop) * 20), a * pop)
        y = self.heading(frame, None, "اربط حسابات تيك توك", "الحسابات الإعلانية داخل المنصة", 520, a, dy)
        self.stack_rows(frame, self.accounts, y + 6, a, local, dy)

    def scene_whatsapp(self, frame, t, a, local, dy):
        pop = ease_out(clamp(local / 0.2))
        blit_center(frame, self.chat_icon, W / 2, 300 + dy, a * pop)
        y = self.heading(frame, None, "اربط أرقام واتساب", "العميل يفتح المحادثة مباشرة", 560, a, dy)
        card = glass(820, 250, 32)
        line1 = text_image("الرقم مربوط وجاهز", 40, WHITE, "bold")
        line2 = text_image("النقرة على الإعلان تفتح واتساب", 32, MUTED, "med")
        card.alpha_composite(line1, ((card.width - line1.width) // 2, 70))
        card.alpha_composite(line2, ((card.width - line2.width) // 2, 140))
        blit_center(frame, card, W / 2, y + 20 + dy, a * ease_out(clamp((local - 0.18) / 0.25)))

    def scene_pixel(self, frame, t, a, local, dy):
        pop = ease_out(clamp(local / 0.2))
        blit_center(frame, self.pixel_icon, W / 2, 280 + dy, a * pop)
        y = self.heading(frame, None, "بكسل تتبّع", "قراءات حقيقية لحملاتك", 530, a, dy)
        chart = self.chart(ease_out(clamp((local - 0.12) / 0.55)))
        blit_center(frame, chart, W / 2, y + 10 + dy, a)

    def chart(self, progress):
        w, h = 880, 420
        img = glass(w, h, 32)
        d = ImageDraw.Draw(img)
        left, right, top, bottom = 70, 820, 50, 300
        for i in range(4):
            yy = top + i * (bottom - top) / 3
            d.line([(left, yy), (right, yy)], fill=(255, 255, 255, 28), width=2)
        pts = [(90, 270), (210, 230), (330, 246), (450, 160), (570, 180), (700, 90), (800, 70)]
        n = max(2, int(1 + progress * (len(pts) - 1)))
        shown = pts[:n]
        if len(shown) >= 2:
            area = shown + [(shown[-1][0], bottom), (shown[0][0], bottom)]
            d.polygon(area, fill=(34, 211, 238, 40))
            d.line(shown, fill=CYAN + (255,), width=7, joint="curve")
        for x, y in shown:
            d.ellipse((x - 8, y - 8, x + 8, y + 8), fill=WHITE)
        cap = text_image("نقرات وتحويلات حقيقية", 30, MUTED, "med")
        img.alpha_composite(cap, ((w - cap.width) // 2, 340))
        return img

    def scene_start(self, frame, t, a, local, dy):
        y = self.heading(frame, "ابدأ الآن", "أنشئ حسابك وفعّله", "ثم ابدأ العمل على إعلاناتك", 300, a, dy)
        steps = ["أنشئ حساباً جديداً", "فعّل الحساب", "ابدأ إنشاء الإعلانات"]
        for i, label in enumerate(steps):
            appear = ease_out(clamp((local - 0.08 - i * 0.1) / 0.22))
            row = glass(860, 110, 28)
            num = text_image(str(i + 1), 36, (7, 10, 24), "latin")
            badge = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
            ImageDraw.Draw(badge).ellipse((0, 0, 63, 63), fill=CYAN + (255,))
            badge.alpha_composite(num, ((64 - num.width) // 2, (64 - num.height) // 2 - 2))
            name = text_image(label, 38, WHITE, "bold")
            row.alpha_composite(badge, (row.width - 88, (row.height - 64) // 2))
            row.alpha_composite(name, (row.width - 110 - name.width, (row.height - name.height) // 2))
            blit_center(frame, row, W / 2, y + dy + int((1 - appear) * 18), a * appear)
            y += 128
        pill = hgradient(520, 84, (88, 48, 220), (14, 140, 170), radius=42)
        support = text_image("دعم فني متواصل", 34, WHITE, "bold")
        pill.alpha_composite(support, ((pill.width - support.width) // 2, (pill.height - support.height) // 2))
        show = ease_out(clamp((local - 0.45) / 0.2))
        blit_center(frame, pill, W / 2, y + 24 + dy, a * show)

    def scene_cta(self, frame, t, a, local, dy):
        pop = 0.92 + 0.08 * ease_out(clamp(local / 0.25))
        logo = self.cta_logo
        if pop < 0.995:
            logo = logo.resize((max(1, int(logo.width * pop)), max(1, int(logo.height * pop))), Image.Resampling.LANCZOS)
        y = 380 + dy
        blit_center(frame, logo, W / 2, y, a)
        y += logo.height + 46
        title = fit_text("أنشئ حسابك وابدأ", 64, WHITE, 960)
        blit_center(frame, title, W / 2, y, a * ease_out(clamp((local - 0.1) / 0.2)))
        y += title.height + 28
        btn = hgradient(640, 110, (109, 40, 217), (6, 182, 212), radius=55)
        url = text_image("almutamayiziq.com", 40, WHITE, "latin")
        btn.alpha_composite(url, ((btn.width - url.width) // 2, (btn.height - url.height) // 2 - 2))
        blit_center(frame, btn, W / 2, y, a * ease_out(clamp((local - 0.2) / 0.22)))
        y += 150
        foot = fit_text("دعم فني متواصل", 36, MUTED, 900, "med")
        blit_center(frame, foot, W / 2, y, a * ease_out(clamp((local - 0.32) / 0.2)))

    def frame(self, t):
        frame = self.backdrop(t)
        scenes = [
            (0.15, 4.05, self.scene_intro, False, True),
            (3.7, 8.15, self.scene_problem, True, True),
            (7.8, 12.25, self.scene_solution, True, True),
            (11.9, 15.85, self.scene_accounts, True, True),
            (15.5, 19.35, self.scene_whatsapp, True, True),
            (19.0, 22.85, self.scene_pixel, True, True),
            (22.5, 26.35, self.scene_start, True, True),
            (26.0, DURATION, self.scene_cta, False, False),
        ]
        mark_a = 0
        for start, end, fn, branded, fade_out in scenes:
            a, local, dy = window(t, start, end, fade_out=fade_out)
            if a <= 0:
                continue
            if branded:
                mark_a = max(mark_a, a)
            fn(frame, t, a, local, dy)
        if mark_a > 0:
            self.watermark(frame, mark_a)
        return frame


def render_preview(reel):
    os.makedirs(PREVIEW, exist_ok=True)
    times = [1.6, 6.0, 10.0, 13.8, 17.4, 20.9, 24.4, 27.8]
    for t in times:
        img = reel.frame(t).convert("RGB")
        path = os.path.join(PREVIEW, f"t{t:.1f}.jpg")
        img.save(path, quality=90)
        print("preview", path, flush=True)


def render_video(reel):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg, "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", OUT,
    ]
    log_path = os.path.join(ROOT, "ffmpeg-log.txt")
    total = int(DURATION * FPS)
    with open(log_path, "w", encoding="utf-8") as log:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=log)
        try:
            for i in range(total):
                t = i / FPS
                frame = reel.frame(t).convert("RGB")
                proc.stdin.write(frame.tobytes())
                if i % 30 == 0:
                    print(f"frame {i}/{total}", flush=True)
        finally:
            proc.stdin.close()
        code = proc.wait()
    if code != 0:
        raise SystemExit(f"ffmpeg failed {code}")
    print("wrote", OUT, flush=True)


def main():
    reel = Reel()
    if len(sys.argv) > 1 and sys.argv[1] == "preview":
        render_preview(reel)
    else:
        render_video(reel)


if __name__ == "__main__":
    main()
