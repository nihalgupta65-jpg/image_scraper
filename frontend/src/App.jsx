import { useState, useCallback } from "react";

// const API = "http://localhost:8000";
const API = import.meta.env.VITE_API_URL;

const formatBytes = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const sourceTag = (source) => {
  const colors = {
    img_tag: "#00ff88",
    css: "#ff6b35",
    meta: "#7c6fff",
    srcset: "#ffd700",
  };
  return (
    <span style={{
      fontSize: "10px", fontFamily: "monospace",
      background: colors[source] || "#555",
      color: "#000", padding: "2px 6px", borderRadius: "3px",
      fontWeight: 700, letterSpacing: "0.05em"
    }}>
      {source?.toUpperCase()}
    </span>
  );
};

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [pageTitle, setPageTitle] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState("grid"); // grid | list

  const scrape = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setImages([]);
    setSelected(new Set());
    setPageTitle("");
    try {
      const res = await fetch(`${API}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to scrape");
      }
      const data = await res.json();
      setImages(data.images);
      setPageTitle(data.page_title);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (imgUrl) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(imgUrl) ? next.delete(imgUrl) : next.add(imgUrl);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filteredImages.map(i => i.url)));
  const deselectAll = () => setSelected(new Set());

  const downloadZip = async () => {
    if (!selected.size) return;
    setDownloading(true);
    try {
      const res = await fetch(`${API}/download-zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [...selected], page_url: url }),
      });
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "scraped_images.zip";
      link.click();
    } catch (e) {
      setError("Download failed: " + e.message);
    } finally {
      setDownloading(false);
    }
  };

  const filteredImages = images.filter(img =>
    !filter || img.url.toLowerCase().includes(filter.toLowerCase()) || img.alt?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#e8e8e8",
      fontFamily: "'Courier New', monospace",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #222",
        padding: "20px 32px",
        display: "flex", alignItems: "center", gap: "16px",
        background: "#0d0d0d",
      }}>
        <div style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "0.1em", color: "#00ff88" }}>
          ⬡ IMGSCRAPE
        </div>
        <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.15em" }}>
          WEB IMAGE EXTRACTOR v1.0
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {/* URL Input */}
        <div style={{
          border: "1px solid #2a2a2a",
          borderRadius: "6px",
          background: "#111",
          padding: "24px",
          marginBottom: "24px",
        }}>
          <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.2em", marginBottom: "12px" }}>
            TARGET URL
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && scrape()}
              placeholder="https://example.com"
              style={{
                flex: 1, background: "#0a0a0a", border: "1px solid #333",
                borderRadius: "4px", color: "#00ff88", padding: "12px 16px",
                fontFamily: "inherit", fontSize: "14px", outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = "#00ff88"}
              onBlur={e => e.target.style.borderColor = "#333"}
            />
            <button
              onClick={scrape}
              disabled={loading || !url.trim()}
              style={{
                background: loading ? "#1a3a2a" : "#00ff88",
                color: "#000", border: "none", borderRadius: "4px",
                padding: "12px 28px", fontFamily: "inherit", fontWeight: 900,
                fontSize: "13px", letterSpacing: "0.1em", cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s", minWidth: "120px",
              }}
            >
              {loading ? "SCANNING..." : "EXTRACT"}
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: "12px", padding: "10px 14px", background: "#200",
              border: "1px solid #500", borderRadius: "4px",
              color: "#ff4444", fontSize: "13px",
            }}>
              ✗ {error}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px", color: "#555" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px", animation: "spin 1s linear infinite", display: "inline-block" }}>⬡</div>
            <div style={{ fontSize: "13px", letterSpacing: "0.2em", color: "#00ff88" }}>SCANNING PAGE FOR IMAGES...</div>
            <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
          </div>
        )}

        {/* Results */}
        {images.length > 0 && !loading && (
          <>
            {/* Stats bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: "16px",
              marginBottom: "16px", flexWrap: "wrap",
            }}>
              <div style={{ fontSize: "13px", color: "#555" }}>
                <span style={{ color: "#00ff88", fontWeight: 700 }}>{images.length}</span> images found
                {pageTitle && <span style={{ color: "#444" }}> on <span style={{ color: "#aaa" }}>{pageTitle}</span></span>}
              </div>
              <div style={{ flex: 1 }} />

              {/* Filter */}
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="filter images..."
                style={{
                  background: "#111", border: "1px solid #2a2a2a", borderRadius: "4px",
                  color: "#aaa", padding: "6px 12px", fontFamily: "inherit",
                  fontSize: "12px", outline: "none", width: "180px",
                }}
              />

              {/* View toggle */}
              <div style={{ display: "flex", gap: "4px" }}>
                {["grid", "list"].map(v => (
                  <button key={v} onClick={() => setView(v)} style={{
                    background: view === v ? "#1a1a1a" : "transparent",
                    border: `1px solid ${view === v ? "#333" : "#222"}`,
                    color: view === v ? "#00ff88" : "#555",
                    padding: "6px 10px", borderRadius: "4px", cursor: "pointer",
                    fontFamily: "inherit", fontSize: "11px", letterSpacing: "0.1em",
                  }}>{v === "grid" ? "⊞" : "≡"} {v.toUpperCase()}</button>
                ))}
              </div>

              {/* Select controls */}
              <button onClick={selectAll} style={btnStyle("#222", "#aaa")}>SELECT ALL</button>
              <button onClick={deselectAll} style={btnStyle("#222", "#aaa")}>CLEAR</button>

              {/* Download */}
              <button
                onClick={downloadZip}
                disabled={!selected.size || downloading}
                style={{
                  ...btnStyle(selected.size ? "#00ff88" : "#1a1a1a", selected.size ? "#000" : "#555"),
                  fontWeight: 900, minWidth: "140px",
                }}
              >
                {downloading ? "ZIPPING..." : `⬇ DOWNLOAD (${selected.size})`}
              </button>
            </div>

            {/* Source legend */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {["img_tag", "srcset", "css", "meta"].map(s => <span key={s}>{sourceTag(s)}</span>)}
              <span style={{ fontSize: "11px", color: "#444", alignSelf: "center" }}>— image source</span>
            </div>

            {/* Image grid */}
            {view === "grid" ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "12px",
              }}>
                {filteredImages.map(img => (
                  <div
                    key={img.url}
                    onClick={() => toggleSelect(img.url)}
                    style={{
                      border: `2px solid ${selected.has(img.url) ? "#00ff88" : "#1e1e1e"}`,
                      borderRadius: "6px", overflow: "hidden", cursor: "pointer",
                      background: "#111", transition: "all 0.15s",
                      position: "relative",
                    }}
                  >
                    {selected.has(img.url) && (
                      <div style={{
                        position: "absolute", top: "8px", right: "8px",
                        background: "#00ff88", color: "#000", borderRadius: "50%",
                        width: "20px", height: "20px", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: "12px", fontWeight: 900, zIndex: 2,
                      }}>✓</div>
                    )}
                    <div style={{ height: "140px", overflow: "hidden", background: "#0a0a0a" }}>
                      <img
                        src={img.url} alt={img.alt}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={e => { e.target.style.display = "none"; e.target.parentNode.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#333;font-size:11px">NO PREVIEW</div>'; }}
                      />
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        {sourceTag(img.source)}
                        <span style={{ fontSize: "10px", color: "#555" }}>{formatBytes(img.size_bytes)}</span>
                      </div>
                      <div style={{
                        fontSize: "10px", color: "#444", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                        title: img.url,
                      }}>
                        {img.url.split("/").pop() || img.url}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {filteredImages.map(img => (
                  <div
                    key={img.url}
                    onClick={() => toggleSelect(img.url)}
                    style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 14px", borderRadius: "4px", cursor: "pointer",
                      border: `1px solid ${selected.has(img.url) ? "#00ff88" : "#1e1e1e"}`,
                      background: selected.has(img.url) ? "#0d1f14" : "#0f0f0f",
                      transition: "all 0.1s",
                    }}
                  >
                    <div style={{
                      width: "18px", height: "18px", borderRadius: "3px",
                      border: `2px solid ${selected.has(img.url) ? "#00ff88" : "#333"}`,
                      background: selected.has(img.url) ? "#00ff88" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", color: "#000", flexShrink: 0,
                    }}>{selected.has(img.url) ? "✓" : ""}</div>
                    <img
                      src={img.url} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "3px", flexShrink: 0 }}
                      onError={e => { e.target.style.background = "#1a1a1a"; e.target.src = ""; }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {img.url}
                      </div>
                      {img.alt && <div style={{ fontSize: "11px", color: "#555" }}>{img.alt}</div>}
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                      {sourceTag(img.source)}
                      <span style={{ fontSize: "11px", color: "#555", minWidth: "60px", textAlign: "right" }}>{formatBytes(img.size_bytes)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && images.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#2a2a2a" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⬡</div>
            <div style={{ fontSize: "13px", letterSpacing: "0.2em" }}>ENTER A URL TO BEGIN EXTRACTION</div>
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = (bg, color) => ({
  background: bg, color, border: `1px solid ${bg === "transparent" ? "#222" : bg}`,
  borderRadius: "4px", padding: "6px 12px", fontFamily: "'Courier New', monospace",
  fontSize: "11px", letterSpacing: "0.08em", cursor: "pointer",
});
