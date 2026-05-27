import { Link } from "react-router-dom";
import type { Product } from "../data/products";
import { formatPrice } from "../data/products";
import "./ProductCard.css";

type ProductCardProps = {
  product: Product;
  layout?: "grid" | "editorial";
};

export function ProductCard({ product, layout = "grid" }: ProductCardProps) {
  return (
    <article className={`product-card product-card--${layout}`}>
      {/*
        Image link is aria-hidden + tabIndex={-1} — the named <h3> link below
        is the keyboard/AT entry point. Avoids announcing the same destination twice.
        Hover image reveal is CSS :focus-within so keyboard users also see it.
      */}
      <Link
        to={`/product/${product.slug}`}
        className="product-card__media"
        aria-hidden="true"
        tabIndex={-1}
      >
        {product.tag && <span className="product-card__tag">{product.tag}</span>}
        <img
          src={product.image}
          alt=""
          className="product-card__img"
          loading="lazy"
        />
        {product.hoverImage && (
          <img
            src={product.hoverImage}
            alt=""
            className="product-card__img product-card__img--hover"
            loading="lazy"
          />
        )}
      </Link>
      <div className="product-card__meta">
        <Link to={`/product/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <p>{formatPrice(product.price)}</p>
      </div>
    </article>
  );
}
