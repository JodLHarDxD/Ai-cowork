import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import "./PreloaderScreen.css";

export interface PreloaderScreenProps {
  images: string[];
  onComplete: () => void;
  onAudioInit?: (muted: boolean) => void;
  wordmark?: string;
  title?: string;
  subtitle?: string;
  logoComponent?: React.ReactNode;
}

/**
 * Shared Preloader Screen:
 * 1. Fans in editorial cards from center.
 * 2. Ticks counter 000 -> 100 with dynamic typography.
 * 3. Halts on 100 to present a beautiful, minimalist "Acoustic Permission" sensory overlay.
 * 4. Animates exit upon user choice.
 */
export function PreloaderScreen({
  images,
  onComplete,
  onAudioInit,
  wordmark = "sarta",
  title = "EXPERIENCE THIS SHOWCASE WITH ATMOSPHERIC SOUND?",
  subtitle = "Acoustic Laboratory",
  logoComponent,
}: PreloaderScreenProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const imagesLayerRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  
  const [showChoice, setShowChoice] = useState(false);

  useEffect(() => {
    const overlay = overlayRef.current;
    const imagesLayer = imagesLayerRef.current;
    const wordmarkEl = wordmarkRef.current;
    const counter = counterRef.current;
    if (!overlay || !imagesLayer || !wordmarkEl || !counter) return;

    const imgEls = Array.from(
      imagesLayer.querySelectorAll<HTMLImageElement>(".preloader__image"),
    );
    const imgs = imgEls as HTMLElement[];

    document.documentElement.style.overflow = "hidden";
    window.scrollTo(0, 0);

    gsap.set(imgs, { scale: 0, rotate: 0, willChange: "transform" });
    gsap.set(wordmarkEl, { yPercent: 110, opacity: 0 });
    gsap.set(counter, { opacity: 1, yPercent: 0 });

    const intro = gsap.timeline({
      paused: true,
      defaults: { duration: 0.75, ease: "power3.out", force3D: true },
      onStart: () => {
        imagesLayer.classList.remove("is-hidden");
        wordmarkEl.classList.remove("is-hidden");
      },
    });

    intro
      .to(imgs, {
        scale: 1,
        rotate: () => gsap.utils.random(-15, 15),
        stagger: { each: 0.15, from: "center" },
      })
      .to(
        wordmarkEl,
        { yPercent: 0, opacity: 1, duration: 0.8, ease: "expo.out" },
        "<0.2",
      );

    const main = gsap.timeline({
      paused: true,
      defaults: { force3D: true },
    });

    main
      .call(() => intro.play())
      .to(
        counter,
        {
          duration: 2.8,
          innerText: 100,
          modifiers: {
            innerText: (v: string | number) => String(Math.round(Number(v))).padStart(3, "0"),
          },
          ease: "power2.inOut",
          snap: { innerText: 1 },
        },
        0,
      )
      .to(counter, {
        yPercent: -100,
        opacity: 0,
        duration: 0.6,
        ease: "power2.inOut",
        onComplete: () => {
          setShowChoice(true);
        }
      }, "<92%");

    let cancelled = false;
    Promise.all(
      imgEls.map((img) =>
        img.complete
          ? Promise.resolve()
          : img.decode().catch(() => {}),
      ),
    ).then(() => {
      if (!cancelled) main.play();
    });

    return () => {
      cancelled = true;
      main.kill();
      intro.kill();
      document.documentElement.style.overflow = "";
    };
  }, [images]);

  const handleChoice = (muted: boolean) => {
    if (onAudioInit) {
      onAudioInit(muted);
    }

    const overlay = overlayRef.current;
    const imagesLayer = imagesLayerRef.current;
    const wordmarkEl = wordmarkRef.current;
    const choiceEl = document.querySelector(".preloader__choice-wrap");
    if (!overlay || !imagesLayer || !wordmarkEl || !choiceEl) return;

    const imgs = gsap.utils.toArray<HTMLElement>(
      imagesLayer.querySelectorAll(".preloader__image"),
    );

    const exitTl = gsap.timeline({
      onComplete: () => {
        document.documentElement.classList.add("loaded");
        document.documentElement.style.overflow = "";
        onComplete();
      },
    });

    exitTl
      .to(choiceEl, {
        opacity: 0,
        y: -24,
        duration: 0.5,
        ease: "power2.inOut",
      })
      .to(
        wordmarkEl,
        { yPercent: -120, opacity: 0, duration: 0.8, ease: "expo.inOut" },
        "<0.1",
      )
      .to(
        imgs,
        {
          scale: 0,
          rotate: () => gsap.utils.random(-15, 15),
          duration: 0.65,
          ease: "expo.inOut",
          stagger: { each: 0.05, from: "end" },
        },
        "<",
      )
      .to(
        overlay,
        {
          clipPath: "inset(0% 0% 100% 0%)",
          duration: 1.2,
          ease: "power3.inOut",
        },
        "<0.2",
      );
  };

  return (
    <div ref={overlayRef} className="preloader" aria-hidden="true">
      <div className="preloader__inner">
        <div ref={imagesLayerRef} className="preloader__images is-hidden">
          {images.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              className="preloader__image"
              loading="eager"
              decoding="sync"
              fetchPriority="high"
              style={{ zIndex: index }}
            />
          ))}
        </div>

        <div className="preloader__wordmark-wrap">
          {logoComponent ? (
            <span ref={wordmarkRef} className="preloader__wordmark is-hidden">
              {logoComponent}
            </span>
          ) : (
            <span ref={wordmarkRef} className="preloader__wordmark is-hidden">
              {wordmark}
            </span>
          )}
        </div>

        <div className="preloader__interaction">
          {!showChoice ? (
            <div className="preloader__counter-wrap">
              <span ref={counterRef} className="preloader__counter">
                000
              </span>
            </div>
          ) : (
            <div className="preloader__choice-wrap page-enter">
              <p className="preloader__choice-eyebrow">{subtitle}</p>
              <h2 className="preloader__choice-title">{title}</h2>
              <div className="preloader__choice-actions">
                <button
                  type="button"
                  className="btn btn--cream"
                  onClick={() => handleChoice(false)}
                  data-cursor="sound"
                >
                  Enter with Sound
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => handleChoice(true)}
                >
                  Enter Muted
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
