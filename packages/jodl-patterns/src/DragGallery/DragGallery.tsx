import React, { useEffect, useRef, useState } from "react";
import "./DragGallery.css";

export interface DragGalleryItem {
  title: string;
  subtitle?: string;
  src: string;
  video?: string;
  [key: string]: any;
}

export interface DragGalleryProps {
  items: DragGalleryItem[];
  title?: string;
  subtitle?: string;
  hint?: string;
}

/** Luxury horizontal drag-to-explore gallery with hover autoplay videos & horizontal wheel scroll support */
export function DragGallery({
  items,
  title = "Drag to explore",
  subtitle = "Collections",
  hint = "Pull the rail — inspired by tactile catalog browsing.",
}: DragGalleryProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [hoveredTitle, setHoveredTitle] = useState<string | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onDown = (clientX: number) => {
      isDragging.current = true;
      startX.current = clientX;
      scrollLeft.current = track.scrollLeft;
      track.classList.add("is-dragging");
    };

    const onMove = (clientX: number) => {
      if (!isDragging.current) return;
      const walk = (clientX - startX.current) * 1.2;
      track.scrollLeft = scrollLeft.current - walk;
    };

    const onUp = () => {
      isDragging.current = false;
      track.classList.remove("is-dragging");
    };

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        track.scrollLeft += e.deltaY * 0.85;
      }
    };

    const mouseDown = (e: MouseEvent) => onDown(e.pageX);
    const mouseMove = (e: MouseEvent) => onMove(e.pageX);
    const touchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) onDown(touch.pageX);
    };
    const touchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) onMove(touch.pageX);
    };

    track.addEventListener("mousedown", mouseDown);
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", onUp);
    track.addEventListener("touchstart", touchStart, { passive: true });
    track.addEventListener("touchmove", touchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    track.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      track.removeEventListener("mousedown", mouseDown);
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", onUp);
      track.removeEventListener("touchstart", touchStart);
      track.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", onUp);
      track.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <section className="drag-gallery">
      <div className="container drag-gallery__head">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2 className="display drag-gallery__title">
            {title}
          </h2>
        </div>
        <p className="drag-gallery__hint">
          {hint}
        </p>
      </div>
      <div ref={trackRef} className="drag-gallery__track">
        {items.map((item) => (
          <article
            key={item.title}
            className="drag-gallery__card"
            onMouseEnter={() => setHoveredTitle(item.title)}
            onMouseLeave={() => setHoveredTitle(null)}
          >
            <div className="drag-gallery__media-wrap">
              <img src={item.src} alt={item.title} loading="lazy" />
              {item.video && (
                <video
                  src={item.video}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ opacity: hoveredTitle === item.title ? 1 : 0 }}
                />
              )}
            </div>
            <div>
              {item.subtitle && <p className="eyebrow">{item.subtitle}</p>}
              <h3>{item.title}</h3>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
