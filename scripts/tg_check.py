# -*- coding: utf-8 -*-
"""Probe القطيف اليوم Telegram public preview: scrapability + 'صفوى: ... ذمة الله' pattern."""
import re, sys, io, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

raw = open(r"C:\Users\Hussain\Downloads\tg_qatif.html", encoding="utf-8", errors="replace").read()

# message text containers + their post id
blocks = re.findall(r'data-post="([^"]+)".*?<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', raw, re.S)

def clean(t):
    t = t.replace("<br/>", "\n").replace("<br>", "\n")
    t = re.sub(r"<[^>]+>", "", t)
    return H.unescape(t).strip()

msgs = [(pid, clean(t)) for pid, t in blocks]
print("total messages parsed:", len(msgs))
safwa = [(p, m) for p, m in msgs if m[:12].find("صفوى") != -1]
death = [(p, m) for p, m in msgs if "ذمة الله" in m]
both = [(p, m) for p, m in msgs if m[:12].find("صفوى") != -1 and "ذمة الله" in m]
print("start-with-صفوى:", len(safwa), "| contain-ذمة-الله:", len(death), "| BOTH:", len(both))
print("\n--- 3 sample raw messages ---")
for p, m in msgs[:3]:
    print(p, "|", repr(m[:130]))
print("\n--- صفوى + ذمة الله matches ---")
for p, m in both[:8]:
    print(p, "|", m[:170].replace("\n", " / "))
