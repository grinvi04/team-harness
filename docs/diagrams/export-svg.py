#!/usr/bin/env python3
"""Extract static SVG from Archify HTML without executing it."""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def export(source, destination):
    html = Path(source).read_text(encoding="utf-8")
    styles = re.findall(r"<style\b[^>]*>(.*?)</style>", html, re.S)
    svg_text = re.search(r"<svg\b.*?</svg>", html, re.S).group(0)
    css = styles[1]
    theme = re.search(r'\[data-theme="light"\]\s*\{([^}]+)\}', css).group(1)
    variables = dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", theme))

    def resolve(match):
        return variables[match.group(1)].strip()

    semantic = []
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    for selector, declarations in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        selector = selector.strip()
        if re.match(r"^\.(?:[ctam]-|semantic-sigil|sigil-|s-)", selector):
            declarations = re.sub(r"var\((--[\w-]+)\)", resolve, declarations)
            semantic.append(selector + " {" + declarations + "}")

    svg = ET.fromstring(svg_text)
    svg.set("xmlns", "http://www.w3.org/2000/svg")
    svg.set("lang", "ko")
    _, _, width, height = svg.get("viewBox").split()
    svg.set("width", width)
    svg.set("height", height)
    for element in svg.iter():
        for key in list(element.attrib):
            if key.startswith("data-") or key.startswith("on") or key == "tabindex":
                del element.attrib[key]
        if "style" in element.attrib:
            element.set("style", re.sub(r"var\((--[\w-]+)\)", resolve, element.get("style")))
    for text in svg.iter("text"):
        size = text.get("font-size")
        if text.get("class") == "t-primary" and size == "11":
            text.set("font-size", "14")
        elif text.get("class") == "t-muted" and size == "9":
            text.set("font-size", "11")
        elif size == "7" and not text.get("class", "").startswith("t-edge"):
            text.set("font-size", "9")
    svg.find("desc").text = "실행 플랫폼, 로컬 Harness 검사·PR 래퍼, GitHub CI·리뷰·브랜치 보호의 관계."
    style = ET.Element("style")
    style.text = styles[0] + "\nsvg {font-family: 'JetBrains Mono', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', sans-serif;}\n" + "\n".join(semantic)
    svg.insert(2, style)
    svg.insert(3, ET.Element("rect", {"width": width, "height": height, "fill": variables["--bg"].strip()}))
    Path(destination).write_text(ET.tostring(svg, encoding="unicode") + "\n", encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: export-svg.py <archify.html> <output.svg>")
    export(sys.argv[1], sys.argv[2])
