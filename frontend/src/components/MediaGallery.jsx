import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Play, Download } from "lucide-react";
import "./MediaGallery.css";

export default function MediaGallery({ media = [], layout = "single" }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!media || media.length === 0) return null;

  const current = media[currentIndex];
  const isImage = current?.type?.startsWith("image/");
  const isAudio = current?.type?.startsWith("audio/");
  const isVideo = current?.type?.startsWith("video/");

  const next = () => setCurrentIndex((i) => (i + 1) % media.length);
  const prev = () => setCurrentIndex((i) => (i - 1 + media.length) % media.length);

  if (layout === "grid" && media.length > 1) {
    return (
      <div className="media-grid">
        {media.map((item, idx) => (
          <div key={idx} className="media-grid-item" onClick={() => setCurrentIndex(idx)}>
            {isImage ? (
              <img src={item.url} alt={item.filename} className="media-grid-img" />
            ) : isAudio ? (
              <div className="media-grid-placeholder audio">
                <span className="text-sm">🎵 Audio</span>
                <span className="text-xs">{item.filename}</span>
              </div>
            ) : isVideo ? (
              <div className="media-grid-placeholder video">
                <Play className="h-8 w-8" />
                <span className="text-xs">{item.filename}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`media-container layout-${layout}`}>
      <div className="media-viewer">
        {isImage && <img src={current.url} alt={current.filename} className="media-img" />}
        {isAudio && (
          <div className="media-audio">
            <audio controls className="w-full">
              <source src={current.url} type={current.type} />
              Your browser does not support audio playback.
            </audio>
          </div>
        )}
        {isVideo && (
          <video controls className="media-video" poster={current.poster}>
            <source src={current.url} type={current.type} />
            Your browser does not support video playback.
          </video>
        )}

        {media.length > 1 && (
          <>
            <button onClick={prev} className="media-nav prev">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={next} className="media-nav next">
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="media-indicator">
              {currentIndex + 1} / {media.length}
            </div>
          </>
        )}
      </div>

      {media.length > 1 && (
        <div className="media-thumbs">
          {media.map((item, idx) => (
            <button
              key={idx}
              className={`thumb ${idx === currentIndex ? "active" : ""}`}
              onClick={() => setCurrentIndex(idx)}
            >
              {item.type?.startsWith("image/") && <img src={item.url} alt="" />}
              {!item.type?.startsWith("image/") && <span className="text-xs">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
