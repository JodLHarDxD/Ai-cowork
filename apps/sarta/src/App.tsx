import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import Lenis from "lenis";
import { PreloaderScreen, CartDrawer } from "@jodl/patterns";
import { CartProvider, useCart } from "./context/CartContext";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { CustomCursor } from "./components/CustomCursor";
import { Home } from "./pages/Home";
import { Shop } from "./pages/Shop";
import { ProductPage } from "./pages/ProductPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { AboutPage } from "./pages/AboutPage";
import { formatPrice } from "./data/products";
import { sartaAudio } from "./components/AudioManager";
import { images } from "@/assets/content-manifest";

// 9 high-impact fashion editorial images for the sensory preloader
const PRELOADER_IMAGES = [
  images.editorialPantherPinkWater,
  images.editorialWomanColorblockTeal,
  images.editorialManSalmonProfile,
  images.editorialWomanMistPortrait,
  images.editorialGoldJewelry,
  images.editorialWomanStripedGown,
  images.editorialCoutureLeafRunway,
  images.editorialGirlWolfNight,
  images.heroModelSequinHorse,
];

function ControlledCartDrawer() {
  const {
    items,
    subtotal,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
  } = useCart();

  return (
    <CartDrawer
      isOpen={isOpen}
      items={items}
      subtotal={subtotal}
      onClose={closeCart}
      onRemoveItem={(id, size, color) => removeItem(String(id), size, color)}
      onUpdateQuantity={(id, size, color, qty) => updateQuantity(String(id), size, color, qty)}
      formatPrice={formatPrice}
      linkComponent={Link}
    />
  );
}

export default function App() {
  const [showPreloader, setShowPreloader] = useState(true);

  useEffect(() => {
    if (showPreloader) return;

    const lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [showPreloader]);

  const handlePreloaderComplete = () => {
    setShowPreloader(false);
  };

  const handleAudioInit = (muted: boolean) => {
    sartaAudio.init();
    sartaAudio.setMuted(muted);
    if (!muted) {
      sartaAudio.play();
    }
  };

  return (
    <CartProvider>
      <BrowserRouter>
        {/* Animated dynamic noise film grain overlay across the entire SARTA showcase */}
        <div className="noise-overlay" />
        
        {showPreloader && (
          <PreloaderScreen
            images={PRELOADER_IMAGES}
            onComplete={handlePreloaderComplete}
            onAudioInit={handleAudioInit}
            wordmark="sarta"
            subtitle="Acoustic Sarta Laboratory"
          />
        )}
        
        {/* Fluid Inertial Custom Mouse Cursor */}
        <CustomCursor />
        
        <Header />
        <ControlledCartDrawer />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
        <Footer />
      </BrowserRouter>
    </CartProvider>
  );
}
