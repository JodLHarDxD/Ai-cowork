import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { useCart } from "../context/CartContext";
import { formatPrice, getProductBySlug, products } from "../data/products";
import "./ProductPage.css";

export function ProductPage() {
  const { slug } = useParams();
  const product = slug ? getProductBySlug(slug) : undefined;
  const { addItem } = useCart();

  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [activeImage, setActiveImage] = useState(0);

  // Reset selections when navigating between products
  useEffect(() => {
    setSize("");
    setColor("");
    setActiveImage(0);
  }, [slug]);

  if (!product) {
    return <Navigate to="/shop" replace />;
  }

  const related = products
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 4);

  const gallery = product.gallery.length > 0 ? product.gallery : [product.image];

  const handleAdd = () => {
    // Guard: product must have at least one size and color
    if (!product.sizes.length || !product.colors.length) return;
    const selectedSize = size || product.sizes[0];
    const selectedColor = color || product.colors[0];
    addItem({
      product,
      size: selectedSize,
      color: selectedColor,
    });
  };

  return (
    <main className="pdp page page-enter">
      <section className="pdp__layout">
        <div className="pdp__gallery" aria-label={`${product.name} gallery`}>
          {gallery.map((src, index) => (
            <button
              key={index}
              type="button"
              className={`pdp__gallery-frame ${activeImage === index ? "is-active" : ""}`}
              aria-label={index === 0 ? `View main image of ${product.name}` : `View image ${index + 1} of ${product.name}`}
              aria-current={activeImage === index ? "true" : undefined}
              onClick={() => setActiveImage(index)}
            >
              <img src={src} alt={index === 0 ? product.name : `${product.name} view ${index + 1}`} />
            </button>
          ))}
        </div>

        <aside className="pdp__info">
          <nav className="pdp__crumb" aria-label="Breadcrumb">
            <Link to="/shop">Shop</Link>
            <span>/</span>
            <Link to={`/shop?category=${product.category}`}>
              {product.category.charAt(0).toUpperCase() + product.category.slice(1)}
            </Link>
          </nav>

          {product.tag && <span className="pdp__tag">{product.tag}</span>}
          <h1 className="pdp__title">{product.name}</h1>
          <p className="pdp__price">{formatPrice(product.price)}</p>
          <p className="pdp__desc">{product.description}</p>

          <div className="pdp__option">
            <p>Color / {color || product.colors[0]}</p>
            <div className="pdp__swatches">
              {product.colors.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={color === item || (!color && item === product.colors[0]) ? "is-active" : ""}
                  onClick={() => setColor(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="pdp__option">
            <p>Size</p>
            <div className="pdp__sizes">
              {product.sizes.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={size === item || (!size && item === product.sizes[0]) ? "is-active" : ""}
                  onClick={() => setSize(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="pdp__add" onClick={handleAdd}>
            Add to bag
          </button>

          <ul className="pdp__details">
            {product.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </aside>
      </section>

      {related.length > 0 && (
        <section className="pdp__related">
          <h2>Related pieces</h2>
          <div className="pdp__related-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
