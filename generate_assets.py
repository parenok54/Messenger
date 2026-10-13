import os
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

os.makedirs("docs/screenshots", exist_ok=True)
os.makedirs("docs", exist_ok=True)
os.makedirs("frontend/public/icons", exist_ok=True)

def get_font(size, bold=False):
    font_name = "segoeuib.ttf" if bold else "segoeui.ttf"
    try:
        return ImageFont.truetype(font_name, size)
    except:
        try:
            return ImageFont.truetype("arialbd.ttf" if bold else "arial.ttf", size)
        except:
            return ImageFont.load_default()

def draw_squircle(draw, bbox, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)

# -------------------------------------------------------------------------
# 1. GENERATE LOGO (SVG & PNG)
# -------------------------------------------------------------------------
def generate_logos():
    print("Generating logo and icons...")
    # High-res SVG
    svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34B7F1" />
      <stop offset="50%" stop-color="#2AABEE" />
      <stop offset="100%" stop-color="#0088CC" />
    </linearGradient>
    <linearGradient id="planeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#E8F4FC" />
    </linearGradient>
    <linearGradient id="accentFold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#BDE3FA" />
      <stop offset="100%" stop-color="#99D4F8" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#004D73" flood-opacity="0.35" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="136" fill="url(#bgGrad)" />
  <circle cx="256" cy="256" r="236" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="4" />
  <g filter="url(#shadow)">
    <!-- Main Paper Airplane -->
    <path d="M124 246 L386 142 C398 137 408 147 403 160 L350 376 C346 391 330 394 319 385 L252 328 L218 360 C214 364 209 367 203 367 L207 301 L338 184 C344 179 337 176 331 180 L188 274 L128 253 C114 248 114 239 124 246 Z" fill="url(#planeGrad)" />
    <!-- Wing fold shadow -->
    <path d="M252 328 L207 301 L338 184 C344 179 337 176 331 180 Z" fill="url(#accentFold)" opacity="0.6" />
  </g>
</svg>
'''
    with open("docs/logo.svg", "w", encoding="utf-8") as f:
        f.write(svg_content)
    with open("frontend/public/icons/icon.svg", "w", encoding="utf-8") as f:
        f.write(svg_content)

    # Render PNG 512x512 with Pillow (High quality anti-aliased)
    size = 512
    scale = 2
    w, h = size * scale, size * scale
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background gradient
    # Gradient interpolation
    for y in range(h):
        ratio = y / h
        r = int(52 * (1 - ratio) + 0 * ratio)
        g = int(183 * (1 - ratio) + 136 * ratio)
        b = int(241 * (1 - ratio) + 204 * ratio)
        draw.line([(0, y), (w, y)], fill=(r, g, b, 255))

    # Mask to rounded rect
    mask = Image.new("L", (w, h), 0)
    mask_draw = ImageDraw.Draw(mask)
    draw_squircle(mask_draw, (0, 0, w, h), radius=int(136 * scale), fill=255)
    img.putalpha(mask)

    # Draw plane
    plane_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(plane_img)
    # Scaled coordinates for paper plane
    poly_main = [
        (124 * scale, 246 * scale),
        (386 * scale, 142 * scale),
        (350 * scale, 376 * scale),
        (252 * scale, 328 * scale),
        (207 * scale, 301 * scale),
        (128 * scale, 253 * scale)
    ]
    poly_top = [
        (386 * scale, 142 * scale),
        (350 * scale, 376 * scale),
        (252 * scale, 328 * scale),
        (338 * scale, 184 * scale)
    ]
    poly_tail = [
        (252 * scale, 328 * scale),
        (218 * scale, 360 * scale),
        (203 * scale, 367 * scale),
        (207 * scale, 301 * scale)
    ]

    # Draw shadow
    pdraw.polygon(poly_main, fill=(255, 255, 255, 255))
    pdraw.polygon(poly_top, fill=(245, 250, 255, 255))
    pdraw.polygon(poly_tail, fill=(185, 225, 250, 240))
    pdraw.polygon([(252 * scale, 328 * scale), (207 * scale, 301 * scale), (338 * scale, 184 * scale)], fill=(170, 215, 245, 200))

    # Inner subtle glow/border
    pdraw.rounded_rectangle((8 * scale, 8 * scale, w - 8 * scale, h - 8 * scale), radius=int(130 * scale), outline=(255, 255, 255, 50), width=4 * scale)

    # Composite plane onto background
    img = Image.alpha_composite(img, plane_img)
    logo_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    logo_512.save("docs/logo.png", "PNG")
    logo_512.save("frontend/public/icons/icon-512.png", "PNG")

    logo_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    logo_192.save("frontend/public/icons/icon-192.png", "PNG")

    # Favicon 64x64 and .ico
    logo_64 = img.resize((64, 64), Image.Resampling.LANCZOS)
    logo_64.save("frontend/public/favicon.ico", format="ICO", sizes=[(64, 64), (32, 32), (16, 16)])
    print("Logo and icons generated!")

# -------------------------------------------------------------------------
# 2. GENERATE SCREENSHOT: LOGIN (docs/screenshots/login.png)
# -------------------------------------------------------------------------
def generate_login_screenshot():
    print("Generating docs/screenshots/login.png...")
    width, height = 1200, 800
    img = Image.new("RGB", (width, height), (14, 22, 33)) # #0e1621
    draw = ImageDraw.Draw(img)

    # Ambient backdrop glowing spheres
    # Subtle cyan glow in top center
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse([450, 100, 750, 400], fill=(42, 171, 238, 28))
    gdraw.ellipse([200, 500, 500, 800], fill=(0, 136, 204, 15))
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    img.paste(glow, (0, 0), glow)
    draw = ImageDraw.Draw(img)

    # Glass Card in Center
    cw, ch = 460, 560
    cx1 = (width - cw) // 2
    cy1 = (height - ch) // 2
    cx2, cy2 = cx1 + cw, cy1 + ch

    # Glass card fill & border
    draw_squircle(draw, (cx1, cy1, cx2, cy2), radius=28, fill=(23, 33, 43), outline=(45, 60, 75), width=1)

    # Top Logo Icon inside Card
    icon_box = (width // 2 - 42, cy1 + 45, width // 2 + 42, cy1 + 129)
    draw_squircle(draw, icon_box, radius=24, fill=(42, 171, 238))
    # Small paper plane inside logo
    logo_small = Image.open("docs/logo.png").convert("RGBA").resize((70, 70), Image.Resampling.LANCZOS)
    img.paste(logo_small, (width // 2 - 35, cy1 + 52), logo_small)

    # Title
    f_title = get_font(26, bold=True)
    f_sub = get_font(14, bold=False)
    draw.text((width // 2, cy1 + 155), "Вход в Messenger", fill=(255, 255, 255), font=f_title, anchor="mt")
    draw.text((width // 2, cy1 + 195), "Введите ваш номер телефона для авторизации", fill=(140, 155, 170), font=f_sub, anchor="mt")

    # Phone input field
    f_label = get_font(12, bold=True)
    f_input = get_font(15, bold=False)
    draw.text((cx1 + 40, cy1 + 240), "НОМЕР ТЕЛЕФОНА", fill=(120, 140, 160), font=f_label)

    inp_box = (cx1 + 40, cy1 + 265, cx2 - 40, cy1 + 320)
    draw_squircle(draw, inp_box, radius=14, fill=(36, 47, 61), outline=(55, 75, 95), width=1)
    draw.text((cx1 + 60, cy1 + 292), "+7 (999) 456-78-90", fill=(255, 255, 255), font=f_input, anchor="lm")

    # OTP Code Box with animation style
    draw.text((cx1 + 40, cy1 + 345), "КОД ПОДТВЕРЖДЕНИЯ (OTP)", fill=(120, 140, 160), font=f_label)

    # 4 OTP Digit boxes
    digit_w, digit_h = 75, 60
    start_x = cx1 + 40
    gap = (cw - 80 - 4 * digit_w) // 3
    otp_digits = ["7", "2", "8", "4"]
    f_digit = get_font(26, bold=True)

    for i in range(4):
        dx1 = start_x + i * (digit_w + gap)
        dx2 = dx1 + digit_w
        dy1 = cy1 + 372
        dy2 = dy1 + digit_h
        is_focused = (i == 3)
        outline_col = (42, 171, 238) if is_focused else (55, 75, 95)
        fill_col = (30, 42, 54) if is_focused else (36, 47, 61)
        draw_squircle(draw, (dx1, dy1, dx2, dy2), radius=14, fill=fill_col, outline=outline_col, width=2 if is_focused else 1)
        draw.text(((dx1 + dx2) // 2, (dy1 + dy2) // 2), otp_digits[i], fill=(255, 255, 255), font=f_digit, anchor="mm")

    # Dev Helper notification badge
    f_badge = get_font(12, bold=False)
    badge_box = (cx1 + 40, cy1 + 450, cx2 - 40, cy1 + 482)
    draw_squircle(draw, badge_box, radius=8, fill=(24, 45, 60), outline=(42, 171, 238, 120), width=1)
    draw.text(((cx1 + cx2) // 2, cy1 + 466), "⚡ Код подтверждения отправлен: 7284 (Режим разработки)", fill=(70, 185, 255), font=f_badge, anchor="mm")

    # Submit Button
    btn_box = (cx1 + 40, cy1 + 500, cx2 - 40, cy1 + 550)
    draw_squircle(draw, btn_box, radius=14, fill=(42, 171, 238))
    f_btn = get_font(15, bold=True)
    draw.text(((cx1 + cx2) // 2, cy1 + 525), "Продолжить", fill=(255, 255, 255), font=f_btn, anchor="mm")

    # Top Language Selector
    draw_squircle(draw, (width - 150, 25, width - 40, 60), radius=12, fill=(23, 33, 43), outline=(45, 60, 75))
    f_lang = get_font(13, bold=False)
    draw.text((width - 95, 42), "🇷🇺 Русский", fill=(200, 215, 230), font=f_lang, anchor="mm")

    img.save("docs/screenshots/login.png", "PNG")
    print("Login screenshot generated!")

# -------------------------------------------------------------------------
# 3. GENERATE SCREENSHOT: CHAT LIST (docs/screenshots/chat-list.png)
# -------------------------------------------------------------------------
def generate_chat_list_screenshot():
    print("Generating docs/screenshots/chat-list.png...")
    width, height = 1280, 800
    img = Image.new("RGB", (width, height), (14, 22, 33)) # #0e1621
    draw = ImageDraw.Draw(img)

    # 1. Left Sidebar
    sidebar_w = 400
    draw.rectangle([(0, 0), (sidebar_w, height)], fill=(23, 33, 43)) # #17212b
    draw.line([(sidebar_w, 0), (sidebar_w, height)], fill=(32, 43, 54), width=1)

    # Sidebar Header: Hamburger, Search, New Chat
    draw.rectangle([(0, 0), (sidebar_w, 65)], fill=(23, 33, 43))
    # Menu icon (3 bars)
    for i in range(3):
        draw.line([(25, 28 + i * 6), (43, 28 + i * 6)], fill=(140, 155, 170), width=2)

    # Search Bar
    search_box = (60, 16, sidebar_w - 60, 52)
    draw_squircle(draw, search_box, radius=18, fill=(36, 47, 61))
    f_search = get_font(14, bold=False)
    draw.text((85, 34), "Поиск чатов и сообщений...", fill=(110, 130, 150), font=f_search, anchor="lm")

    # New chat plus button
    draw_squircle(draw, (sidebar_w - 48, 18, sidebar_w - 16, 50), radius=16, fill=(42, 171, 238))
    f_plus = get_font(20, bold=True)
    draw.text((sidebar_w - 32, 33), "+", fill=(255, 255, 255), font=f_plus, anchor="mm")

    # Chats data
    chats_data = [
        {
            "name": "Анна Смирнова",
            "msg": "Договорились, созваниваемся в 18:00! 📞",
            "time": "17:42",
            "badge": 2,
            "online": True,
            "color": (235, 87, 87),
            "type": "private",
            "active": True,
            "checks": 2
        },
        {
            "name": "Backend Team 🚀",
            "msg": "Павел: Мердж реквест по Redis pub/sub одобрен",
            "time": "17:30",
            "badge": 5,
            "online": False,
            "color": (46, 204, 113),
            "type": "group",
            "active": False,
            "checks": 0
        },
        {
            "name": "Tech & Architecture News",
            "msg": "Релиз FastAPI 0.115 и Next.js 14.2: новые возможности...",
            "time": "16:15",
            "badge": 0,
            "online": False,
            "color": (241, 196, 15),
            "type": "channel",
            "active": False,
            "checks": 0
        },
        {
            "name": "Максим Кузнецов",
            "msg": "🎙 Голосовое сообщение (0:28)",
            "time": "15:05",
            "badge": 0,
            "online": True,
            "color": (155, 89, 182),
            "type": "private",
            "active": False,
            "checks": 2
        },
        {
            "name": "UI/UX & Mobile Design",
            "msg": "Артём: Ссылка на обновленный Figma UI Kit",
            "time": "13:40",
            "badge": 1,
            "online": False,
            "color": (52, 152, 219),
            "type": "group",
            "active": False,
            "checks": 0
        },
        {
            "name": "Елена Васильева",
            "msg": "Спасибо за оперативный ответ!",
            "time": "Вчера",
            "badge": 0,
            "online": False,
            "color": (230, 126, 34),
            "type": "private",
            "active": False,
            "checks": 2
        },
        {
            "name": "DevOps & CI/CD",
            "msg": "Docker container build passed in 48s ✅",
            "time": "Пн",
            "badge": 0,
            "online": False,
            "color": (26, 188, 156),
            "type": "group",
            "active": False,
            "checks": 0
        }
    ]

    f_cname = get_font(15, bold=True)
    f_cmsg = get_font(13, bold=False)
    f_ctime = get_font(12, bold=False)
    f_badge = get_font(11, bold=True)

    y_offset = 72
    for chat in chats_data:
        item_h = 72
        if chat["active"]:
            draw_squircle(draw, (8, y_offset, sidebar_w - 8, y_offset + item_h), radius=12, fill=(32, 45, 59))
        
        # Avatar
        av_x, av_y = 22, y_offset + 12
        draw.ellipse([av_x, av_y, av_x + 48, av_y + 48], fill=chat["color"])
        # Avatar initial
        draw.text((av_x + 24, av_y + 24), chat["name"][0], fill=(255, 255, 255), font=get_font(19, bold=True), anchor="mm")

        # Online dot
        if chat["online"]:
            draw.ellipse([av_x + 36, av_y + 36, av_x + 48, av_y + 48], fill=(78, 205, 120), outline=(23, 33, 43), width=2)

        # Title
        draw.text((82, y_offset + 22), chat["name"], fill=(255, 255, 255), font=f_cname, anchor="lm")

        # Message preview
        msg_color = (130, 150, 170) if not chat["active"] else (160, 190, 220)
        draw.text((82, y_offset + 48), chat["msg"][:36] + ("..." if len(chat["msg"]) > 36 else ""), fill=msg_color, font=f_cmsg, anchor="lm")

        # Time
        draw.text((sidebar_w - 24, y_offset + 22), chat["time"], fill=(110, 130, 150), font=f_ctime, anchor="rm")

        # Badge or checks
        if chat["badge"] > 0:
            bw = 24 if chat["badge"] < 10 else 30
            draw_squircle(draw, (sidebar_w - 24 - bw, y_offset + 38, sidebar_w - 24, y_offset + 58), radius=10, fill=(42, 171, 238))
            draw.text((sidebar_w - 24 - bw // 2, y_offset + 48), str(chat["badge"]), fill=(255, 255, 255), font=f_badge, anchor="mm")
        elif chat.get("checks"):
            # Double checkmark
            draw.text((sidebar_w - 24, y_offset + 48), "✓✓", fill=(42, 171, 238), font=get_font(13, bold=True), anchor="rm")

        y_offset += item_h + 2

    # 2. Main Chat Area
    # Header
    draw.rectangle([(sidebar_w + 1, 0), (width, 65)], fill=(23, 33, 43))
    draw.line([(sidebar_w + 1, 65), (width, 65)], fill=(32, 43, 54), width=1)

    # Active user avatar in header
    draw.ellipse([sidebar_w + 20, 12, sidebar_w + 62, 54], fill=(235, 87, 87))
    draw.text((sidebar_w + 41, 33), "А", fill=(255, 255, 255), font=get_font(18, bold=True), anchor="mm")
    draw.ellipse([sidebar_w + 51, 43, sidebar_w + 61, 53], fill=(78, 205, 120), outline=(23, 33, 43), width=2)

    # Header Name & status
    draw.text((sidebar_w + 72, 25), "Анна Смирнова", fill=(255, 255, 255), font=f_cname, anchor="lm")
    draw.text((sidebar_w + 72, 46), "в сети", fill=(78, 205, 120), font=f_ctime, anchor="lm")

    # Call buttons in header
    btn_audio = (width - 150, 18, width - 110, 50)
    draw_squircle(draw, btn_audio, radius=12, fill=(36, 47, 61))
    draw.text((width - 130, 34), "📞", font=get_font(16), fill=(255, 255, 255), anchor="mm")

    btn_video = (width - 100, 18, width - 60, 50)
    draw_squircle(draw, btn_video, radius=12, fill=(42, 171, 238))
    draw.text((width - 80, 34), "📹", font=get_font(16), fill=(255, 255, 255), anchor="mm")

    # Chat Messages
    # Date badge
    draw_squircle(draw, (width // 2 + 50, 85, width // 2 + 150, 110), radius=12, fill=(24, 37, 51))
    draw.text((width // 2 + 100, 97), "Сегодня", fill=(130, 160, 190), font=get_font(12, bold=True), anchor="mm")

    # Message 1 (Incoming)
    draw_squircle(draw, (sidebar_w + 30, 130, sidebar_w + 480, 195), radius=16, fill=(24, 37, 51), outline=(35, 52, 70))
    draw.text((sidebar_w + 48, 150), "Привет! Посмотрела архитектуру мессенджера —", fill=(255, 255, 255), font=f_cmsg)
    draw.text((sidebar_w + 48, 170), "связка FastAPI + Redis pub/sub работает мгновенно! 🔥", fill=(255, 255, 255), font=f_cmsg)
    draw.text((sidebar_w + 465, 183), "17:35", fill=(120, 140, 160), font=get_font(11), anchor="rm")

    # Message 2 (Outgoing)
    draw_squircle(draw, (width - 480, 215, width - 30, 280), radius=16, fill=(43, 82, 120))
    draw.text((width - 460, 235), "Спасибо! Мы еще добавили WebRTC звонки прямо", fill=(255, 255, 255), font=f_cmsg)
    draw.text((width - 460, 255), "через WebSocket сигналинг в одном соединении 🚀", fill=(255, 255, 255), font=f_cmsg)
    draw.text((width - 55, 268), "17:38  ✓✓", fill=(140, 195, 240), font=get_font(11, bold=True), anchor="rm")

    # Message 3 (Incoming Voice Message)
    draw_squircle(draw, (sidebar_w + 30, 305, sidebar_w + 380, 375), radius=16, fill=(24, 37, 51), outline=(35, 52, 70))
    # Play circle
    draw.ellipse([sidebar_w + 45, 320, sidebar_w + 85, 360], fill=(42, 171, 238))
    draw.text((sidebar_w + 67, 340), "▶", fill=(255, 255, 255), font=get_font(14, bold=True), anchor="mm")
    # Waveform bars
    for bar_i in range(24):
        bh = 6 + (bar_i * 7 % 22)
        bx = sidebar_w + 100 + bar_i * 8
        bcol = (42, 171, 238) if bar_i < 10 else (70, 95, 120)
        draw.line([(bx, 340 - bh // 2), (bx, 340 + bh // 2)], fill=bcol, width=3)
    draw.text((sidebar_w + 305, 348), "0:19 / 0:42", fill=(130, 155, 180), font=get_font(11), anchor="lm")
    draw.text((sidebar_w + 365, 363), "17:40", fill=(120, 140, 160), font=get_font(11), anchor="rm")

    # Message 4 (Incoming with reaction)
    draw_squircle(draw, (sidebar_w + 30, 395, sidebar_w + 430, 460), radius=16, fill=(24, 37, 51), outline=(35, 52, 70))
    draw.text((sidebar_w + 48, 415), "Договорились, созваниваемся в 18:00! 📞", fill=(255, 255, 255), font=f_cmsg)
    draw.text((sidebar_w + 415, 448), "17:42", fill=(120, 140, 160), font=get_font(11), anchor="rm")
    # Reaction badge on message
    draw_squircle(draw, (sidebar_w + 45, 452, sidebar_w + 105, 476), radius=10, fill=(35, 55, 75), outline=(42, 171, 238, 150))
    draw.text((sidebar_w + 75, 464), "❤️ 2  👍 1", fill=(255, 255, 255), font=get_font(11), anchor="mm")

    # Bottom Input Bar
    draw.rectangle([(sidebar_w + 1, height - 70), (width, height)], fill=(23, 33, 43))
    draw.line([(sidebar_w + 1, height - 70), (width, height - 70)], fill=(32, 43, 54), width=1)

    # Paperclip, Emoji
    draw.text((sidebar_w + 30, height - 35), "📎", font=get_font(18), fill=(140, 160, 180), anchor="mm")
    
    # Input field
    input_box = (sidebar_w + 60, height - 58, width - 80, height - 12)
    draw_squircle(draw, input_box, radius=20, fill=(36, 47, 61))
    draw.text((sidebar_w + 80, height - 35), "Напишите сообщение...", fill=(120, 140, 160), font=f_cmsg, anchor="lm")
    draw.text((width - 105, height - 35), "😊", font=get_font(18), fill=(140, 160, 180), anchor="mm")

    # Send / Mic button
    draw.ellipse([width - 65, height - 58, width - 20, height - 13], fill=(42, 171, 238))
    draw.text((width - 42, height - 35), "➤", font=get_font(16, bold=True), fill=(255, 255, 255), anchor="mm")

    img.save("docs/screenshots/chat-list.png", "PNG")
    print("Chat list screenshot generated!")

# -------------------------------------------------------------------------
# 4. GENERATE ANIMATED GIF: REAL-TIME CHAT (docs/screenshots/chat.gif)
# -------------------------------------------------------------------------
def generate_chat_gif():
    print("Generating docs/screenshots/chat.gif (real-time chat animation)...")
    gw, gh = 850, 520
    frames = []

    # Sequence plan:
    # 0-5: Typing indicator bouncing
    # 6-11: Incoming message appears
    # 12-16: Outgoing message sent (single checkmark)
    # 17-23: Double checkmark + heart reaction pops up
    total_frames = 24

    for f_idx in range(total_frames):
        f_img = Image.new("RGB", (gw, gh), (14, 22, 33)) # #0e1621
        f_draw = ImageDraw.Draw(f_img)

        # Header
        f_draw.rectangle([(0, 0), (gw, 60)], fill=(23, 33, 43))
        f_draw.line([(0, 60), (gw, 60)], fill=(32, 43, 54), width=1)

        # Avatar
        f_draw.ellipse([20, 10, 60, 50], fill=(235, 87, 87))
        f_draw.text((40, 30), "А", fill=(255, 255, 255), font=get_font(17, bold=True), anchor="mm")
        f_draw.ellipse([50, 40, 60, 50], fill=(78, 205, 120), outline=(23, 33, 43), width=2)

        # Name & dynamic status
        f_draw.text((72, 22), "Анна Смирнова", fill=(255, 255, 255), font=get_font(15, bold=True), anchor="lm")
        
        if f_idx < 8:
            # Typing indicator status text
            f_draw.text((72, 42), "печатает...", fill=(42, 171, 238), font=get_font(12, bold=True), anchor="lm")
        else:
            f_draw.text((72, 42), "в сети", fill=(78, 205, 120), font=get_font(12), anchor="lm")

        # Call buttons in header
        draw_squircle(f_draw, (gw - 110, 14, gw - 70, 46), radius=10, fill=(36, 47, 61))
        f_draw.text((gw - 90, 30), "📞", font=get_font(14), fill=(255, 255, 255), anchor="mm")
        draw_squircle(f_draw, (gw - 60, 14, gw - 20, 46), radius=10, fill=(42, 171, 238))
        f_draw.text((gw - 40, 30), "📹", font=get_font(14), fill=(255, 255, 255), anchor="mm")

        # Message 1 (Static previous message)
        draw_squircle(f_draw, (30, 80, 520, 135), radius=14, fill=(24, 37, 51), outline=(35, 52, 70))
        f_draw.text((45, 96), "Привет! Готовы протестировать веб-сокеты и WebRTC?", fill=(255, 255, 255), font=get_font(13))
        f_draw.text((505, 123), "17:40", fill=(120, 140, 160), font=get_font(10), anchor="rm")

        # Typing Bubble (frames 0 to 7)
        if f_idx < 8:
            tb_w, tb_h = 90, 42
            draw_squircle(f_draw, (30, 155, 30 + tb_w, 155 + tb_h), radius=14, fill=(24, 37, 51), outline=(35, 52, 70))
            # 3 animated dots
            for dot_i in range(3):
                offset_sin = math.sin((f_idx * 0.8) + dot_i * 1.0)
                dot_y = 176 + int(offset_sin * 4)
                dot_x = 55 + dot_i * 18
                f_draw.ellipse([dot_x - 4, dot_y - 4, dot_x + 4, dot_y + 4], fill=(42, 171, 238))
        
        # Incoming Message pops in (from frame 8 onwards)
        if f_idx >= 8:
            draw_squircle(f_draw, (30, 155, 480, 215), radius=14, fill=(24, 37, 51), outline=(35, 52, 70))
            f_draw.text((45, 172), "Да! Запустила у себя, доставка сообщений < 5ms ⚡", fill=(255, 255, 255), font=get_font(13))
            f_draw.text((465, 203), "17:41", fill=(120, 140, 160), font=get_font(10), anchor="rm")

        # Outgoing Message sent (from frame 13 onwards)
        if f_idx >= 13:
            draw_squircle(f_draw, (gw - 460, 235, gw - 30, 295), radius=14, fill=(43, 82, 120))
            f_draw.text((gw - 445, 252), "Супер! Сейчас наберу по аудиосвязи через WebRTC 👍", fill=(255, 255, 255), font=get_font(13))
            
            # Checkmarks: single check for frames 13-17, double blue check for 18+
            if f_idx < 18:
                f_draw.text((gw - 45, 283), "17:42  ✓", fill=(180, 205, 230), font=get_font(11, bold=True), anchor="rm")
            else:
                f_draw.text((gw - 45, 283), "17:42  ✓✓", fill=(52, 183, 241), font=get_font(11, bold=True), anchor="rm")

        # Heart reaction pops up (frames 19 to 23)
        if f_idx >= 19:
            r_scale = min(1.0, (f_idx - 18) * 0.3)
            rw = int(50 * r_scale)
            rh = int(26 * r_scale)
            if rw > 10 and rh > 10:
                rx1 = gw - 80
                ry1 = 290
                draw_squircle(f_draw, (rx1, ry1, rx1 + rw, ry1 + rh), radius=8, fill=(30, 48, 68), outline=(52, 183, 241))
                f_draw.text((rx1 + rw // 2, ry1 + rh // 2), "❤️ 1", fill=(255, 255, 255), font=get_font(11, bold=True), anchor="mm")

        # Bottom Input Bar
        f_draw.rectangle([(0, gh - 65), (gw, gh)], fill=(23, 33, 43))
        f_draw.line([(0, gh - 65), (gw, gh - 65)], fill=(32, 43, 54), width=1)
        f_draw.text((25, gh - 32), "📎", font=get_font(16), fill=(140, 160, 180), anchor="mm")

        ibox = (50, gh - 52, gw - 65, gh - 12)
        draw_squircle(f_draw, ibox, radius=18, fill=(36, 47, 61))
        placeholder = "Напишите сообщение..." if f_idx < 11 else "Печатаем ответ..."
        f_draw.text((70, gh - 32), placeholder, fill=(110, 130, 150), font=get_font(13), anchor="lm")
        f_draw.text((gw - 85, gh - 32), "😊", font=get_font(16), fill=(140, 160, 180), anchor="mm")

        f_draw.ellipse([gw - 52, gh - 52, gw - 16, gh - 16], fill=(42, 171, 238))
        f_draw.text((gw - 34, gh - 32), "➤", font=get_font(14, bold=True), fill=(255, 255, 255), anchor="mm")

        frames.append(f_img)

    frames[0].save(
        "docs/screenshots/chat.gif",
        save_all=True,
        append_images=frames[1:],
        duration=220,
        loop=0,
        optimize=True
    )
    print("Chat GIF generated!")

# -------------------------------------------------------------------------
# 5. GENERATE ANIMATED GIF: AUDIO/VIDEO CALL (docs/screenshots/call.gif)
# -------------------------------------------------------------------------
def generate_call_gif():
    print("Generating docs/screenshots/call.gif (WebRTC call animation)...")
    gw, gh = 850, 520
    frames = []
    total_frames = 20

    for f_idx in range(total_frames):
        f_img = Image.new("RGB", (gw, gh), (14, 22, 33)) # Background
        f_draw = ImageDraw.Draw(f_img)

        # Blurred chat background simulation
        draw_squircle(f_draw, (40, 40, 480, 90), radius=12, fill=(20, 30, 40))
        draw_squircle(f_draw, (gw - 450, 110, gw - 40, 160), radius=12, fill=(30, 60, 85))

        # Translucent Dark Overlay for Modal
        overlay = Image.new("RGBA", (gw, gh), (10, 15, 25, 220))
        f_img.paste(overlay, (0, 0), overlay)
        f_draw = ImageDraw.Draw(f_img)

        # Call Modal Card
        mw, mh = 480, 450
        mx1 = (gw - mw) // 2
        my1 = (gh - mh) // 2
        mx2, my2 = mx1 + mw, my1 + mh

        draw_squircle(f_draw, (mx1, my1, mx2, my2), radius=28, fill=(23, 33, 43), outline=(45, 60, 75), width=1)

        # Top Badge: WebRTC P2P Status
        draw_squircle(f_draw, (gw // 2 - 110, my1 + 20, gw // 2 + 110, my1 + 46), radius=12, fill=(30, 45, 60), outline=(52, 183, 241, 100))
        f_draw.text((gw // 2, my1 + 33), "🔒 WebRTC P2P • Зашифровано", fill=(52, 183, 241), font=get_font(11, bold=True), anchor="mm")

        # Pulsing Sound Wave Concentric Rings
        center_x = gw // 2
        center_y = my1 + 155
        pulse = (f_idx % 10) / 10.0

        for ring_i in range(3):
            ring_r = int(65 + ring_i * 25 + pulse * 18)
            ring_alpha = max(0, int(90 - ring_i * 25 - pulse * 40))
            ring_layer = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
            r_draw = ImageDraw.Draw(ring_layer)
            r_draw.ellipse(
                [center_x - ring_r, center_y - ring_r, center_x + ring_r, center_y + ring_r],
                outline=(52, 183, 241, ring_alpha),
                width=2
            )
            f_img.paste(ring_layer, (0, 0), ring_layer)
            f_draw = ImageDraw.Draw(f_img)

        # Avatar Center
        av_radius = 55
        f_draw.ellipse([center_x - av_radius, center_y - av_radius, center_x + av_radius, center_y + av_radius], fill=(235, 87, 87))
        f_draw.text((center_x, center_y), "А", fill=(255, 255, 255), font=get_font(42, bold=True), anchor="mm")

        # Caller Name
        f_draw.text((center_x, my1 + 240), "Анна Смирнова", fill=(255, 255, 255), font=get_font(20, bold=True), anchor="mt")

        # Timer counter
        seconds = 14 + (f_idx // 3)
        time_str = f"00:{seconds:02d}"
        f_draw.text((center_x, my1 + 272), f"Идёт разговор • {time_str}", fill=(78, 205, 120), font=get_font(14, bold=True), anchor="mt")

        # Live Dynamic Audio Waveform in call
        for bar_idx in range(16):
            b_height = int(6 + 18 * abs(math.sin(f_idx * 0.6 + bar_idx * 0.5)))
            bx = center_x - 80 + bar_idx * 10
            by = my1 + 315
            f_draw.line([(bx, by - b_height // 2), (bx, by + b_height // 2)], fill=(52, 183, 241), width=3)

        # Action Buttons at Bottom
        btn_y = my1 + 380
        btn_radius = 26

        # Button 1: Mic
        bx1 = center_x - 110
        f_draw.ellipse([bx1 - btn_radius, btn_y - btn_radius, bx1 + btn_radius, btn_y + btn_radius], fill=(36, 47, 61))
        f_draw.text((bx1, btn_y), "🎤", font=get_font(18), fill=(255, 255, 255), anchor="mm")

        # Button 2: Video Cam
        bx2 = center_x - 40
        f_draw.ellipse([bx2 - btn_radius, btn_y - btn_radius, bx2 + btn_radius, btn_y + btn_radius], fill=(36, 47, 61))
        f_draw.text((bx2, btn_y), "📹", font=get_font(18), fill=(255, 255, 255), anchor="mm")

        # Button 3: Speaker / Share
        bx3 = center_x + 30
        f_draw.ellipse([bx3 - btn_radius, btn_y - btn_radius, bx3 + btn_radius, btn_y + btn_radius], fill=(36, 47, 61))
        f_draw.text((bx3, btn_y), "🔊", font=get_font(18), fill=(255, 255, 255), anchor="mm")

        # Button 4: End Call (Red)
        bx4 = center_x + 105
        f_draw.ellipse([bx4 - btn_radius, btn_y - btn_radius, bx4 + btn_radius, btn_y + btn_radius], fill=(235, 87, 87))
        f_draw.text((bx4, btn_y), "📵", font=get_font(18), fill=(255, 255, 255), anchor="mm")

        frames.append(f_img)

    frames[0].save(
        "docs/screenshots/call.gif",
        save_all=True,
        append_images=frames[1:],
        duration=200,
        loop=0,
        optimize=True
    )
    print("Call GIF generated!")

if __name__ == "__main__":
    generate_logos()
    generate_login_screenshot()
    generate_chat_list_screenshot()
    generate_chat_gif()
    generate_call_gif()
    print("All assets successfully generated!")
