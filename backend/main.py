from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import io
import zipfile
import asyncio
import re

app = FastAPI(title="Image Scraper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
}

class ScrapeRequest(BaseModel):
    url: str
    min_width: int = 0
    min_height: int = 0

class DownloadRequest(BaseModel):
    urls: list[str]
    page_url: str

def extract_images(html: str, base_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    images = []
    seen = set()

    # <img> tags
    for img in soup.find_all("img"):
        for attr in ["src", "data-src", "data-lazy-src", "data-original"]:
            src = img.get(attr)
            if src:
                full = urljoin(base_url, src)
                if full not in seen and full.startswith("http"):
                    seen.add(full)
                    alt = img.get("alt", "")
                    images.append({
                        "url": full,
                        "alt": alt,
                        "width": img.get("width"),
                        "height": img.get("height"),
                        "source": "img_tag"
                    })
                break

    # CSS background images
    style_tags = soup.find_all("style")
    for style in style_tags:
        urls = re.findall(r'url\(["\']?(https?://[^"\')\s]+)["\']?\)', style.string or "")
        for u in urls:
            if u not in seen:
                seen.add(u)
                images.append({"url": u, "alt": "", "width": None, "height": None, "source": "css"})

    # Open Graph / meta images
    for meta in soup.find_all("meta"):
        if meta.get("property") in ["og:image", "twitter:image"] or meta.get("name") in ["og:image", "twitter:image"]:
            content = meta.get("content", "")
            if content and content not in seen and content.startswith("http"):
                seen.add(content)
                images.append({"url": content, "alt": "og/meta image", "width": None, "height": None, "source": "meta"})

    # srcset
    for img in soup.find_all(["img", "source"]):
        srcset = img.get("srcset", "")
        for part in srcset.split(","):
            part = part.strip().split(" ")[0]
            if part:
                full = urljoin(base_url, part)
                if full not in seen and full.startswith("http"):
                    seen.add(full)
                    images.append({"url": full, "alt": "", "width": None, "height": None, "source": "srcset"})

    return images

@app.post("/scrape")
async def scrape(req: ScrapeRequest):
    try:
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=20) as client:
            resp = await client.get(req.url)
            resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")

    images = extract_images(resp.text, req.url)

    # Fetch image dimensions if not present
    async def fetch_meta(img):
        try:
            async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=10) as client:
                r = await client.head(img["url"])
                content_type = r.headers.get("content-type", "")
                content_length = r.headers.get("content-length", 0)
                img["content_type"] = content_type
                img["size_bytes"] = int(content_length) if content_length else 0
                img["is_image"] = "image" in content_type
        except:
            img["content_type"] = "unknown"
            img["size_bytes"] = 0
            img["is_image"] = True  # assume image if we can't check
        return img

    tasks = [fetch_meta(img) for img in images[:50]]  # limit to 50 for speed
    enriched = await asyncio.gather(*tasks)

    result = [img for img in enriched if img.get("is_image", True)]
    return {"images": result, "total": len(result), "page_title": _get_title(resp.text)}

def _get_title(html):
    soup = BeautifulSoup(html, "html.parser")
    t = soup.find("title")
    return t.text.strip() if t else "Untitled"

@app.post("/download-zip")
async def download_zip(req: DownloadRequest):
    zip_buffer = io.BytesIO()

    async def fetch_image(url):
        try:
            async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=15) as client:
                r = await client.get(url)
                r.raise_for_status()
                return url, r.content, r.headers.get("content-type", "")
        except:
            return url, None, ""

    tasks = [fetch_image(url) for url in req.urls]
    results = await asyncio.gather(*tasks)

    ext_map = {
        "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif",
        "image/webp": ".webp", "image/svg+xml": ".svg", "image/bmp": ".bmp"
    }

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, (url, content, ct) in enumerate(results):
            if content:
                ext = ext_map.get(ct.split(";")[0].strip(), "")
                if not ext:
                    parsed = urlparse(url)
                    path_ext = parsed.path.rsplit(".", 1)[-1].lower()
                    ext = f".{path_ext}" if path_ext in ["jpg","jpeg","png","gif","webp","svg","bmp"] else ".img"
                zf.writestr(f"image_{i+1:03d}{ext}", content)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=scraped_images.zip"}
    )
