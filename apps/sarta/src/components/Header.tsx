import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { sartaAudio } from "./AudioManager";
import "./Header.css";

const categoryTabs = [
  { to: "/shop?category=women", label: "Woman" },
  { to: "/shop?category=men", label: "Man" },
  { to: "/shop?category=new", label: "New" },
  { to: "/shop?category=bags", label: "Bags" },
  { to: "/shop?category=accessories", label: "Accessories" },
];

type MenuLink = { label: string; to: string };

const menuSections: { number: string; title: string; links: MenuLink[] }[] = [
  {
    number: "01",
    title: "New In",
    links: [
      { label: "Evening gowns", to: "/shop?category=new" },
      { label: "Summer tailoring", to: "/shop?category=new" },
      { label: "Fresh accessories", to: "/shop?category=accessories" },
      { label: "Atelier icons", to: "/shop?category=new" },
    ],
  },
  {
    number: "02",
    title: "Trends",
    links: [
      { label: "Monogram edit", to: "/shop?category=women" },
      { label: "Sculptural black", to: "/shop" },
      { label: "Red ceremony", to: "/shop?category=women" },
      { label: "Gold hour", to: "/shop?category=accessories" },
    ],
  },
  {
    number: "03",
    title: "Collection",
    links: [
      { label: "Women", to: "/shop?category=women" },
      { label: "Men", to: "/shop?category=men" },
      { label: "Bags", to: "/shop?category=bags" },
      { label: "Accessories", to: "/shop?category=accessories" },
    ],
  },
];

const editorialImages = [
  "/media/campaign-equestrian/images/editorial-white-sculptural.png",
  "/products/women/dress-06.jpg",
  "/media/campaign-equestrian/images/editorial-gold-jewelry.jpg",
];

export function Header() {
  const { count, openCart } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    setIsMuted(sartaAudio.isMuted());

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setIsMuted(sartaAudio.isMuted());
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.classList.toggle("has-menu-open", menuOpen);

    return () => document.body.classList.remove("has-menu-open");
  }, [menuOpen]);

  const toggleSound = () => {
    const nextMuted = !isMuted;
    sartaAudio.setMuted(nextMuted);
    setIsMuted(nextMuted);
  };

  return (
    <header className={`site-header ${scrolled || menuOpen ? "is-scrolled" : ""}`}>
      <div className="site-header__bar">
        <button
          type="button"
          className={`site-header__menu ${menuOpen ? "is-open" : ""}`}
          aria-expanded={menuOpen}
          aria-controls="site-mega-menu"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span className="site-header__menu-label">Menu</span>
          <span className="site-header__menu-lines" aria-hidden="true">
            <span />
            <span />
          </span>
        </button>

        <Link to="/" className="site-header__logo" aria-label="SARTA home">
          SARTA
        </Link>

        <div className="site-header__actions">
          <Link to="/shop" className="site-header__search">
            Search
          </Link>
          <button
            type="button"
            className="site-header__bag"
            onClick={openCart}
            aria-label={`Open bag, ${count} items`}
          >
            Bag [{String(count).padStart(2, "0")}]
          </button>
        </div>
      </div>

      <div
        id="site-mega-menu"
        className={`site-mega ${menuOpen ? "is-open" : ""}`}
        // inert disables all interaction + hides from a11y tree without the
        // aria-hidden focus-trap problem. undefined removes the attribute when open.
        {...(!menuOpen && { inert: true })}
      >
        <nav className="site-mega__categories" aria-label="Collections">
          {categoryTabs.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-mega__sections" role="group" aria-label="Shop sections">
          {menuSections.map((section) => (
            <section key={section.number} className="site-mega__section" aria-label={section.title}>
              <p aria-hidden="true">
                <span>{section.number}</span>
                {section.title}
              </p>
              <ul>
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="site-mega__editorial" aria-hidden="true">
          {editorialImages.map((src, index) => (
            <img key={src} src={src} alt="" className={`site-mega__image site-mega__image--${index + 1}`} />
          ))}
        </div>

        <div className="site-mega__utility">
          <button type="button" onClick={openCart}>
            Bag
          </button>
          <Link to="/about">Log in</Link>
          <Link to="/about">Help</Link>
          <button
            type="button"
            className={`site-mega__audio ${isMuted ? "is-muted" : "is-playing"}`}
            onClick={toggleSound}
            aria-label={isMuted ? "Unmute atmospheric audio" : "Mute atmospheric audio"}
          >
            {isMuted ? "Sound off" : "Sound on"}
          </button>
        </div>
      </div>
    </header>
  );
}
