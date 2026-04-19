# ⬡ IMGSCRAPE — Web Image Extractor

A full-stack web image scraper with a sleek dark terminal UI.
Paste any URL → extract all images → select & download as ZIP.

---

## Features

- Extracts images from `<img>` tags, `srcset`, CSS backgrounds, Open Graph/meta tags
- Grid & list view modes
- Select individual images or bulk select all
- Download selected images as a single ZIP file
- Shows image source type (img_tag / srcset / css / meta)
- Shows file size for each image
- Filter images by URL or alt text

---

## Setup

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API will be running at: http://localhost:8000

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

UI will be running at: http://localhost:3000

---

## API Endpoints

### POST /scrape
Scrapes a URL and returns all found images.

```json
Request:  { "url": "https://example.com" }
Response: { "images": [...], "total": 42, "page_title": "Example" }
```

### POST /download-zip
Downloads selected images and returns them as a ZIP file.

```json
Request: { "urls": ["https://..."], "page_url": "https://example.com" }
Response: ZIP file stream
```

---

## Tech Stack

| Layer    | Tech                       |
|----------|----------------------------|
| Backend  | Python, FastAPI, httpx, BeautifulSoup4 |
| Frontend | React 18, Vite             |
| Scraping | Multi-source image detection (img/srcset/css/meta) |
| Download | Server-side ZIP generation |

---

## Notes

- Scraping respects public pages only; pages requiring login won't work
- Backend fetches pages with a browser-like User-Agent to avoid basic blocks
- First 50 images get HEAD-checked for file size; rest assumed to be images
- ZIP filenames are auto-numbered with correct extensions
